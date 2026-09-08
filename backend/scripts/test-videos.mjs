import 'dotenv/config';

const BASE = 'http://localhost:4040/api';
let token = null;
let failures = 0;

async function req(method, path, body, expect = 200) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ok = res.status === expect;
  if (!ok) {
    failures++;
    const text = await res.text();
    console.log(`FAIL ${method} ${path} → ${res.status} (expected ${expect}): ${text.slice(0, 200)}`);
  } else {
    console.log(`PASS ${method} ${path} → ${res.status}`);
  }
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}

// Login
const login = await req('POST', '/auth/login', { identifier: 'admin@bsc.local', password: 'Admin@123' });
token = login.json?.accessToken;
if (!token) { console.log('LOGIN FAILED'); process.exit(1); }

// Videos list (empty state)
const list = await req('GET', '/videos');
console.log('Videos count:', list.json?.data?.length);

// Videos meta
await req('GET', '/videos/meta');

// Create a tiny valid mp4-ish file (backend validates by extension/mime, not content)
const boundary = '----pomsboundary' + Date.now();
const fileContent = Buffer.from('fake-video-content-for-testing');
const parts = [];
parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nTest Training Video\r\n`));
parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\nE2E test video\r\n`));
parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\ntraining\r\n`));
parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="module"\r\n\r\npurchase_orders\r\n`));
parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.mp4"\r\nContent-Type: video/mp4\r\n\r\n`));
parts.push(fileContent);
parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
const body = Buffer.concat(parts);

const upRes = await fetch(BASE + '/videos', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
  body,
});
const upJson = await upRes.json().catch(() => null);
if (upRes.status === 201) {
  console.log(`PASS POST /videos → 201 (id: ${upJson.data.id})`);
  const vidId = upJson.data.id;
  await req('GET', `/videos/${vidId}`);
  await req('PATCH', `/videos/${vidId}`, { title: 'Updated Title', description: 'Updated desc' });
  await req('DELETE', `/videos/${vidId}`);
  // Verify archived video no longer in default list
  const after = await req('GET', '/videos');
  const stillThere = (after.json?.data || []).some((v) => v.id === vidId);
  if (stillThere) { failures++; console.log('FAIL: archived video still visible in list'); }
  else console.log('PASS: archived video removed from list');
} else {
  failures++;
  console.log(`FAIL POST /videos → ${upRes.status}: ${JSON.stringify(upJson).slice(0, 300)}`);
}

// 404 route check (SPA fallback should serve HTML, not JSON 404)
const spa = await fetch('http://localhost:4040/videos');
console.log(spa.status === 200 ? 'PASS GET /videos (SPA fallback) → 200' : `FAIL GET /videos → ${spa.status}`);
if (spa.status !== 200) failures++;

console.log(failures === 0 ? '\nALL VIDEO CHECKS PASSED' : `\n${failures} VIDEO CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);