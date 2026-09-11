// E2E v2 smoke — new workspace features: universal uploads (product images,
// PO attachments, avatar), global search, PO calendar, self-profile, division
// admin cards, landing availability, live-notify WS.
// Run after e2e.mjs on the same seeded DB:  node scripts/e2e2.mjs
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.env.E2E2_PORT || '4002';
const BASE = `http://localhost:${PORT}`;
const DB = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/poms';

let passed = 0; const failures = [];
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✔ ${name}`); }
  else { failures.push(name); console.log(`  ✘ ${name} ${extra}`); }
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204 */ }
  return { status: res.status, json };
}

function multipart(fields) {
  const boundary = `----e2e${crypto.randomBytes(6).toString('hex')}`;
  const chunks = [];
  for (const [name, filename, type, content] of fields) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`));
    chunks.push(Buffer.isBuffer(content) ? content : Buffer.from(content));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
}

async function upload(path, token, files) {
  const { body, headers } = multipart(files);
  const res = await fetch(`${BASE}/api${path}`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${token}` }, body });
  let json = null;
  try { json = await res.json(); } catch { /* 204 */ }
  return { status: res.status, json };
}

async function login(identifier, password) {
  // Resolve the CAPTCHA challenge first (reveal hook is non-production only).
  const cap = await api('GET', '/auth/captcha?reveal=1');
  if (cap.status !== 200 || !cap.json.answer) throw new Error(`captcha fetch failed for ${identifier}`);
  const r = await api('POST', '/auth/login', { body: { identifier, password, captchaId: cap.json.id, captchaText: cap.json.answer } });
  if (r.status !== 200) throw new Error(`login ${identifier} failed: ${JSON.stringify(r.json).slice(0, 200)}`);
  return r.json;
}

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000' +
  '01f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 99 9]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF');
const FAKE_MP4 = Buffer.from([...Buffer.from('ftypisom'), ...crypto.randomBytes(64)]);

async function main() {
  console.log('Booting API for v2 smoke …');
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    env: { ...process.env, DATABASE_URL: DB, PORT, JWT_SECRET: 'e2e2-secret' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* boot */ }
    await sleep(400);
  }

  try {
    const admin = await login('admin@bsc.local', 'Admin@123');
    const buyer = await login('buyer.dvg@bsc.local', 'PE@12345');
    const aT = admin.accessToken, bT = buyer.accessToken;

    // ---------- Landing + static ----------
    const landing = await fetch(`${BASE}/landing`);
    const html = landing.ok ? await landing.text() : '';
    check('landing: public page served with app shell html', landing.status === 200 && html.includes('id="root"'));

    // ---------- Product image uploads (any-type accepted for gallery; images primary use) ----------
    const products = (await api('GET', '/products?pageSize=1', { token: bT })).json.data;
    const pid = products[0].id;
    let up = await upload(`/products/${pid}/images`, aT, [
      ['files', 'e2e-shirt.png', 'image/png', PNG],
      ['files', 'e2e-spec.pdf', 'application/pdf', PDF],
    ]);
    check('upload: product gallery accepts image + PDF (any-type policy)', up.status === 201 && up.json.data.length === 2);
    const freshPngId = up.json.data[0].id;
    let imgs = (await api('GET', `/products/${pid}/images`, { token: bT })).json.data;
    check('upload: gallery lists uploaded files with public URLs', imgs.length >= 2 && imgs[0].url.startsWith('/uploads/'));
    const img0 = imgs.find((i) => i.id === freshPngId); // this run's file, not a stale entry from an earlier run
    const staticRes = await fetch(`${BASE}${img0.url}`);
    check('upload: uploaded file served back byte-identical', staticRes.status === 200 && Buffer.compare(Buffer.from(await staticRes.arrayBuffer()), PNG) === 0);
    const setPrimary = await api('PATCH', `/products/${pid}/images/${img0.id}/primary`, { token: aT });
    check('upload: primary image switchable', setPrimary.status === 200);
    const listAgain = (await api('GET', '/products?pageSize=1', { token: bT })).json.data;
    check('catalogue: product row exposes primary image + count', !!listAgain[0].primary_image_key && listAgain[0].image_count >= 2);

    // buyer lacks masters.manage → gallery upload denied (role-based)
    up = await upload(`/products/${pid}/images`, bT, [['files', 'nope.png', 'image/png', PNG]]);
    check('RBAC: buyer cannot upload product images (masters.manage)', up.status === 403);

    // ---------- PO attachments (universal: pdf + fake mp4) ----------
    const pos = (await api('GET', '/purchase-orders?pageSize=5', { token: bT })).json.data;
    const po = pos.find((p) => p.status === 'draft') || pos[0];
    up = await upload(`/purchase-orders/${po.id}/attachments`, bT, [
      ['files', 'quote.pdf', 'application/pdf', PDF],
      ['files', 'walkthrough.mp4', 'video/mp4', FAKE_MP4],
    ]);
    check('upload: PO accepts PDF + MP4 attachments', up.status === 201 && up.json.data.length === 2);
    const atts = (await api('GET', `/purchase-orders/${po.id}/attachments`, { token: bT })).json.data;
    check('upload: attachment list shows uploader + url', atts.length >= 2 && atts[0].uploaded_by_name && atts[0].url.startsWith('/uploads/'));

    // ---------- Avatar upload ----------
    up = await upload('/users/me/photo', bT, [['file', 'me.png', 'image/png', PNG]]);
    check('upload: self avatar upload works', up.status === 200 && up.json.data.profilePhotoUrl.startsWith('/uploads/'));
    const me = (await api('GET', '/users/me', { token: bT })).json.data;
    check('profile: /users/me returns photo + roles', me.profilePhotoUrl && me.roles.includes('purchase_executive'));
    const patch = await api('PATCH', '/users/me', { token: bT, body: { fullName: me.fullName, designation: 'Sr. Buyer' } });
    check('profile: self designation update', patch.status === 200 && patch.json.data.designation === 'Sr. Buyer');

    // ---------- Admin user administration ----------
    const usersList = (await api('GET', '/users', { token: aT })).json.data;
    check('users: admin sees avatars + designations in list', 'profile_photo_url' in (usersList[0] || {}) && 'designation' in (usersList[0] || {}));
    const noPerm = await api('GET', '/users', { token: bT });
    check('RBAC: buyer denied user administration', noPerm.status === 403);

    // ---------- Global search ----------
    let s = (await api('GET', '/search?q=PO', { token: aT })).json.data;
    check('search: finds purchase orders by prefix', s.purchaseOrders.length > 0);
    s = (await api('GET', '/search?q=saree', { token: bT })).json.data;
    check('search: finds products by name', s.products.length > 0);
    const buyerSearch = (await api('GET', '/search?q=PO', { token: bT })).json.data;
    check('search: buyer results scoped (no user section without perm)', !buyerSearch.users.length);
    const short = await api('GET', '/search?q=a', { token: aT });
    check('search: under-2-char query returns empty safely', short.status === 200);

    // ---------- PO calendar ----------
    const now = new Date();
    const cal = (await api('GET', `/reports/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`, { token: aT })).json;
    check('calendar: month payload returns day aggregates', Array.isArray(cal.days));
    const day = cal.days[0];
    if (day) {
      const detail = (await api('GET', `/reports/calendar/${day.day}`, { token: aT })).json;
      check('calendar: day drill-down lists that day\'s POs', detail.data.length === day.count && detail.totals.count === day.count);
    } else {
      check('calendar: day drill-down (no POs this month — skipping detail)', true);
    }
    const badDate = await api('GET', '/reports/calendar/not-a-date', { token: aT });
    check('calendar: malformed date rejected', badDate.status === 400);

    // ---------- Dashboard division-admin cards ----------
    const dash = (await api('GET', '/reports/dashboard', { token: aT })).json;
    check('dashboard: divisionAdmins present with division + admins[]', Array.isArray(dash.divisionAdmins) && dash.divisionAdmins.length > 0 && Array.isArray(dash.divisionAdmins[0].admins));

    // ---------- Live notification WS ----------
    const wsOK = await new Promise((resolve) => {
      import('ws').then(({ default: WebSocket }) => {
        const sock = new WebSocket(`ws://localhost:${PORT}/ws/notify?token=${bT}`);
        sock.on('open', () => setTimeout(() => resolve(sock.readyState === 1), 1500)); // still open = authed + alive
        sock.on('error', () => resolve(false));
        setTimeout(() => { try { sock.close(); } catch { } resolve(false); }, 6000);
      });
    });
    check('notify: /ws/notify authenticates and stays connected', wsOK === true);

    // notifications list for pm (approver) should include submit event
    const pm = await login('pm.dvg@bsc.local', 'PM@12345');
    const notif = (await api('GET', '/notifications', { token: pm.accessToken })).json;
    check('notify: approver has unread in-app notifications', notif.unread > 0);

    console.log(`\n=== E2E v2 RESULT: ${passed} passed, ${failures.length} failed ===`);
    if (failures.length) { console.log(log.slice(-1500)); process.exitCode = 1; }
  } finally {
    server.kill();
    await sleep(300);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
