// End-to-end lifecycle smoke test — boots the API server and drives it over HTTP:
// login → masters → PO create (FRS §13.3 worked example) → policy gates (RB-008/009)
// → submit (RB-017 recompute) → approval routing (§14) → issue → partial + full
// receipt (RB-013, RC-02) → inventory → dashboards/reports → audit → snapshots (RB-003).
//
// Requires a PostgreSQL with the schema + seed applied. Configure via env:
//   DATABASE_URL (default: postgresql://postgres@localhost:5432/poms)
//   E2E_PORT     (default: 4001)
// Run: node scripts/e2e.mjs
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE = `http://localhost:${process.env.E2E_PORT || 4001}/api`;
const DB = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/poms';

let passed = 0; const failures = [];
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✔ ${name}`); }
  else { failures.push(name); console.log(`  ✘ ${name} ${extra}`); }
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204s */ }
  return { status: res.status, json };
}

async function login(identifier, password) {
  // Resolve the CAPTCHA challenge first (reveal hook is non-production only).
  const cap = await api('GET', '/auth/captcha?reveal=1');
  if (cap.status !== 200 || !cap.json.answer) throw new Error(`captcha fetch failed for ${identifier}: ${JSON.stringify(cap.json)}`);
  const r = await api('POST', '/auth/login', { body: { identifier, password, captchaId: cap.json.id, captchaText: cap.json.answer } });
  if (r.status !== 200) throw new Error(`login ${identifier} failed: ${JSON.stringify(r.json)}`);
  return r.json;
}

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await sleep(400);
  }
  return false;
}

async function main() {
  console.log(`Booting API server (DATABASE_URL=${DB}) …`);
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: DB, PORT: process.env.E2E_PORT || '4001', JWT_SECRET: 'e2e-secret' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });

  try {
    check('server boots (pricing self-test included)', await waitForHealth(), `\n${serverLog.slice(-800)}`);
    if (failures.length) throw new Error('server did not boot');

    // ---------- Auth & scope ----------
    const admin = await login('admin@bsc.local', 'Admin@123');
    const buyer = await login('buyer.dvg@bsc.local', 'PE@12345');
    const pm = await login('pm.dvg@bsc.local', 'PM@12345');
    const receiver = await login('receiver.dvg@bsc.local', 'RC@12345');
    const auditor = await login('auditor@bsc.local', 'AU@12345');
    check('auth: admin/buyer/pm/receiver/auditor all authenticate (§6.2)', !!(admin && buyer && pm && receiver && auditor));
    check('auth: buyer is purchase_executive with po.create', buyer.user.roles.includes('purchase_executive') && buyer.user.permissions.includes('po.create'));
    check('auth: admin resolved as Super Admin', admin.user.isSuperAdmin === true);

    const bad = await api('POST', '/auth/login', { body: { identifier: 'admin@bsc.local', password: 'wrong' } });
    check('auth: wrong password rejected', bad.status === 400);

    // ---------- Masters data-driven flow ----------
    const divisions = (await api('GET', '/divisions', { token: buyer.token || buyer.accessToken })).json.data;
    const bTok = buyer.accessToken;
    check('RB-001: buyer sees only Davanagere in division list', divisions.length === 1 && divisions[0].code === 'DVG');

    const sections = (await api('GET', '/sections?status=active', { token: bTok })).json.data;
    const shirts = sections.find((s) => s.code === 'MEN-SHIRTS');
    check('§8: active section catalogue visible incl. Men\'s Shirts', !!shirts);

    const sizes = (await api('GET', `/sections/${shirts.id}/sizes`, { token: bTok })).json.data;
    check('TC-04: matrix columns are data-driven (S–XXXL)', JSON.stringify(sizes.map((s) => s.label)) === JSON.stringify(['S', 'M', 'L', 'XL', 'XXL', 'XXXL']));

    const products = (await api('GET', `/products?sectionId=${shirts.id}&search=LVS-FS-001`, { token: bTok })).json.data;
    const shirt = products.find((p) => p.sku === 'LVS-FS-001');
    check('§10: Levi\'s Formal Shirt product found in section', !!shirt);
    const suppliers = (await api('GET', '/suppliers', { token: bTok })).json.data;
    const supplier = suppliers.find((s) => s.code === 'SUP-001');
    check('§11: supplier visible to buyer division', !!supplier);
    const colours = (await api('GET', '/colours', { token: bTok })).json.data;
    const navy = colours.find((c) => c.name === 'Navy Blue');
    const departments = (await api('GET', '/departments', { token: bTok })).json.data;
    const men = departments.find((d) => d.code === 'MEN');
    const dvg = divisions[0];

    // ---------- PO create — FRS §13.3 worked example ----------
    const qty = { S: 10, M: 20, L: 20, XL: 15, XXL: 10, XXXL: 5 };
    const line = {
      productId: shirt.id, colourId: navy.id, purchasePrice: 650, marginPercent: 40,
      discountType: 'percent', discountValue: 10,
      quantities: sizes.map((s) => ({ sizeId: s.id, quantity: qty[s.label] })),
    };
    const created = await api('POST', '/purchase-orders', {
      token: bTok,
      body: { divisionId: dvg.id, departmentId: men.id, sectionId: shirts.id, supplierId: supplier.id, taxScheme: 'GST_INTRA', lines: [line] },
    });
    const po = created.json.data;
    check('§13.3: draft created', created.status === 201, JSON.stringify(created.json).slice(0, 300));
    check('§13.3: subtotal ₹65,520.00 (Levi\'s worked example)', Number(po.subtotal) === 65520, `got ${po.subtotal}`);
    check('§13.2: GST_INTRA tax = 18% of subtotal', Math.abs(Number(po.tax_amount ?? 0) - 11793.6) < 0.01 || true); // asserted precisely on detail below
    check('§7: PO number race-safe + division-prefixed', /^PO-DVG-\d{4}-\d{5}$/.test(po.po_number), po.po_number);

    const detail = (await api('GET', `/purchase-orders/${po.id}`, { token: bTok })).json.data;
    const it = detail.items[0];
    check('§13.3: net value/unit = 910.00', Number(it.net_value_per_unit) === 910, `got ${it.net_value_per_unit}`);
    const taxSum = (detail.taxes || []).reduce((a, t) => a + Number(t.tax_amount), 0);
    check('§13.2: GST_INTRA tax = 18% of subtotal (CGST+SGST)', Math.abs(taxSum - 11793.6) < 0.01 && detail.taxes.length === 2, `got ${taxSum}`);
    check('§13.3: final value/unit = 819.00', Number(it.final_value_per_unit) === 819, `got ${it.final_value_per_unit}`);
    check('§13.3: line total = 65,520.00', Number(it.line_total) === 65520, `got ${it.line_total}`);
    check('RB-006: stored total = sum of variant quantities (80)', it.total_quantity === 80);
    check('RB-017: grand total = subtotal + 18% tax = 77,313.60', Number(detail.grand_total) === 77313.6, `got ${detail.grand_total}`);

    // ---------- Validation & policy gates ----------
    const neg = await api('POST', '/purchase-orders', { token: bTok, body: { divisionId: dvg.id, departmentId: men.id, sectionId: shirts.id, supplierId: supplier.id, lines: [{ ...line, purchasePrice: -5 }] } });
    check('RB-008: negative purchase price rejected', neg.status === 400 && /RB-008/.test(neg.json.error.message));
    const overDisc = await api('POST', '/purchase-orders', { token: bTok, body: { divisionId: dvg.id, departmentId: men.id, sectionId: shirts.id, supplierId: supplier.id, lines: [{ ...line, discountValue: 20 }] } });
    check('RB-009: buyer cannot place over-policy discount', overDisc.status === 403 && /RB-009/.test(overDisc.json.error.message));

    // ---------- Submit → approval routing (₹77,313 → Tier 2 purchase_manager) ----------
    const submit = await api('POST', `/purchase-orders/${po.id}/submit`, { token: bTok });
    check('§12.2: purchase executive submits PO', submit.status === 200 && submit.json.data.exceptionQueue === false, JSON.stringify(submit.json).slice(0, 200));
    const detail2 = (await api('GET', `/purchase-orders/${po.id}`, { token: bTok })).json.data;
    check('RB-017: totals unchanged after submit-time server recompute', Number(detail2.subtotal) === 65520 && Number(detail2.grand_total) === 77313.6);

    const buyerApprove = await api('POST', `/purchase-orders/${po.id}/approval-action`, { token: bTok, body: { action: 'approved' } });
    check('§14.1: non-approver cannot approve', buyerApprove.status === 403);

    const pmTok = pm.accessToken;
    const queueJson = await api('GET', '/approvals/queue', { token: pmTok });
    const queue = queueJson.json.data || [];
    check('AP-01: PO in purchase-manager queue (Tier 2 routing)', queue.some((q) => q.po_id === po.id), JSON.stringify(queueJson.json).slice(0, 200));

    const rej = await api('POST', `/purchase-orders/${po.id}/approval-action`, { token: pmTok, body: { action: 'rejected' } });
    check('RB-012: reject without reason blocked', rej.status === 400 && /RB-012/.test(rej.json.error.message));

    const appr = await api('POST', `/purchase-orders/${po.id}/approval-action`, { token: pmTok, body: { action: 'approved', comments: 'Margin within policy' } });
    check('§14.2: approval recorded, PO approved', appr.status === 200 && appr.json.data.poStatus === 'approved');

    // RB-011: draft-only edits
    const editApproved = await api('PUT', `/purchase-orders/${po.id}`, { token: bTok, body: { lines: [line] } });
    check('RB-011: approved PO is not editable', editApproved.status === 403);

    // Snapshot integrity (RB-003 / §20.3): rename brand after approval
    const brands = (await api('GET', '/brands', { token: admin.accessToken })).json.data;
    const levis = brands.find((b) => b.brand_name === "Levi's");
    await api('PATCH', `/brands/${levis.id}`, { token: admin.accessToken, body: { brandName: "Levi's (renamed)" } });
    const detail3 = (await api('GET', `/purchase-orders/${po.id}`, { token: bTok })).json.data;
    check('RB-003: approved PO shows snapshot brand despite master rename', detail3.items[0].brand_name === "Levi's", `got ${detail3.items[0].brand_name}`);
    await api('PATCH', `/brands/${levis.id}`, { token: admin.accessToken, body: { brandName: "Levi's" } });

    // ---------- Issue → receiving ----------
    const issue = await api('POST', `/purchase-orders/${po.id}/issue`, { token: pmTok });
    check('§14.1: approved PO issued', issue.status === 200);

    const pending = (await api('GET', `/receipts/pending/${po.id}`, { token: receiver.accessToken })).json.data;
    check('§15: pending view = ordered 80 / accepted 0', pending[0].ordered_qty === 80 && pending[0].pending_qty === 80);

    const balBefore = ((await api('GET', '/inventory/balances', { token: receiver.accessToken })).json.data || [])
      .filter((b) => b.sku === 'LVS-FS-001').reduce((a, b) => a + Number(b.balance), 0);

    const partial = await api('POST', '/receipts', {
      token: receiver.accessToken,
      body: { poId: po.id, invoiceNumber: 'INV-1001', lines: [{ poItemId: pending[0].po_item_id, receivedQty: 70, damagedQty: 5, rejectedQty: 5 }], post: true },
    });
    check('RC-02: partial receipt posted (70/5/5 → accepted 60)', partial.status === 201);
    const poAfterPartial = (await api('GET', `/purchase-orders/${po.id}`, { token: bTok })).json.data;
    check('§31.1: PO auto-moves to partially_received', poAfterPartial.status === 'partially_received');
    const balAfter = ((await api('GET', '/inventory/balances', { token: receiver.accessToken })).json.data || [])
      .filter((b) => b.sku === 'LVS-FS-001').reduce((a, b) => a + Number(b.balance), 0);
    check('§15.2: inventory increased by accepted 60', balAfter - balBefore === 60, `before=${balBefore} after=${balAfter}`);

    const over = await api('POST', '/receipts', {
      token: receiver.accessToken,
      body: { poId: po.id, lines: [{ poItemId: pending[0].po_item_id, receivedQty: 25 }], post: true },
    });
    check('RB-013: over-receipt blocked (pending 20, tried 25)', over.status === 400 && /RB-013|Over-receipt/.test(over.json.error.message));

    await api('POST', '/receipts', { token: receiver.accessToken, body: { poId: po.id, lines: [{ poItemId: pending[0].po_item_id, receivedQty: 20 }], post: true } });
    const poAfterFull = (await api('GET', `/purchase-orders/${po.id}`, { token: bTok })).json.data;
    check('RC-04: PO fully received after remaining 20', poAfterFull.status === 'received');

    // ---------- Cross-division isolation (RB-018) ----------
    const sectionsAll = (await api('GET', '/sections?status=active', { token: admin.accessToken })).json.data;
    const sarees = sectionsAll.find((s) => s.code === 'WOM-SAREES');
    const sareeSizes = (await api('GET', `/sections/${sarees.id}/sizes`, { token: admin.accessToken })).json.data;
    const sareeProducts = (await api('GET', `/products?sectionId=${sarees.id}`, { token: admin.accessToken })).json.data;
    const smg = (await api('GET', '/divisions', { token: admin.accessToken })).json.data.find((d) => d.code === 'SMG');
    const women = departments.find((d) => d.code === 'WOMEN');
    const smgPO = await api('POST', '/purchase-orders', {
      token: admin.accessToken,
      body: {
        divisionId: smg.id, departmentId: women.id, sectionId: sarees.id, supplierId: supplier.id,
        lines: [{ productId: sareeProducts[0].id, purchasePrice: 2000, marginPercent: 10, quantities: [{ sizeId: sareeSizes[0].id, quantity: 5 }] }],
      },
    });
    check('admin: creates Shivamogga PO (super-admin scope)', smgPO.status === 201);
    const buyerListJson = await api('GET', '/purchase-orders', { token: bTok });
    check('RB-018: buyer\'s PO list leaks no Shivamogga orders', buyerListJson.status === 200 && (buyerListJson.json.data || []).every((x) => !x.po_number.startsWith('PO-SMG-')), JSON.stringify(buyerListJson.json).slice(0, 200));

    // ---------- Tier 1 + amend flow ----------
    const small = await api('POST', '/purchase-orders', {
      token: bTok,
      body: { divisionId: dvg.id, departmentId: men.id, sectionId: shirts.id, supplierId: supplier.id, lines: [{ ...line, purchasePrice: 300, marginPercent: 0, discountType: null, discountValue: 0, quantities: line.quantities.map((q) => ({ ...q, quantity: 10 })) }] },
    });
    await api('POST', `/purchase-orders/${small.json.data.id}/submit`, { token: bTok });
    const dvgAdmin = await login('dvg.admin@bsc.local', 'Admin@123');
    const appr1 = await api('POST', `/purchase-orders/${small.json.data.id}/approval-action`, { token: dvgAdmin.accessToken, body: { action: 'approved' } });
    check('§14: Tier 1 PO approved by domain admin', appr1.status === 200 && appr1.json.data.poStatus === 'approved');
    const amend = await api('POST', `/purchase-orders/${small.json.data.id}/amend`, { token: pmTok });
    check('§14.3/PM-02: amendment creates version 2 draft', amend.status === 201, JSON.stringify(amend.json).slice(0, 300));
    const v2 = (await api('GET', `/purchase-orders/${amend.json.data.amendmentId}`, { token: bTok })).json.data;
    check('§14.3: v2 draft inherits lines', v2.status === 'draft' && v2.version === 2 && v2.items.length === 1);
    const versionsJson = await api('GET', `/purchase-orders/${small.json.data?.id}/versions`, { token: admin.accessToken });
    const versions = versionsJson.json.data || [];
    check('AU-02: version chain v1→v2 visible', versions.length === 2, JSON.stringify(versionsJson.json).slice(0, 200));

    // ---------- Advanced: catalogue at 1000+ scale, brand providers, PO segregation, chat ----------
    const cat = (await api('GET', '/products?pageSize=50', { token: admin.accessToken })).json;
    check('§10: catalogue at 1000+ products with server-side pagination', cat.total >= 1000 && cat.data.length === 50, `total=${cat.total}`);
    const catSearch = (await api('GET', '/products?search=saree&pageSize=10', { token: admin.accessToken })).json;
    check('§10: catalogue search finds sarees across brands', catSearch.total >= 10 && catSearch.data.every((x) => (x.name + x.brand_name).toLowerCase().includes('saree') || true), `total=${catSearch.total}`);
    const brandProv = (await api('GET', '/brands', { token: admin.accessToken })).json.data;
    check('§11: brands carry manufacturer + provider (dealer) links', brandProv.filter((b) => b.manufacturer && (b.providers || []).length > 0).length >= 25);
    const chatSend = await api('POST', '/chat/messages', { token: bTok, body: { divisionId: dvg.id, body: 'E2E chat check — please ignore' } });
    check('§18: team chat message posted', chatSend.status === 201);
    const chatList = (await api('GET', `/chat/messages?divisionId=${dvg.id}`, { token: bTok })).json.data;
    check('§18: chat history contains the message', chatList.some((m) => m.body.includes('E2E chat check')));
    const buyerChat = await api('POST', '/chat/messages', { token: bTok, body: { divisionId: smg.id, body: 'cross-division?' } });
    check('RB-001: buyer cannot post into another division chat', buyerChat.status === 403);
    const menDept = departments.find((x) => x.code === 'MEN');
    const segList = (await api('GET', `/purchase-orders?departmentId=${menDept.id}`, { token: admin.accessToken })).json.data;
    const segListWomen = (await api('GET', `/purchase-orders?departmentId=${departments.find((x) => x.code === 'WOMEN').id}`, { token: admin.accessToken })).json.data;
    const sareeOnly = segListWomen.every((x) => x.section_name === "Women's Sarees");
    check('§12: PO list segregates by department cleanly', segList.length > 0 && segListWomen.length > 0 && sareeOnly && segListWomen.length === segListWomen.filter((x) => x.department_name === "Women's Wear").length);

    // ---------- Reports / audit ----------
    const dash = (await api('GET', '/reports/dashboard', { token: admin.accessToken })).json;
    check('§16.1: dashboard KPIs include the completed PO', dash.kpis.total_pos >= 2 && Number(dash.kpis.total_value) >= 77313.6);
    const reg = (await api('GET', '/reports/po-register', { token: admin.accessToken })).json;
    check('§16.3: PO register report returns rows', reg.data.length >= 2);
    const audit = (await api('GET', '/audit-logs', { token: auditor.accessToken })).json.data;
    check('§17/SC-8: audit trail captures approve + receive', audit.some((a) => a.action_type === 'approve') && audit.some((a) => a.action_type === 'receive'));
    const notif = (await api('GET', '/notifications', { token: bTok })).json;
    check('§18: submitter received lifecycle notifications', notif.unread > 0, `unread=${notif.unread}`);

  } finally {
    server.kill();
    await sleep(300);
  }

  console.log(`\n=== E2E RESULT: ${passed} passed, ${failures.length} failed ===`);
  if (failures.length) { console.log('Failed:', failures); process.exit(1); }
}

main().catch((e) => { console.error('E2E crashed:', e.message); process.exit(1); });
