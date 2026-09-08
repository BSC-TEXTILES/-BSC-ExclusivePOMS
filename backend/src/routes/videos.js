import { Router } from 'express';
import { query, pool } from '../config/db.js';
import { authenticate, requireAnyPermission } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { upload, publicUrl, removeStored, uploadsDir } from '../utils/storage.js';
import path from 'node:path';

// Video library — upload, list, detail, update, archive.
// Files are stored via the universal storage util; metadata lives in `videos`.
const r = Router();
r.use(authenticate);

const CATEGORIES = ['training', 'product', 'process', 'marketing', 'general', 'other'];

function rowPayload(row) {
  return {
    ...row,
    url: publicUrl(row.storage_key),
    thumbnailUrl: row.thumbnail_key ? publicUrl(row.thumbnail_key) : null,
  };
}

// GET /api/videos?category=&search=&status= — list (videos.view or masters.view)
r.get('/', ah(async (req, res) => {
  const { category, search, status } = req.query;
  const clauses = []; const params = [];
  if (status) { params.push(status); clauses.push(`v.status = $${params.length}`); }
  else clauses.push(`v.status <> 'archived'`);
  if (category) { params.push(category); clauses.push(`v.category = $${params.length}`); }
  if (search) { params.push(`%${search}%`); clauses.push(`(v.title ILIKE $${params.length} OR v.description ILIKE $${params.length} OR v.module ILIKE $${params.length})`); }
  const { rows } = await query(
    `SELECT v.*, u.full_name AS uploaded_by_name, u.profile_photo_url AS uploaded_by_photo
       FROM videos v LEFT JOIN users u ON u.id = v.uploaded_by
      ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
      ORDER BY v.created_at DESC LIMIT 200`, params);
  res.json({ data: rows.map(rowPayload) });
}));

// GET /api/videos/meta — categories for filters
r.get('/meta', ah(async (req, res) => {
  res.json({ data: { categories: CATEGORIES } });
}));

// GET /api/videos/:id — full detail
r.get('/:id', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT v.*, u.full_name AS uploaded_by_name, u.email AS uploaded_by_email
       FROM videos v LEFT JOIN users u ON u.id = v.uploaded_by
      WHERE v.id = $1`, [req.params.id]);
  if (!rows[0]) throw notFoundError('Video not found');
  res.json({ data: rowPayload(rows[0]) });
}));

// POST /api/videos — upload a video (multipart: file, optional thumbnail)
r.post('/', requireAnyPermission(['videos.manage', 'masters.manage']), upload.single('file'), ah(async (req, res) => {
  const { title, description, category, module, durationSeconds } = req.body || {};
  if (!req.file) throw badRequest('file is required (multipart field "file")');
  if (!title) throw badRequest('title is required');
  const mime = String(req.file.mimetype || '');
  const ext = path.extname(req.file.originalname || '').toLowerCase();
  const isVideo = mime.startsWith('video/') || ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi'].includes(ext);
  if (!isVideo) throw badRequest('Only video files are allowed (mp4, webm, mov, mkv, avi)');
  if (req.file.size > 200 * 1024 * 1024) throw badRequest('Video exceeds the 200 MB limit');

  const { rows } = await query(
    `INSERT INTO videos (title, description, category, module, file_name, mime_type, size_bytes, storage_key, duration_seconds, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [title, description || null, CATEGORIES.includes(category) ? category : 'other', module || null,
     req.file.originalname, req.file.mimetype || 'video/mp4', req.file.size,
     path.relative(uploadsDir, req.file.path).replace(/\\/g, '/'),
     durationSeconds ? Number(durationSeconds) : null, req.user.id]);
  await logAuditSafe(req, rows[0]);
  res.status(201).json({ data: rowPayload(rows[0]) });
}));

// PATCH /api/videos/:id — update metadata
r.patch('/:id', requireAnyPermission(['videos.manage', 'masters.manage']), ah(async (req, res) => {
  const before = (await query(`SELECT * FROM videos WHERE id=$1`, [req.params.id])).rows[0];
  if (!before) throw notFoundError('Video not found');
  const { title, description, category, module, status, durationSeconds } = req.body || {};
  const { rows } = await query(
    `UPDATE videos SET title=COALESCE($2,title), description=COALESCE($3,description),
            category=COALESCE($4,category), module=COALESCE($5,module), status=COALESCE($6,status)
      WHERE id=$1 RETURNING *`,
    [req.params.id, title || null, description || null,
     category && CATEGORIES.includes(category) ? category : null, module || null, status || null]);
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit', entityType: 'video', entityId: req.params.id, beforeValue: before, afterValue: rows[0] });
  res.json({ data: rowPayload(rows[0]) });
}));

// POST /api/videos/:id/thumbnail — attach a poster image
r.post('/:id/thumbnail', requireAnyPermission(['videos.manage', 'masters.manage']), upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw badRequest('file is required');
  if (!String(req.file.mimetype).startsWith('image/')) throw badRequest('Thumbnail must be an image');
  const key = path.relative(uploadsDir, req.file.path).replace(/\\/g, '/');
  const { rows } = await query(`UPDATE videos SET thumbnail_key=$2 WHERE id=$1 RETURNING *`, [req.params.id, key]);
  if (!rows[0]) throw notFoundError('Video not found');
  res.json({ data: rowPayload(rows[0]) });
}));

// DELETE /api/videos/:id — archive (RB-014 style soft delete)
r.delete('/:id', requireAnyPermission(['videos.manage', 'masters.manage']), ah(async (req, res) => {
  const before = (await query(`SELECT * FROM videos WHERE id=$1`, [req.params.id])).rows[0];
  if (!before) throw notFoundError('Video not found');
  await query(`UPDATE videos SET status='archived' WHERE id=$1`, [req.params.id]);
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'archive', entityType: 'video', entityId: req.params.id, beforeValue: { status: before.status }, afterValue: { status: 'archived' } });
  res.json({ ok: true });
}));

async function logAuditSafe(req, row) {
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'create', entityType: 'video', entityId: row.id, afterValue: { title: row.title, category: row.category } });
}

export default r;