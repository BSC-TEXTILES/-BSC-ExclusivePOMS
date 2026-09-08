import { Router } from 'express';
import { query, withTransaction, pool } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { notifyUsers, notifyRole } from '../utils/notify.js';

const r = Router();
r.use(authenticate);

function nextOrderNumber(cs) {
  const yr = new Date().getFullYear();
  if (cs.order_seq_year !== yr) {
    return { number: `${cs.order_prefix}-${yr}-000001`, year: yr, current: 1 };
  }
  const next = cs.order_seq_current + 1;
  return { number: `${cs.order_prefix}-${yr}-${String(next).padStart(6, '0')}`, year: cs.order_seq_year, current: next };
}

// GET /api/om-orders — list with filters
r.get('/', ah(async (req, res) => {
  const { q, status, customerId, supervisorId, createdBy, priority, from, to, page = 1, limit = 50 } = req.query;
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
  const params = [];
  let where = ' WHERE 1=1';
  if (q) { params.push(`%${q}%`); where += ` AND (o.order_number ILIKE $${params.length} OR c.name ILIKE $${params.length})`; }
  if (status) { params.push(status); where += ` AND o.status = $${params.length}`; }
  if (customerId) { params.push(customerId); where += ` AND o.customer_id = $${params.length}`; }
  if (supervisorId) { params.push(supervisorId); where += ` AND o.assigned_supervisor_id = $${params.length}`; }
  if (createdBy) { params.push(createdBy); where += ` AND o.created_by = $${params.length}`; }
  if (priority) { params.push(priority); where += ` AND o.priority = $${params.length}`; }
  if (from) { params.push(from); where += ` AND o.order_date >= $${params.length}::date`; }
  if (to) { params.push(to); where += ` AND o.order_date <= $${params.length}::date`; }
  const countParams = [...params];
  params.push(Number(limit), offset);
  const { rows: [{ count }] } = await query(
    `SELECT count(*)::int FROM om_orders o LEFT JOIN customers c ON c.id = o.customer_id${where}`, countParams);
  const { rows } = await query(
    `SELECT o.*, c.name AS customer_name, c.company AS customer_company, c.phone AS customer_phone,
            u.full_name AS created_by_name, su.full_name AS supervisor_name
     FROM om_orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     LEFT JOIN users u ON u.id = o.created_by
     LEFT JOIN users su ON su.id = o.assigned_supervisor_id
     ${where} ORDER BY o.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ data: rows, total: count, page: Number(page), limit: Number(limit) });
}));

// GET /api/om-orders/:id — full detail with items
r.get('/:id', ah(async (req, res) => {
  const { rows: orders } = await query(
    `SELECT o.*, c.name AS customer_name, c.company AS customer_company, c.contact_person, c.phone AS customer_phone,
            c.email AS customer_email, c.address AS customer_address, c.city AS customer_city, c.state AS customer_state,
            c.gst_number AS customer_gst,
            u.full_name AS created_by_name, su.full_name AS supervisor_name
     FROM om_orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     LEFT JOIN users u ON u.id = o.created_by
     LEFT JOIN users su ON su.id = o.assigned_supervisor_id
     WHERE o.id = $1`, [req.params.id]);
  if (!orders[0]) throw notFoundError('Order not found');
  const { rows: items } = await query(
    `SELECT i.*, p.name AS product_name, p.sku AS product_code,
            ps.sheet_name, ps.color_name, ps.swatch_hex, ps.sheet_code,
            img.storage_key AS image_storage_key
     FROM om_order_items i
     LEFT JOIN products p ON p.id = i.product_id
     LEFT JOIN product_sheets ps ON ps.id = i.sheet_id
     LEFT JOIN product_images img ON img.product_id = i.product_id AND img.is_primary = true
     WHERE i.order_id = $1 ORDER BY i.line_no`, [req.params.id]);
  const { rows: history } = await query(
    `SELECT h.*, u.full_name AS changed_by_name
     FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.order_id = $1 ORDER BY h.changed_at`, [req.params.id]);
  const { rows: pdfs } = await query(
    `SELECT * FROM pdf_documents WHERE order_id = $1 ORDER BY version DESC`, [req.params.id]);
  res.json({ data: { ...orders[0], items, history, pdfs } });
}));

// POST /api/om-orders — create order
r.post('/', ah(async (req, res) => {
  const { customerId, requiredDate, priority, notes, items = [] } = req.body || {};
  if (!customerId) throw badRequest('Customer is required');
  if (!items.length) throw badRequest('At least one order item is required');
  for (const item of items) {
    if (!item.productId) throw badRequest('Product is required for each item');
    if (!item.sizeLabel) throw badRequest('Size is required for each item');
    if (!item.quantity || item.quantity < 1) throw badRequest('Quantity must be at least 1');
  }
  const cs = (await query(`SELECT * FROM company_settings LIMIT 1`)).rows[0];
  if (!cs) throw badRequest('Company settings not configured');
  const num = nextOrderNumber(cs);
  const order = await withTransaction(async (client) => {
    let subtotal = 0;
    const orderItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const taxAmt = Number(item.quantity) * Number(item.unitPrice || 0) * Number(item.taxPercent || 0) / 100;
      const total = Number(item.quantity) * Number(item.unitPrice || 0) + taxAmt - Number(item.discountValue || 0);
      subtotal += total;
      orderItems.push({ ...item, lineNo: i + 1, taxAmount: taxAmt, total });
    }
    const taxTotal = orderItems.reduce((s, it) => s + it.taxAmount, 0);
    const discountTotal = orderItems.reduce((s, it) => s + Number(it.discountValue || 0), 0);
    const { rows: [ord] } = await client.query(
      `INSERT INTO om_orders (order_number, customer_id, order_date, required_date, created_by, priority, status, notes, subtotal, tax_amount, discount_amount, grand_total)
       VALUES ($1,$2,current_date,$3,$4,$5,'draft',$6,$7,$8,$9,$10) RETURNING *`,
      [num.number, customerId, requiredDate || null, req.user.id, priority || 'normal', notes || null, subtotal, taxTotal, discountTotal, subtotal]);
    for (const it of orderItems) {
      const prod = (await client.query(`SELECT name, sku FROM products WHERE id=$1`, [it.productId])).rows[0];
      await client.query(
        `INSERT INTO om_order_items (order_id, line_no, product_id, product_snapshot, description, sheet_id, size_label, quantity, unit_price, tax_percent, tax_amount, discount_type, discount_value, total, production_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [ord.id, it.lineNo, it.productId, prod ? JSON.stringify(prod) : null, it.description || null,
         it.sheetId || null, it.sizeLabel, it.quantity, it.unitPrice || 0, it.taxPercent || 0, it.taxAmount,
         it.discountType || null, it.discountValue || 0, it.total, it.productionNotes || null]);
    }
    await client.query(
      `INSERT INTO order_status_history (order_id, new_status, changed_by, remarks) VALUES ($1,'draft',$2,'Order created')`,
      [ord.id, req.user.id]);
    await client.query(
      `UPDATE company_settings SET order_seq_year=$1, order_seq_current=$2 WHERE id=$3`,
      [num.year, num.current, cs.id]);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'create',
      entityType: 'om_order', entityId: ord.id, afterValue: { orderNumber: num.number, customer: customerId },
    });
    return ord;
  });
  res.status(201).json({ data: order });
}));

// POST /api/om-orders/:id/submit
r.post('/:id/submit', ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM om_orders WHERE id=$1`, [req.params.id]);
  if (!existing[0]) throw notFoundError('Order not found');
  if (existing[0].status !== 'draft') throw badRequest('Only draft orders can be submitted');
  await withTransaction(async (client) => {
    await client.query(`UPDATE om_orders SET status='submitted', submitted_at=now() WHERE id=$1`, [req.params.id]);
    await client.query(`INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, remarks) VALUES ($1,$2,'submitted',$3,$4)`,
      [req.params.id, 'draft', req.user.id, req.body?.reason || 'Order submitted for approval']);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'submit',
      entityType: 'om_order', entityId: req.params.id,
    });
    await notifyRole(client, 'super_admin', { eventType: 'order_submitted', entityType: 'om_order', entityId: req.params.id, title: 'Order submitted', body: `Order ${existing[0].order_number} submitted for approval` });
  });
  res.json({ ok: true });
}));

// POST /api/om-orders/:id/approve
r.post('/:id/approve', requirePermission('approvals.act'), ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM om_orders WHERE id=$1`, [req.params.id]);
  if (!existing[0]) throw notFoundError('Order not found');
  if (!['submitted', 'pending_approval'].includes(existing[0].status)) throw badRequest('Order is not pending approval');
  await withTransaction(async (client) => {
    await client.query(`UPDATE om_orders SET status='approved', approved_at=now() WHERE id=$1`, [req.params.id]);
    await client.query(`INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, remarks) VALUES ($1,$2,'approved',$3,$4)`,
      [req.params.id, existing[0].status, req.user.id, req.body?.reason || 'Order approved']);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'approve',
      entityType: 'om_order', entityId: req.params.id,
    });
  });
  res.json({ ok: true });
}));

// POST /api/om-orders/:id/reject
r.post('/:id/reject', requirePermission('approvals.act'), ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM om_orders WHERE id=$1`, [req.params.id]);
  if (!existing[0]) throw notFoundError('Order not found');
  if (!['submitted', 'pending_approval'].includes(existing[0].status)) throw badRequest('Order is not pending approval');
  await withTransaction(async (client) => {
    await client.query(`UPDATE om_orders SET status='rejected' WHERE id=$1`, [req.params.id]);
    await client.query(`INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, reason, remarks) VALUES ($1,$2,'rejected',$3,$4,$5)`,
      [req.params.id, existing[0].status, req.user.id, req.body?.reason || null, req.body?.remarks || 'Order rejected']);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'reject',
      entityType: 'om_order', entityId: req.params.id, afterValue: { reason: req.body?.reason },
    });
  });
  res.json({ ok: true });
}));

// POST /api/om-orders/:id/assign
r.post('/:id/assign', requirePermission('order.assign'), ah(async (req, res) => {
  const { supervisorId, assignments = [] } = req.body || {};
  const { rows: existing } = await query(`SELECT * FROM om_orders WHERE id=$1`, [req.params.id]);
  if (!existing[0]) throw notFoundError('Order not found');
  if (!['approved'].includes(existing[0].status)) throw badRequest('Only approved orders can be assigned');
  await withTransaction(async (client) => {
    if (supervisorId) {
      await client.query(`UPDATE om_orders SET assigned_supervisor_id=$2, status='assigned' WHERE id=$1`, [req.params.id, supervisorId]);
    } else {
      await client.query(`UPDATE om_orders SET status='assigned' WHERE id=$1`, [req.params.id]);
    }
    for (const a of assignments) {
      await client.query(
        `INSERT INTO production_assignments (order_id, order_item_id, user_id, assigned_by, notes) VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, a.orderItemId || null, a.userId, req.user.id, a.notes || null]);
      await client.query(
        `INSERT INTO production_tasks (order_id, order_item_id, assigned_user_id, assigned_by, supervisor_id, priority, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [req.params.id, a.orderItemId || null, a.userId, req.user.id, supervisorId || null, a.priority || 'normal', a.dueDate || null]);
    }
    await client.query(`INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, remarks) VALUES ($1,$2,'assigned',$3,$4)`,
      [req.params.id, existing[0].status, req.user.id, 'Production assigned']);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'assign',
      entityType: 'om_order', entityId: req.params.id,
    });
  });
  res.json({ ok: true });
}));

// POST /api/om-orders/:id/status — general status update
r.post('/:id/status', ah(async (req, res) => {
  const { status, reason, remarks } = req.body || {};
  const VALID = ['draft','submitted','pending_approval','approved','rejected','assigned','production_started','in_production','quality_check','production_completed','ready_for_delivery','delivered','completed','cancelled'];
  if (!status || !VALID.includes(status)) throw badRequest('Invalid status');
  const { rows: existing } = await query(`SELECT * FROM om_orders WHERE id=$1`, [req.params.id]);
  if (!existing[0]) throw notFoundError('Order not found');
  const timestamps = {};
  if (status === 'approved') timestamps.approved_at = 'now()';
  if (status === 'completed') timestamps.completed_at = 'now()';
  const tsStr = Object.entries(timestamps).map(([k, v]) => `${k}=${v}`).join(', ');
  await withTransaction(async (client) => {
    await client.query(`UPDATE om_orders SET status=$2${tsStr ? ', ' + tsStr : ''} WHERE id=$1`, [req.params.id, status]);
    await client.query(`INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, reason, remarks) VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.params.id, existing[0].status, status, req.user.id, reason || null, remarks || null]);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'status_change',
      entityType: 'om_order', entityId: req.params.id, beforeValue: { status: existing[0].status }, afterValue: { status },
    });
  });
  res.json({ ok: true });
}));

// DELETE /api/om-orders/:id — cancel draft
r.delete('/:id', ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM om_orders WHERE id=$1`, [req.params.id]);
  if (!existing[0]) throw notFoundError('Order not found');
  if (!['draft'].includes(existing[0].status)) throw badRequest('Only draft orders can be deleted');
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM om_order_items WHERE order_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM om_orders WHERE id=$1`, [req.params.id]);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'delete',
      entityType: 'om_order', entityId: req.params.id, beforeValue: existing[0],
    });
  });
  res.status(204).end();
}));

export default r;
