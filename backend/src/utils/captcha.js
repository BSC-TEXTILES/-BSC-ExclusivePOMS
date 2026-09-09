// CAPTCHA generation + verification — protects the login endpoint from
// credential-stuffing bots. 5 alphanumeric characters (ambiguous glyphs like
// 0/O and 1/I excluded), rendered as a distorted SVG, valid for a single
// attempt for 30 seconds.
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
export { ALPHABET };
export const CAPTCHA_TTL_MS = 30 * 1000;

const store = new Map(); // id -> { answer, expiresAt, attempts }
let issuedCount = 0;
let solvedCount = 0;

function sweep() {
  const now = Date.now();
  for (const [id, c] of store) if (c.expiresAt < now) store.delete(id);
}
setInterval(sweep, 15000).unref();

export function captchaStats() {
  return { live: store.size, issued: issuedCount, solved: solvedCount };
}

// ── generator ────────────────────────────────────────────────────────────
// ttlMs is overridable for unit tests; production always uses 30 seconds.
export function generateCaptcha(length = 5, ttlMs = CAPTCHA_TTL_MS) {
  sweep();
  const chars = [];
  for (let i = 0; i < length; i++) {
    chars.push(ALPHABET[crypto.randomInt(0, ALPHABET.length)]);
  }
  const answer = chars.join('');
  const id = crypto.randomUUID();
  store.set(id, { answer, expiresAt: Date.now() + ttlMs, attempts: 0 });
  issuedCount += 1;
  return { id, answer, svg: renderSvg(chars) };
}

// ── verifier ─────────────────────────────────────────────────────────────
// Single-use: any check consumes the challenge (new one must be fetched).
export function verifyCaptcha(id, text) {
  const record = id && store.get(String(id));
  if (!record) return { ok: false, reason: 'expired' };
  store.delete(id);
  if (Date.now() > record.expiresAt) return { ok: false, reason: 'expired' };
  const norm = String(text || '').trim().toUpperCase();
  if (norm === record.answer) {
    solvedCount += 1;
    return { ok: true };
  }
  return { ok: false, reason: 'mismatch' };
}

// ── SVG renderer (no dependencies — distorted text + noise lines) ────────
function renderSvg(chars) {
  const W = 180, H = 54;
  const parts = [];
  const colors = ['#17324d', '#b98a2f', '#2563eb', '#16a34a', '#7c3aed'];
  const slot = W / (chars.length + 1);
  chars.forEach((ch, i) => {
    const x = slot * (i + 1) + crypto.randomInt(-6, 7);
    const y = H / 2 + crypto.randomInt(-5, 6);
    const rot = crypto.randomInt(-22, 23);
    const size = crypto.randomInt(26, 33);
    const color = colors[crypto.randomInt(0, colors.length)];
    parts.push(
      `<text x="${x}" y="${y}" font-family="Georgia, serif" font-size="${size}" font-weight="700" ` +
      `fill="${color}" text-anchor="middle" dominant-baseline="central" ` +
      `transform="rotate(${rot} ${x} ${y})">${ch}</text>`,
    );
  });
  for (let i = 0; i < 4; i++) {
    const x1 = crypto.randomInt(0, W), y1 = crypto.randomInt(0, H);
    const x2 = crypto.randomInt(0, W), y2 = crypto.randomInt(0, H);
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="1" opacity=".55"/>`);
  }
  for (let i = 0; i < 14; i++) {
    parts.push(`<circle cx="${crypto.randomInt(0, W)}" cy="${crypto.randomInt(0, H)}" r="1.4" fill="#64748b" opacity=".5"/>`);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" rx="8" fill="#f1f5f9"/>${parts.join('')}</svg>`
  );
}
