// Universal file storage — every file type accepted (PDF, Excel, Word, images,
// video, audio, zip, anything else) up to the configured size cap (§ uploads.policy).
// Files land in backend/uploads/<yyyy>/<mm>/<random>-<safe-original-name> and are
// served read-only at /uploads/<storage-key> so <img>/<video>/PDF previews work
// with plain URLs (internal LAN deployment; API list/delete endpoints stay authed).
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
export const MAX_FILE_MB = 200;

fs.mkdirSync(uploadsDir, { recursive: true });

const SAFE = /[^a-zA-Z0-9._-]+/g;
function safeName(name) {
  const base = path.basename(String(name || 'file')).replace(SAFE, '_').slice(-120);
  return base || 'file';
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const now = new Date();
    const dir = path.join(uploadsDir, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
    fs.mkdirSync(dir, { recursive: true });
    req._uploadDir = dir;
    cb(null, dir);
  },
  filename(req, file, cb) {
    const stamp = Date.now().toString(36);
    const rand = crypto.randomBytes(5).toString('hex');
    cb(null, `${stamp}${rand}-${safeName(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 20 },
});

export function publicUrl(storageKey) {
  return `/uploads/${storageKey.split(path.sep).join('/')}`;
}

export function absPath(storageKey) {
  return path.join(uploadsDir, storageKey);
}

export function removeStored(storageKey) {
  try {
    fs.unlinkSync(absPath(storageKey));
  } catch { /* already gone */ }
}
