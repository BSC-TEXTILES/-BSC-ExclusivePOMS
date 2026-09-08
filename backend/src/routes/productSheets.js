import { Router } from 'express';
import { query, withTransaction } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';

const r = Router();
r.use(authenticate);

// GET /api/product-sheets
r.get('/', ah(async (req, res) => {
  const { q, status } = req.query;
  let where = '';
  const params = [];
  if (q) { params.push(`%${q}%`); where += ` AND (sheet_code ILIKE $${params.length} OR sheet_name ILIKE $${params.length} OR color_name ILIKE $${params.length})`; }
  if (status) { params.push(status); where += ` AND status = $${params.length}`; }
  const { rows } = await query(`SELECT * FROM product_sheets WHERE 1=1${where} ORDER BY sheet_code`, params);
  res.json({ data: rows });
}));

// GET /api/product-sheets/:id
r.get('/:id', ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM product_sheets WHERE id=$1`, [req.params.id]);
  if (!rows[0]) throw notFoundError('Sheet not found');
  res.json({ data: rows[0] });
}));

// POST /api/product-sheets
r.post('/', requirePermission('masters.manage'), ah(async (req, res) => {
  const { sheetCode, sheetName, colorName, colorCode, swatchHex, finish, material, imageUrl, availability, notes } = req.body || {};
  if (!sheetCode || !sheetName) throw badRequest('Sheet code and name are required');
  const { rows } = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO product_sheets (sheet_code, sheet_name, color_name, color_code, swatch_hex, finish, material, image_url, availability, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [sheetCode, sheetName, colorName || null, colorCode || null, swatchHex || null, finish || null, material || null, imageUrl || null, availability || 'available', notes || null]);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'create',
      entityType: 'product_sheet', entityId: result.rows[0].id, afterValue: { sheetCode, sheetName },
    });
    return result;
  });
  res.status(201).json({ data: rows[0] });
}));

// PATCH /api/product-sheets/:id
r.patch('/:id', requirePermission('masters.manage'), ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM product_sheets WHERE id=$1`, [req.params.id]);
  if (!existing[0]) throw notFoundError('Sheet not found');
  const { sheetName, colorName, colorCode, swatchHex, finish, material, imageUrl, availability, notes, status } = req.body || {};
  const { rows } = await query(
    `UPDATE product_sheets SET sheet_name=COALESCE($2,sheet_name), color_name=COALESCE($3,color_name),
     color_code=COALESCE($4,color_code), swatch_hex=COALESCE($5,swatch_hex), finish=COALESCE($6,finish),
     material=COALESCE($7,material), image_url=COALESCE($8,image_url), availability=COALESCE($9,availability),
     notes=COALESCE($10,notes), status=COALESCE($11,status) WHERE id=$1 RETURNING *`,
    [req.params.id, sheetName || null, colorName || null, colorCode || null, swatchHex || null, finish || null, material || null, imageUrl || null, availability || null, notes || null, status || null]);
  res.json({ data: rows[0] });
}));

// DELETE /api/product-sheets/:id
r.delete('/:id', requirePermission('masters.manage'), ah(async (req, res) => {
  const { rows } = await query(`DELETE FROM product_sheets WHERE id=$1 RETURNING id`, [req.params.id]);
  if (!rows[0]) throw notFoundError('Sheet not found');
  res.status(204).end();
}));

export default r;
