import { Router } from 'express';
import { query, pool } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';

const r = Router();
r.use(authenticate);

// List manufacturers with pagination + search
r.get('/', ah(async (req, res) => {
  const { page = 1, limit = 20, search = '', status = '' } = req.query;
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
  const params = [];
  const where = [];
  if (search) { params.push(`%${search}%`); where.push(`(m.name ILIKE $${params.length} OR m.code ILIKE $${params.length})`); }
  if (status) { params.push(status); where.push(`m.status = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await query(`SELECT count(*)::int AS total FROM manufacturers m ${w}`, params);
  params.push(Number(limit)); const lim = params.length;
  params.push(offset); const off = params.length;
  const { rows } = await query(
    `SELECT m.*, (SELECT count(*)::int FROM product_manufacturers pm WHERE pm.manufacturer_id = m.id) AS product_count
     FROM manufacturers m ${w} ORDER BY m.name LIMIT $${lim} OFFSET $${off}`, params);
  res.json({ data: rows, total: countResult.rows[0].total, page: Number(page), limit: Number(limit) });
}));

// Get single manufacturer
r.get('/:id', ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM manufacturers WHERE id=$1`, [req.params.id]);
  if (!rows.length) throw notFoundError('Manufacturer');
  res.json({ data: rows[0] });
}));

// Create manufacturer
r.post('/', requirePermission('manufacturers.manage'), ah(async (req, res) => {
  const { code, name, contactPerson, phone, email, address, city, state, country, gstin, notes } = req.body || {};
  if (!code || !name) throw badRequest('code and name are required');
  const { rows } = await query(
    `INSERT INTO manufacturers (code, name, contact_person, phone, email, address, city, state, country, gstin, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [code, name, contactPerson || null, phone || null, email || null, address || null,
     city || null, state || null, country || 'India', gstin || null, notes || null]);
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'create', entityType: 'manufacturer', entityId: rows[0].id, afterValue: rows[0] });
  res.status(201).json({ data: rows[0] });
}));

// Update manufacturer
r.patch('/:id', requirePermission('manufacturers.manage'), ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM manufacturers WHERE id=$1`, [req.params.id]);
  if (!existing.length) throw notFoundError('Manufacturer');
  const { code, name, contactPerson, phone, email, address, city, state, country, gstin, notes, status } = req.body || {};
  const { rows } = await query(
    `UPDATE manufacturers SET code=COALESCE($2,code), name=COALESCE($3,name), contact_person=COALESCE($4,contact_person),
     phone=COALESCE($5,phone), email=COALESCE($6,email), address=COALESCE($7,address),
     city=COALESCE($8,city), state=COALESCE($9,state), country=COALESCE($10,country),
     gstin=COALESCE($11,gstin), notes=COALESCE($12,notes), status=COALESCE($13,status)
     WHERE id=$1 RETURNING *`,
    [req.params.id, code, name, contactPerson, phone, email, address, city, state, country, gstin, notes, status]);
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit', entityType: 'manufacturer', entityId: req.params.id, beforeValue: existing[0], afterValue: rows[0] });
  res.json({ data: rows[0] });
}));

// Delete/archive manufacturer
r.delete('/:id', requirePermission('manufacturers.manage'), ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM manufacturers WHERE id=$1`, [req.params.id]);
  if (!existing.length) throw notFoundError('Manufacturer');
  await query(`UPDATE manufacturers SET status='archived' WHERE id=$1`, [req.params.id]);
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'delete', entityType: 'manufacturer', entityId: req.params.id, beforeValue: existing[0] });
  res.json({ data: { id: req.params.id, status: 'archived' } });
}));

export default r;
