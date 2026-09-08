import { Router } from 'express';
import { query, pool } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';

const r = Router();
r.use(authenticate);

// List locations
r.get('/', ah(async (req, res) => {
  const { page = 1, limit = 50, search = '', status = '' } = req.query;
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
  const params = [];
  const where = [];
  if (search) { params.push(`%${search}%`); where.push(`(l.name ILIKE $${params.length} OR l.code ILIKE $${params.length} OR l.city ILIKE $${params.length})`); }
  if (status) { params.push(status); where.push(`l.status = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await query(`SELECT count(*)::int AS total FROM locations l ${w}`, params);
  params.push(Number(limit)); const lim = params.length;
  params.push(offset); const off = params.length;
  const { rows } = await query(
    `SELECT l.*, (SELECT count(*)::int FROM purchase_orders po WHERE po.location_id = l.id) AS order_count
     FROM locations l ${w} ORDER BY l.name LIMIT $${lim} OFFSET $${off}`, params);
  res.json({ data: rows, total: countResult.rows[0].total });
}));

// Get single location
r.get('/:id', ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM locations WHERE id=$1`, [req.params.id]);
  if (!rows.length) throw notFoundError('Location');
  res.json({ data: rows[0] });
}));

// Create location
r.post('/', requirePermission('masters.manage'), ah(async (req, res) => {
  const { code, name, address, city, state, country, latitude, longitude, contactPerson, phone, notes } = req.body || {};
  if (!code || !name) throw badRequest('code and name are required');
  const { rows } = await query(
    `INSERT INTO locations (code, name, address, city, state, country, latitude, longitude, contact_person, phone, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [code, name, address || null, city || null, state || null, country || 'India',
     latitude || null, longitude || null, contactPerson || null, phone || null, notes || null]);
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'create', entityType: 'location', entityId: rows[0].id, afterValue: rows[0] });
  res.status(201).json({ data: rows[0] });
}));

// Update location
r.patch('/:id', requirePermission('masters.manage'), ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM locations WHERE id=$1`, [req.params.id]);
  if (!existing.length) throw notFoundError('Location');
  const { code, name, address, city, state, country, latitude, longitude, contactPerson, phone, notes, status } = req.body || {};
  const { rows } = await query(
    `UPDATE locations SET code=COALESCE($2,code), name=COALESCE($3,name), address=COALESCE($4,address),
     city=COALESCE($5,city), state=COALESCE($6,state), country=COALESCE($7,country),
     latitude=COALESCE($8,latitude), longitude=COALESCE($9,longitude),
     contact_person=COALESCE($10,contact_person), phone=COALESCE($11,phone),
     notes=COALESCE($12,notes), status=COALESCE($13,status)
     WHERE id=$1 RETURNING *`,
    [req.params.id, code, name, address, city, state, country, latitude, longitude, contactPerson, phone, notes, status]);
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit', entityType: 'location', entityId: req.params.id, beforeValue: existing[0], afterValue: rows[0] });
  res.json({ data: rows[0] });
}));

// Delete/archive location
r.delete('/:id', requirePermission('masters.manage'), ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM locations WHERE id=$1`, [req.params.id]);
  if (!existing.length) throw notFoundError('Location');
  await query(`UPDATE locations SET status='archived' WHERE id=$1`, [req.params.id]);
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'delete', entityType: 'location', entityId: req.params.id, beforeValue: existing[0] });
  res.json({ data: { id: req.params.id, status: 'archived' } });
}));

export default r;
