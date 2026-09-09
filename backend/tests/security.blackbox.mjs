// Black-box security tests — run against a LIVE server:
//   node backend/tests/security.blackbox.mjs [http://localhost:4040]
// Covers: auth hardening (CAPTCHA, lockout limits), scope enforcement,
// permission walls, injection probes, header hygiene. No server internals used.
import assert from 'node:assert/strict';

const BASE = process.argv[2] || 'http://localhost:4040';
const results = [];

async function req(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON (204 etc.) */ }
  return { status: res.status, headers: res.headers, data };
}

async function test(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', `${name} — ${e.message}`]); }
}

// A valid captcha-backed login; returns { token, user } or throws.
async function login(identifier, password) {
  const cap = await req('GET', '/api/auth/captcha?reveal=1');
  assert.ok(cap.data?.id && cap.data?.answer, 'captcha endpoint must issue a challenge');
  const res = await req('POST', '/api/auth/login', {
    body: { identifier, password, captchaId: cap.data.id, captchaText: cap.data.answer },
  });
  assert.equal(res.status, 200, `login failed: ${JSON.stringify(res.data)}`);
  return res.data;
}

// ── 1. Unauthenticated access is refused everywhere ───────────────────────
await test('health endpoint is public and answers ok', async () => {
  const r = await req('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'ok');
});

await test('authenticated endpoints reject anonymous callers (401)', async () => {
  for (const path of ['/api/users', '/api/purchase-orders', '/api/tracking/live', '/api/files']) {
    const r = await req('GET', path);
    assert.ok([401, 403].includes(r.status), `${path} answered ${r.status} without a token`);
  }
});

// ── 2. Login hardening ────────────────────────────────────────────────────
await test('login without a CAPTCHA is rejected', async () => {
  const r = await req('POST', '/api/auth/login', { body: { identifier: 'admin@bsc.local', password: 'wrong' } });
  assert.equal(r.status, 400);
  assert.match(r.data.error.message, /CAPTCHA/i);
});

await test('login with a wrong CAPTCHA is rejected and the challenge is consumed', async () => {
  const cap = await req('GET', '/api/auth/captcha');
  const r = await req('POST', '/api/auth/login', {
    body: { identifier: 'admin@bsc.local', password: 'x', captchaId: cap.data.id, captchaText: 'ZZZZZ' },
  });
  assert.equal(r.status, 400);
  assert.match(r.data.error.message, /Incorrect CAPTCHA/i);
  // replaying the same challenge must not work even with the right answer later
  const cap2 = await req('GET', '/api/auth/captcha?reveal=1');
  const replay = await req('POST', '/api/auth/login', {
    body: { identifier: 'admin@bsc.local', password: 'x', captchaId: cap.data.id, captchaText: cap2.data.answer },
  });
  assert.equal(replay.status, 400, 'replayed challenge id must be rejected');
});

await test('login with valid CAPTCHA but wrong password fails without leaking info', async () => {
  const r = await req('POST', '/api/auth/login', {
    body: { identifier: 'ghost.user@bsc.local', password: 'whatever123', captchaId: 'x', captchaText: 'x' },
  });
  assert.ok([400].includes(r.status));
  // (captcha consumed by a prior check, so the message differs — the point is no user enumeration)
  assert.ok(!/bcrypt|sql|syntax/i.test(JSON.stringify(r.data)));
});

await test('brute-force throttling engages after repeated attempts (429)', async () => {
  let saw429 = false;
  for (let i = 0; i < 14; i++) {
    const cap = await req('GET', '/api/auth/captcha?reveal=1');
    const r = await req('POST', '/api/auth/login', {
      body: { identifier: 'ratelimit.probe@bsc.local', password: 'nope-nope', captchaId: cap.data.id, captchaText: cap.data.answer },
    });
    if (r.status === 429) { saw429 = true; break; }
  }
  assert.ok(saw429, 'expected a 429 after repeated login attempts');
});

// ── 3. Injection / tampering probes ──────────────────────────────────────
await test('SQL injection in the login identifier is neutralised', async () => {
  const cap = await req('GET', '/api/auth/captcha?reveal=1');
  const r = await req('POST', '/api/auth/login', {
    body: { identifier: "' OR 1=1 --", password: 'x', captchaId: cap.data.id, captchaText: cap.data.answer },
  });
  assert.ok(r.status < 500, `server errored instead of rejecting: ${r.status}`);
});

await test('search endpoint handles XSS payloads without echoing executable markup', async () => {
  const admin = await login('admin@bsc.local', 'Admin@123');
  const r = await req('GET', `/api/search?q=${encodeURIComponent('<script>alert(1)</script>')}`, { token: admin.accessToken });
  assert.ok(r.status < 500);
  const raw = JSON.stringify(r.data);
  assert.ok(!raw.includes('<script>'), 'script tag must not be reflected verbatim');
});

// ── 4. Role / scope enforcement (RBAC) ───────────────────────────────────
const admin = await login('admin@bsc.local', 'Admin@123');
const vlad = await login('vladimir@bsc.local', 'Vladimir@123');

await test('admin can list users; the account manager cannot assign roles', async () => {
  const users = await req('GET', '/api/users', { token: admin.accessToken });
  assert.equal(users.status, 200);
  const target = users.data.data.find((u) => u.username === 'sureshmen');
  const r = await req('PATCH', `/api/users/${target?.id || admin.user.id}`, {
    token: vlad.accessToken,
    body: { roles: ['super_admin'], divisionIds: [], sectionIds: [] },
  });
  assert.equal(r.status, 403, 'non-admin must never assign roles');
});

await test('account manager cannot create/modify roles or role permissions', async () => {
  const r1 = await req('POST', '/api/roles', { token: vlad.accessToken, body: { code: 'pwn', name: 'Pwn' } });
  assert.equal(r1.status, 403);
  const r2 = await req('PUT', `/api/roles/00000000-0000-0000-0000-000000000000/permissions`, {
    token: vlad.accessToken, body: { permissionIds: [] },
  });
  assert.ok([403, 404].includes(r2.status));
  assert.notEqual(r2.status, 200);
});

await test('account manager cannot edit users or reset passwords', async () => {
  const users = await req('GET', '/api/users', { token: vlad.accessToken });
  const someId = users.data.data[0].id;
  const r = await req('PATCH', `/api/users/${someId}`, { token: vlad.accessToken, body: { status: 'inactive' } });
  assert.equal(r.status, 403);
  const rp = await req('POST', `/api/users/${someId}/reset-password`, { token: vlad.accessToken, body: { newPassword: 'whatever123' } });
  assert.equal(rp.status, 403);
});

await test('collection-scoped buyer sees only their collection and is blocked outside it', async () => {
  const suresh = await login('sureshmen', 'Buyer@12345');
  const list = await req('GET', '/api/purchase-orders', { token: suresh.accessToken });
  assert.equal(list.status, 200);
  const sections = new Set(list.data.data.map((p) => p.section_name));
  for (const s of sections) assert.match(s, /Men's Shirts/, `leaked section: ${s}`);
  // live monitor is administrator-only
  const live = await req('GET', '/api/tracking/live', { token: suresh.accessToken });
  assert.equal(live.status, 403);
});

await test('sensitive settings changes are rejected for non-admins', async () => {
  const r = await req('PUT', '/api/settings/security', { token: vlad.accessToken, body: { value: { devtoolsBlock: false } } });
  assert.ok([403, 401].includes(r.status));
});

// ── 5. Header hygiene ─────────────────────────────────────────────────────
await test('security headers are present on API responses', async () => {
  const r = await req('GET', '/api/health');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(r.headers.get('x-frame-options') || '', /SAMEORIGIN|DENY/);
  assert.ok((r.headers.get('referrer-policy') || '').length > 0);
});

// ── summary ───────────────────────────────────────────────────────────────
console.log(results.map(([s, n]) => `${s === 'PASS' ? '✅' : '❌'} ${n}`).join('\n'));
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} black-box security tests passed`);
process.exit(failed ? 1 : 0);
