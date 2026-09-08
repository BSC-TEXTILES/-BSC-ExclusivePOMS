import { Router } from 'express';
import { query, pool } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';

const r = Router();
r.use(authenticate);

// List product types with optional filters
r.get('/', ah(async (req, res) => {
  const { page = 1, limit = 50, search = '', sectionId = '', categoryId = '', subcategoryId = '', status = '' } = req.query;
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
  const params = [];
  const where = [];
  if (search) { params.push(`%${search}%`); where.push(`(pt.name ILIKE $${params.length} OR pt.code ILIKE $${params.length})`); }
  if (sectionId) { params.push(sectionId); where.push(`pt.section_id = $${params.length}`); }
  if (categoryId) { params.push(categoryId); where.push(`pt.category_id = $${params.length}`); }
  if (subcategoryId) { params.push(subcategoryId); where.push(`pt.subcategory_id = $${params.length}`); }
  if (status) { params.push(status); where.push(`pt.status = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await query(`SELECT count(*)::int AS total FROM product_types pt ${w}`, params);
  params.push(Number(limit)); const lim = params.length;
  params.push(offset); const off = params.length;
  const { rows } = await query(
    `SELECT pt.*, s.name AS section_name, c.name AS category_name, sc.name AS subcategory_name
     FROM product_types pt
     LEFT JOIN sections s ON s.id = pt.section_id
     LEFT JOIN categories c ON c.id = pt.category_id
     LEFT JOIN categories sc ON sc.id = pt.subcategory_id
     ${w} ORDER BY pt.name LIMIT $${lim} OFFSET $${off}`, params);
  res.json({ data: rows, total: countResult.rows[0].total });
}));

// Get single product type
r.get('/:id', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT pt.*, s.name AS section_name, c.name AS category_name, sc.name AS subcategory_name
     FROM product_types pt
     LEFT JOIN sections s ON s.id = pt.section_id
     LEFT JOIN categories c ON c.id = pt.category_id
     LEFT JOIN categories sc ON sc.id = pt.subcategory_id
     WHERE pt.id=$1`, [req.params.id]);
  if (!rows.length) throw notFoundError('Product Type');
  res.json({ data: rows[0] });
}));

// Create product type
r.post('/', requirePermission('masters.manage'), ah(async (req, res) => {
  const { sectionId, categoryId, subcategoryId, code, name } = req.body || {};
  if (!sectionId || !code || !name) throw badRequest('sectionId, code, and name are required');
  const { rows } = await query(
    `INSERT INTO product_types (section_id, category_id, subcategory_id, code, name)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [sectionId, categoryId || null, subcategoryId || null, code, name]);
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'create', entityType: 'product_type', entityId: rows[0].id, afterValue: rows[0] });
  res.status(201).json({ data: rows[0] });
}));

// Update product type
r.patch('/:id', requirePermission('masters.manage'), ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM product_types WHERE id=$1`, [req.params.id]);
  if (!existing.length) throw notFoundError('Product Type');
  const { sectionId, categoryId, subcategoryId, code, name, status } = req.body || {};
  const { rows } = await query(
    `UPDATE product_types SET section_id=COALESCE($2,section_id), category_id=COALESCE($3,category_id),
     subcategory_id=COALESCE($4,subcategory_id), code=COALESCE($5,code),
     name=COALESCE($6,name), status=COALESCE($7,status)
     WHERE id=$1 RETURNING *`,
    [req.params.id, sectionId, categoryId, subcategoryId, code, name, status]);
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit', entityType: 'product_type', entityId: req.params.id, beforeValue: existing[0], afterValue: rows[0] });
  res.json({ data: rows[0] });
}));

// Delete/archive product type
r.delete('/:id', requirePermission('masters.manage'), ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM product_types WHERE id=$1`, [req.params.id]);
  if (!existing.length) throw notFoundError('Product Type');
  await query(`UPDATE product_types SET status='archived' WHERE id=$1`, [req.params.id]);
  await logAudit(pool, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'delete', entityType: 'product_type', entityId: req.params.id, beforeValue: existing[0] });
  res.json({ data: { id: req.params.id, status: 'archived' } });
}));

export default r;
