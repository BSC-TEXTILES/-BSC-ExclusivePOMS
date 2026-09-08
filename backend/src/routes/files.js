import { Router } from 'express';
import path from 'node:path';
import { query, withTransaction } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { upload, publicUrl, removeStored, uploadsDir } from '../utils/storage.js';

const r = Router();
r.use(authenticate);

function filePayload(file) {
  const storageKey = path.relative(uploadsDir, file.path);
  return {
    fileName: file.originalname,
    mimeType: file.mimetype || 'application/octet-stream',
    sizeBytes: file.size,
    storageKey,
    url: publicUrl(storageKey),
  };
}

// GET /api/files — list all file attachments
r.get('/', ah(async (req, res) => {
  const { search, mime, page = 1, limit = 50 } = req.query;
  const params = [];
  const clauses = [];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(f.file_name ILIKE $${params.length} OR f.description ILIKE $${params.length})`);
  }
  if (mime) {
    params.push(`${mime}%`);
    clauses.push(`f.mime_type ILIKE $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

  const countRow = (await query(
    `SELECT count(*)::int AS total FROM file_attachments f ${where}`, params
  )).rows[0];

  params.push(Number(limit), offset);
  const { rows } = await query(
    `SELECT f.*, u.full_name AS uploaded_by_name
       FROM file_attachments f
       LEFT JOIN users u ON u.id = f.uploaded_by
      ${where}
      ORDER BY f.uploaded_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`, params
  );

  res.json({
    data: rows.map((x) => ({ ...x, url: publicUrl(x.storage_key) })),
    total: countRow.total,
    page: Number(page),
    limit: Number(limit),
  });
}));

// POST /api/files — upload files (up to 20)
r.post('/', requirePermission('masters.manage'), upload.array('files', 20), ah(async (req, res) => {
  if (!req.files?.length) throw badRequest('files are required (multipart field "files")');
  const { description } = req.body || {};

  const saved = await withTransaction(async (client) => {
    const out = [];
    for (const f of req.files) {
      const p = filePayload(f);
      const { rows } = await client.query(
        `INSERT INTO file_attachments (file_name, mime_type, size_bytes, storage_key, description, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, file_name, mime_type, size_bytes, uploaded_at`,
        [p.fileName, p.mimeType, p.sizeBytes, p.storageKey, description || null, req.user.id]
      );
      out.push({ ...rows[0], url: p.url });
    }
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','),
      actionType: 'upload', entityType: 'file_attachment',
      entityId: req.user.id,
      afterValue: { files: out.map((o) => o.fileName) },
    });
    return out;
  });

  res.status(201).json({ data: saved });
}));

// DELETE /api/files/:id — delete a file
r.delete('/:id', requirePermission('masters.manage'), ah(async (req, res) => {
  const row = (await query(`SELECT * FROM file_attachments WHERE id=$1`, [req.params.id])).rows[0];
  if (!row) throw notFoundError('File not found');
  await query(`DELETE FROM file_attachments WHERE id=$1`, [req.params.id]);
  removeStored(row.storage_key);
  res.status(204).end();
}));

export default r;
