import { Router } from 'express';
import path from 'node:path';
import { query, withTransaction, pool } from '../config/db.js';
import { authenticate, requirePermission, scopeDivision } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { upload, publicUrl, removeStored, uploadsDir, fileStorageKey } from '../utils/storage.js';

// Uploads + attachment drawers — accepts EVERY file type (images, PDF, Excel,
// Word, video, audio, archives, anything else) up to uploads.policy maxSizeMb.
const r = Router();
r.use(authenticate);

function filePayload(file) {
  const storageKey = fileStorageKey(file.path);
  return {
    fileName: file.originalname,
    mimeType: file.mimetype || 'application/octet-stream',
    sizeBytes: file.size,
    storageKey,
    url: publicUrl(storageKey),
  };
}

// POST /api/uploads — generic single-file drop; returns metadata for later linking
r.post('/uploads', upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw badRequest('file is required (multipart field "file")');
  res.status(201).json({ data: filePayload(req.file) });
}));

// POST /api/uploads/bulk — up to 20 files at once
r.post('/uploads/bulk', upload.array('files', 20), ah(async (req, res) => {
  if (!req.files?.length) throw badRequest('files are required (multipart field "files")');
  res.status(201).json({ data: req.files.map(filePayload) });
}));

// ---------- PRODUCT IMAGE GALLERY ----------
r.get('/products/:id/images', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT id, file_name, mime_type, size_bytes, storage_key, is_primary, sort_order, uploaded_at
       FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order, uploaded_at`,
    [req.params.id]);
  res.json({ data: rows.map((x) => ({ ...x, url: publicUrl(x.storage_key) })) });
}));

r.post('/products/:id/images', requirePermission('masters.manage'), upload.array('files', 20), ah(async (req, res) => {
  if (!req.files?.length) throw badRequest('files are required (multipart field "files")');
  const product = (await query(`SELECT id FROM products WHERE id=$1`, [req.params.id])).rows[0];
  if (!product) throw badRequest('Product not found');
  const saved = await withTransaction(async (client) => {
    const { rows: [{ count }] } = await client.query(
      `SELECT count(*)::int AS count FROM product_images WHERE product_id=$1`, [req.params.id]);
    const out = [];
    let order = count;
    for (const f of req.files) {
      const p = filePayload(f);
      const { rows } = await client.query(
        `INSERT INTO product_images (product_id, file_name, mime_type, size_bytes, storage_key, is_primary, sort_order, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, file_name, is_primary`,
        [req.params.id, p.fileName, p.mimeType, p.sizeBytes, p.storageKey, count === 0 && order === 0, order++, req.user.id]);
      out.push({ ...rows[0], ...p });
    }
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'upload', entityType: 'product_image',
      entityId: req.params.id, afterValue: { files: out.map((o) => o.fileName) },
    });
    return out;
  });
  res.status(201).json({ data: saved });
}));

r.patch('/products/:productId/images/:imageId/primary', requirePermission('masters.manage'), ah(async (req, res) => {
  await withTransaction(async (client) => {
    await client.query(`UPDATE product_images SET is_primary=false WHERE product_id=$1`, [req.params.productId]);
    await client.query(`UPDATE product_images SET is_primary=true WHERE id=$1 AND product_id=$2`, [req.params.imageId, req.params.productId]);
  });
  res.json({ ok: true });
}));

r.delete('/products/:productId/images/:imageId', requirePermission('masters.manage'), ah(async (req, res) => {
  const { rows } = await query(
    `DELETE FROM product_images WHERE id=$1 AND product_id=$2 RETURNING storage_key`,
    [req.params.imageId, req.params.productId]);
  if (!rows[0]) throw notFoundError('Image not found');
  removeStored(rows[0].storage_key);
  res.status(204).end();
}));

// ---------- PURCHASE ORDER ATTACHMENTS (any file type) ----------
r.get('/purchase-orders/:id/attachments', ah(async (req, res) => {
  const po = (await query(`SELECT division_id FROM purchase_orders WHERE id=$1`, [req.params.id])).rows[0];
  if (!po) throw notFoundError('Purchase order not found');
  scopeDivision(req, po.division_id);
  const { rows } = await query(
    `SELECT a.*, u.full_name AS uploaded_by_name
       FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by
      WHERE a.entity_type='purchase_order' AND a.entity_id=$1
      ORDER BY a.uploaded_at DESC`, [req.params.id]);
  res.json({ data: rows.map((x) => ({ ...x, url: publicUrl(x.storage_key) })) });
}));

r.post('/purchase-orders/:id/attachments', upload.array('files', 20), ah(async (req, res) => {
  const po = (await query(`SELECT id, division_id FROM purchase_orders WHERE id=$1`, [req.params.id])).rows[0];
  if (!po) throw badRequest('Purchase order not found');
  scopeDivision(req, po.division_id);
  if (!req.files?.length) throw badRequest('files are required (multipart field "files")');
  const saved = await withTransaction(async (client) => {
    const out = [];
    for (const f of req.files) {
      const p = filePayload(f);
      const { rows } = await client.query(
        `INSERT INTO attachments (entity_type, entity_id, file_name, mime_type, size_bytes, storage_key, uploaded_by)
         VALUES ('purchase_order',$1,$2,$3,$4,$5,$6) RETURNING id, file_name, mime_type, size_bytes, uploaded_at`,
        [req.params.id, p.fileName, p.mimeType, p.sizeBytes, p.storageKey, req.user.id]);
      out.push({ ...rows[0], url: p.url });
    }
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'upload', entityType: 'po_attachment',
      entityId: req.params.id, divisionId: po.division_id, afterValue: { files: out.map((o) => o.fileName) },
    });
    return out;
  });
  res.status(201).json({ data: saved });
}));

r.delete('/attachments/:id', ah(async (req, res) => {
  const row = (await query(`SELECT * FROM attachments WHERE id=$1`, [req.params.id])).rows[0];
  if (!row) throw notFoundError('Attachment not found');
  if (row.entity_type === 'purchase_order') scopeDivision(req, (await query(`SELECT division_id FROM purchase_orders WHERE id=$1`, [row.entity_id])).rows[0]?.division_id);
  if (String(row.uploaded_by) !== req.user.id && !req.user.isSuperAdmin && !req.user.permissions.includes('po.approve')) {
    throw badRequest('Only the uploader, an approver or a super admin can remove an attachment');
  }
  await query(`DELETE FROM attachments WHERE id=$1`, [req.params.id]);
  removeStored(row.storage_key);
  res.status(204).end();
}));

// ---------- USER PROFILE PHOTO ----------
async function setPhoto(userId, file, actor) {
  if (!file) throw badRequest('file is required (multipart field "file")');
  if (!String(file.mimetype).startsWith('image/')) throw badRequest('Profile photo must be an image');
  const p = filePayload(file);
  const { rows } = await query(
    `UPDATE users SET profile_photo_url=$2, updated_at=now() WHERE id=$1 RETURNING profile_photo_url`,
    [userId, p.url]);
  if (!rows[0]) throw notFoundError('User not found');
  await logAudit(pool, {
    userId: actor.id, role: actor.roles.join(','), actionType: 'edit', entityType: 'user', entityId: userId,
    afterValue: { profile_photo_url: p.url },
  });
  return rows[0].profile_photo_url;
}

// Self-service photo (any signed-in user)
r.post('/users/me/photo', upload.single('file'), ah(async (req, res) => {
  const url = await setPhoto(req.user.id, req.file, req.user);
  res.json({ data: { profilePhotoUrl: url } });
}));

// Admin sets anyone's photo
r.post('/users/:id/photo', requirePermission('users.manage'), upload.single('file'), ah(async (req, res) => {
  const url = await setPhoto(req.params.id, req.file, req.user);
  res.json({ data: { profilePhotoUrl: url } });
}));

export default r;
