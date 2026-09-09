// Universal file storage — every file type accepted (PDF, Excel, Word, images,
// video, audio, zip, anything else) up to the configured size cap (§ uploads.policy).
//
// Two interchangeable drivers, chosen with STORAGE_DRIVER:
//   local    (default) — backend/uploads/<yyyy>/<mm>/<random>-<name>, served
//              read-only at /uploads/<key> (single-origin deployments).
//   supabase — same local ingest, then the object is pushed to a Supabase
//              Storage bucket (env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//              SUPABASE_BUCKET) and the local copy removed. Public bucket URLs
//              are returned so a Vercel-hosted frontend renders them directly.
//
// Upload flow for route handlers is unchanged: `upload` middleware → file.path,
// publicUrl(key), removeStored(key) all switch on the active driver.
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
export const MAX_FILE_MB = 200;

const DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'poms-uploads';
export const storageDriver = DRIVER;

if (DRIVER === 'supabase' && (!SUPABASE_URL || !SUPABASE_KEY)) {
  throw new Error('STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

fs.mkdirSync(uploadsDir, { recursive: true });

const SAFE = /[^a-zA-Z0-9._-]+/g;
function safeName(name) {
  const base = path.basename(String(name || 'file')).replace(SAFE, '_').slice(-120);
  return base || 'file';
}

// ── Supabase REST helpers (no SDK dependency) ─────────────────────────────
async function sbPut(absPath, key, mime) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': mime || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: fs.createReadStream(absPath),
    duplex: 'half',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase upload failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}

async function sbDelete(key) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${key}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Supabase delete failed (${res.status})`);
  }
}

// ── multer engine: write locally, then offload to Supabase ───────────────
const engine = {
  _handleFile(req, file, cb) {
    const now = new Date();
    const dir = path.join(uploadsDir, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
    fs.mkdirSync(dir, { recursive: true });
    const stamp = Date.now().toString(36);
    const rand = crypto.randomBytes(5).toString('hex');
    const fileName = `${stamp}${rand}-${safeName(file.originalname)}`;
    const abs = path.join(dir, fileName);
    const out = fs.createWriteStream(abs);
    file.stream.pipe(out);
    out.on('error', (err) => cb(err));
    out.on('finish', async () => {
      const key = path.relative(uploadsDir, abs).split(path.sep).join('/');
      if (DRIVER === 'supabase') {
        try {
          await sbPut(abs, key, file.mimetype);
          fs.unlinkSync(abs); // ephemeral disks (Render) don't keep it anyway
        } catch (err) {
          try { fs.unlinkSync(abs); } catch { /* ignore */ }
          return cb(err);
        }
      }
      cb(null, { path: abs, size: out.bytesWritten });
    });
  },
  _removeFile(req, file) {
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }
  },
};

export const upload = multer({
  storage: engine,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 20 },
});

export function publicUrl(storageKey) {
  const key = String(storageKey).split(path.sep).join('/');
  if (DRIVER === 'supabase') {
    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${key}`;
  }
  return `/uploads/${key}`;
}

export function absPath(storageKey) {
  return path.join(uploadsDir, String(storageKey));
}

export function removeStored(storageKey) {
  const key = String(storageKey).split(path.sep).join('/');
  if (DRIVER === 'supabase') {
    sbDelete(key).catch(() => { /* best effort — object may already be gone */ });
    return;
  }
  try { fs.unlinkSync(absPath(storageKey)); } catch { /* already gone */ }
}
