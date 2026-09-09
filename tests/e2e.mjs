#!/usr/bin/env node
/**
 * BSC Exclusive POMS — End-to-End API Smoke Test
 * Run: node tests/e2e.mjs
 * Requires backend running on http://localhost:4040
 */

const BASE = process.env.API_URL || 'http://localhost:4040';

async function request(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label}`); }
}

async function run() {
  console.log('=== BSC POMS E2E Smoke Test ===\n');

  // --- Auth ---
  console.log('[Auth]');
  // Every login consumes a single-use CAPTCHA; the ?reveal=1 hook (non-production only)
  // lets this smoke test read the answer directly.
  const cap = await request('GET', '/api/auth/captcha?reveal=1');
  assert(cap.status === 200 && cap.data?.id && cap.data?.answer, 'CAPTCHA challenge issued (reveal hook)');
  const login = await request('POST', '/api/auth/login', {
    identifier: 'admin@bsc.local', password: 'Admin@123', captchaId: cap.data.id, captchaText: cap.data.answer,
  });
  assert(login.status === 200 && login.data.accessToken, 'Login returns JWT');
  const token = login.data.accessToken;
  if (!token) {
    // Without a token every later assertion fails confusingly; bail with a clear note.
    console.error('\nCannot continue: no session token. This suite requires a NON-production server (the CAPTCHA ?reveal=1 hook is disabled when NODE_ENV=production).');
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${token}` };

  const me = await request('GET', '/api/auth/me', null, auth);
  assert(me.status === 200 && me.data.user?.isSuperAdmin, 'Admin is super_admin');

  const badLogin = await request('POST', '/api/auth/login', { identifier: 'admin@bsc.local', password: 'wrong' });
  assert(badLogin.status === 400, 'Wrong password returns 400');

  // --- Master Data ---
  console.log('\n[Master Data]');
  for (const ep of ['/api/brands', '/api/colours', '/api/sizes', '/api/manufacturers', '/api/locations', '/api/product-types', '/api/suppliers', '/api/divisions', '/api/departments', '/api/sections']) {
    const r = await request('GET', ep, null, auth);
    assert(r.status === 200 && Array.isArray(r.data?.data), `${ep} returns list`);
  }

  // --- Locations CRUD ---
  console.log('\n[Locations CRUD]');
  // Unique run code so repeated smoke runs never collide with archived rows.
  const runCode = `TST${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const newLoc = await request('POST', '/api/locations', {
    code: runCode, name: 'Test City', address: '123 Test St', city: 'Testville',
    state: 'TS', contact_person: 'Tester', phone: '1234567890', status: 'active'
  }, auth);
  assert(newLoc.status === 200 || newLoc.status === 201, 'Create location');
  const locId = newLoc.data?.data?.id;

  if (locId) {
    const patchLoc = await request('PATCH', `/api/locations/${locId}`, { city: 'Updatedville' }, auth);
    assert(patchLoc.status === 200, 'Update location');

    const delLoc = await request('DELETE', `/api/locations/${locId}`, null, auth);
    assert(delLoc.status === 200 || delLoc.status === 204, 'Delete (archive) location');
  }

  // --- Product Types CRUD ---
  console.log('\n[Product Types CRUD]');
  const sections = await request('GET', '/api/sections', null, auth);
  const firstSectionId = sections.data?.data?.[0]?.id;
  if (firstSectionId) {
    const newPT = await request('POST', '/api/product-types', { code: runCode, name: 'Test Type', sectionId: firstSectionId }, auth);
    assert(newPT.status === 201, 'Create product type');
    const ptId = newPT.data?.data?.id;

    if (ptId) {
      const patchPT = await request('PATCH', `/api/product-types/${ptId}`, { name: 'Updated Type' }, auth);
      assert(patchPT.status === 200, 'Update product type');

      const delPT = await request('DELETE', `/api/product-types/${ptId}`, null, auth);
      assert(delPT.status === 200 || delPT.status === 204, 'Delete (archive) product type');
    }
  } else {
    console.log('  (skipped: no sections to attach product type to)');
  }

  // --- Dashboard ---
  console.log('\n[Dashboard]');
  const dash = await request('GET', '/api/reports/dashboard', null, auth);
  assert(dash.status === 200, 'Dashboard returns OK');
  assert(typeof dash.data.kpis?.total_pos === 'number', 'kpis.total_pos is number');
  assert(Array.isArray(dash.data.monthly) && dash.data.monthly.length === 12, 'monthly series (12 months) present');
  assert(Array.isArray(dash.data.recentPOs), 'recentPOs list present');
  assert(typeof dash.data.workProgress?.total === 'number', 'workProgress.total is number');
  assert(Array.isArray(dash.data.byDivision), 'byDivision breakdown present');

  // --- Purchase Orders ---
  console.log('\n[Purchase Orders]');
  const pos = await request('GET', '/api/purchase-orders?pageSize=2', null, auth);
  assert(pos.status === 200 && Array.isArray(pos.data?.data), 'PO list returns');
  assert(typeof pos.data?.total === 'number', 'PO total count exists');

  if (pos.data.data.length > 0) {
    const poId = pos.data.data[0].id;
    const detail = await request('GET', `/api/purchase-orders/${poId}`, null, auth);
    assert(detail.status === 200, 'PO detail returns');
    assert(Array.isArray(detail.data?.data?.items), 'PO detail has items');
  }

  // --- Reports ---
  console.log('\n[Reports]');
  for (const rpt of ['po-register', 'purchase-summary', 'dealer', 'size', 'margin', 'receiving']) {
    const r = await request('GET', `/api/reports/${rpt}`, null, auth);
    assert(r.status === 200, `${rpt} report returns`);
  }

  // --- Notifications ---
  console.log('\n[Notifications]');
  const notif = await request('GET', '/api/notifications', null, auth);
  assert(notif.status === 200 && Array.isArray(notif.data?.data), 'Notifications returns list');

  // --- Audit Logs ---
  console.log('\n[Audit Logs]');
  const audit = await request('GET', '/api/audit-logs?pageSize=5', null, auth);
  assert(audit.status === 200 && Array.isArray(audit.data?.data), 'Audit logs returns list');

  // --- Summary ---
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error('FATAL:', e); process.exit(1); });
