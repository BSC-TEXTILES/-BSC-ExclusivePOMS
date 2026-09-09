// Unit tests (white box) — run with:  node backend/tests/unit.test.mjs
// Exercises the CAPTCHA module and the audit UUID normaliser directly.
import assert from 'node:assert/strict';
import { generateCaptcha, verifyCaptcha, captchaStats, ALPHABET } from '../src/utils/captcha.js';
import { logAudit } from '../src/utils/audit.js';

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', `${name} — ${e.message}`]); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await test('captcha is 5 characters from the unambiguous alphabet', () => {
  const c = generateCaptcha();
  assert.equal(c.answer.length, 5);
  for (const ch of c.answer) assert.ok(ALPHABET.includes(ch), `char ${ch} not in alphabet`);
});

await test('captcha alphabet excludes ambiguous glyphs (I, O, 0, 1)', () => {
  for (const bad of ['I', 'O', '0', '1']) assert.ok(!ALPHABET.includes(bad));
});

await test('captcha SVG embeds all characters and noise', () => {
  const c = generateCaptcha();
  assert.ok(c.svg.startsWith('<svg'), 'must be an SVG document');
  for (const ch of c.answer) assert.ok(c.svg.includes(`>${ch}<`), `svg missing char ${ch}`);
  assert.ok(c.svg.includes('<line'), 'must include noise lines');
});

await test('verification fails on wrong answer and consumes the challenge', () => {
  const c = generateCaptcha();
  const r1 = verifyCaptcha(c.id, 'WRONG');
  assert.equal(r1.ok, false);
  const r2 = verifyCaptcha(c.id, c.answer); // single-use: already consumed
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'expired', 'consumed challenge must read as expired/used');
});

await test('verification is case-insensitive and trims whitespace', () => {
  const c = generateCaptcha();
  const r = verifyCaptcha(c.id, `  ${c.answer.toLowerCase()}  `);
  assert.equal(r.ok, true);
});

await test('verification rejects unknown ids', () => {
  const r = verifyCaptcha('not-a-real-id', 'AAAAA');
  assert.equal(r.ok, false);
});

await test('expired challenges are rejected (TTL override, ~70ms)', async () => {
  const c = generateCaptcha(5, 40);
  await sleep(70);
  const r = verifyCaptcha(c.id, c.answer);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'expired');
});

await test('stats track issuance and solutions', () => {
  const before = captchaStats();
  const c = generateCaptcha();
  verifyCaptcha(c.id, c.answer);
  const after = captchaStats();
  assert.equal(after.issued, before.issued + 1);
  assert.equal(after.solved, before.solved + 1);
});

await test('audit writer maps non-UUID entity ids to stable UUIDs', async () => {
  const captured = [];
  const fakeClient = { query: async (sql, params) => { captured.push(params); } };
  await logAudit(fakeClient, { actionType: 'edit', entityType: 'setting', entityId: 'security' });
  await logAudit(fakeClient, { actionType: 'edit', entityType: 'setting', entityId: 'security' });
  await logAudit(fakeClient, { actionType: 'edit', entityType: 'user', entityId: 'fbf5f06e-6fa7-4f9f-b6bd-142bffc7f326' });
  const [a, b, real] = captured;
  assert.equal(a[6], b[6], 'same natural key must yield the same audit uuid');
  assert.notEqual(a[6], real[6], 'natural-key uuid must differ from a real row uuid');
});

const rows = results.map(([s, n]) => `${s === 'PASS' ? '✅' : '❌'} ${n}`);
console.log(rows.join('\n'));
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} unit tests passed`);
process.exit(failed ? 1 : 0);
