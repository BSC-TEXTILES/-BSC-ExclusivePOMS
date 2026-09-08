import { Router } from 'express';
import { query, withTransaction } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';

const r = Router();
r.use(authenticate);

// GET /api/customers — list with search
r.get('/', ah(async (req, res) => {
  const { q, status, page = 1, limit = 50 } = req.query;
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
  const params = [];
  let where = '';
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (c.name ILIKE $${params.length} OR c.company ILIKE $${params.length} OR c.contact_person ILIKE $${params.length} OR c.customer_code ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.email ILIKE $${params.length})`;
  }
  if (status) {
    params.push(status);
    where += ` AND c.status = $${params.length}`;
  }
  const countParams = [...params];
  params.push(Number(limit), offset);
  const { rows: [{ count }] } = await query(`SELECT count(*)::int FROM customers c WHERE 1=1${where}`, countParams);
  const { rows } = await query(
    `SELECT c.* FROM customers c WHERE 1=1${where} ORDER BY c.name LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ data: rows, total: count, page: Number(page), limit: Number(limit) });
}));

// GET /api/customers/:id
r.get('/:id', ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM customers WHERE id=$1`, [req.params.id]);
  if (!rows[0]) throw notFoundError('Customer not found');
  res.json({ data: rows[0] });
}));

// POST /api/customers
r.post('/', requirePermission('masters.manage'), ah(async (req, res) => {
  const { name, company, contactPerson, phone, email, address, city, state, country, postalCode, gstNumber, panNumber, taxInfo, notes } = req.body || {};
  if (!name) throw badRequest('Customer name is required');
  const { rows: [{ count }] } = await query(`SELECT count(*)::int FROM customers`);
  const code = `CUST-${String(count + 1).padStart(4, '0')}`;
  const { rows } = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO customers (customer_code, name, company, contact_person, phone, email, address, city, state, country, postal_code, gst_number, pan_number, tax_info, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [code, name, company || null, contactPerson || null, phone || null, email || null, address || null, city || null, state || null, country || 'India', postalCode || null, gstNumber || null, panNumber || null, taxInfo || null, notes || null]);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'create',
      entityType: 'customer', entityId: result.rows[0].id, afterValue: { name, code },
    });
    return result;
  });
  res.status(201).json({ data: rows[0] });
}));

// PATCH /api/customers/:id
r.patch('/:id', requirePermission('masters.manage'), ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM customers WHERE id=$1`, [req.params.id]);
  if (!existing[0]) throw notFoundError('Customer not found');
  const { name, company, contactPerson, phone, email, address, city, state, country, postalCode, gstNumber, panNumber, taxInfo, notes, status } = req.body || {};
  const { rows } = await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE customers SET name=COALESCE($2,name), company=COALESCE($3,company), contact_person=COALESCE($4,contact_person),
       phone=COALESCE($5,phone), email=COALESCE($6,email), address=COALESCE($7,address), city=COALESCE($8,city),
       state=COALESCE($9,state), country=COALESCE($10,country), postal_code=COALESCE($11,postal_code),
       gst_number=COALESCE($12,gst_number), pan_number=COALESCE($13,pan_number), tax_info=COALESCE($14,tax_info),
       notes=COALESCE($15,notes), status=COALESCE($16,status) WHERE id=$1 RETURNING *`,
      [req.params.id, name || null, company || null, contactPerson || null, phone || null, email || null, address || null, city || null, state || null, country || null, postalCode || null, gstNumber || null, panNumber || null, taxInfo || null, notes || null, status || null]);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit',
      entityType: 'customer', entityId: req.params.id, beforeValue: existing[0], afterValue: result.rows[0],
    });
    return result;
  });
  res.json({ data: rows[0] });
}));

// DELETE /api/customers/:id (soft delete)
r.delete('/:id', requirePermission('masters.manage'), ah(async (req, res) => {
  const { rows } = await query(`UPDATE customers SET status='inactive' WHERE id=$1 AND status='active' RETURNING id`, [req.params.id]);
  if (!rows[0]) throw notFoundError('Customer not found');
  res.status(204).end();
}));

export default r;
