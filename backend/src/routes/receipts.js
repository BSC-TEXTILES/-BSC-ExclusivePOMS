import { Router } from 'express';
import { query, withTransaction } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, forbidden, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { notifyUsers, notifyRole } from '../utils/notify.js';

// Receiving — FRS §15 (five-quantity model, partial receipt first-class), §25 (over-receipt), RB-013.
const r = Router();
r.use(authenticate, requirePermission('receipt.view'));

// GET /api/receipts — list with PO context
r.get('/', ah(async (req, res) => {
  const params = [];
  let scope = '';
  if (!req.user.isSuperAdmin) { params.push(req.user.divisionIds); scope = `WHERE rc.division_id = ANY($1::uuid[])`; }
  const { rows } = await query(
    `SELECT rc.*, po.po_number, sup.company_name AS supplier_name, u.full_name AS received_by_name,
            (SELECT COALESCE(SUM(ri.accepted_qty),0) FROM receipt_items ri WHERE ri.receipt_id = rc.id) AS accepted_total
       FROM receipts rc
       JOIN purchase_orders po ON po.id = rc.po_id
       JOIN suppliers sup ON sup.id = rc.supplier_id
       JOIN users u ON u.id = rc.received_by
       ${scope} ORDER BY rc.created_at DESC LIMIT 200`, params);
  res.json({ data: rows });
}));

// GET /api/receipts/pending/:poId — per-line ordered vs accepted (receiving screen prefill)
r.get('/pending/:poId', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT i.id AS po_item_id, i.line_no, p.sku, p.name AS product_name, c.name AS colour_name,
            i.total_quantity AS ordered_qty,
            COALESCE((SELECT SUM(ri.accepted_qty) FROM receipt_items ri JOIN receipts rc ON rc.id = ri.receipt_id
                       WHERE ri.po_item_id = i.id AND rc.status = 'posted'), 0) AS accepted_qty
       FROM purchase_order_items i
       JOIN products p ON p.id = i.product_id
       LEFT JOIN colours c ON c.id = i.colour_id
      WHERE i.po_id = $1 ORDER BY i.line_no`, [req.params.poId]);
  const data = rows.map((x) => ({ ...x, pending_qty: x.ordered_qty - x.accepted_qty }));
  res.json({ data });
}));

// POST /api/receipts — create (and optionally post) a receipt against an issued PO (RC-01/RC-02)
r.post('/', requirePermission('receipt.create'), ah(async (req, res) => {
  const { poId, deliveryDate, invoiceNumber, invoiceDate, remarks, lines = [], post = true } = req.body || {};
  if (!poId || !lines.length) throw badRequest('poId and at least one receipt line are required');

  const receipt = await withTransaction(async (client) => {
    const { rows: [po] } = await client.query(`SELECT * FROM purchase_orders WHERE id=$1`, [poId]);
    if (!po) throw notFoundError('PO not found');
    if (!req.user.isSuperAdmin && !req.user.divisionIds.includes(String(po.division_id))) {
      throw forbidden('PO is outside your division scope (RB-001)');
    }
    if (!['issued', 'partially_received'].includes(po.status)) {
      throw badRequest(`Receipts can only be recorded against issued or partially-received POs (current: ${po.status})`);
    }

    const { rows: [div] } = await client.query(`SELECT code FROM divisions WHERE id = $1`, [po.division_id]);
    const receiptNumber = (await client.query(`SELECT next_number($1,$2,$3) AS num`,
      [`RCPT-${div.code}`, po.division_id, new Date().getFullYear()])).rows[0].num;

    const { rows: [rc] } = await client.query(
      `INSERT INTO receipts (receipt_number, po_id, supplier_id, division_id, delivery_date, invoice_number, invoice_date, received_by, status, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9) RETURNING *`,
      [receiptNumber, po.id, po.supplier_id, po.division_id, deliveryDate || new Date(), invoiceNumber || null, invoiceDate || null, req.user.id, remarks || null]);

    for (const line of lines) {
      const { rows: [item] } = await client.query(
        `SELECT i.*, p.sku FROM purchase_order_items i JOIN products p ON p.id = i.product_id WHERE i.id=$1 AND i.po_id=$2`,
        [line.poItemId, po.id]);
      if (!item) throw badRequest(`Receipt line ${line.poItemId} does not belong to PO ${po.po_number}`);

      const receivedQty = Number(line.receivedQty) || 0;
      const damagedQty = Number(line.damagedQty) || 0;
      const rejectedQty = Number(line.rejectedQty) || 0;
      if (receivedQty < 0 || damagedQty < 0 || rejectedQty < 0) throw badRequest('Receipt quantities cannot be negative');
      if (damagedQty + rejectedQty > receivedQty) {
        throw badRequest(`damaged + rejected cannot exceed received for ${item.sku}`);
      }
      if (receivedQty <= 0 && damagedQty + rejectedQty <= 0) continue;

      // RB-013 / §25: accepted quantities across posted receipts must never exceed ordered qty
      const { rows: [{ accepted_already }] } = await client.query(
        `SELECT COALESCE(SUM(ri.accepted_qty),0) AS accepted_already FROM receipt_items ri
           JOIN receipts rc ON rc.id = ri.receipt_id
          WHERE ri.po_item_id = $1 AND rc.status = 'posted'`, [item.id]);
      const pending = item.total_quantity - accepted_already;
      const acceptedNow = receivedQty - damagedQty - rejectedQty;
      if (acceptedNow > pending) {
        throw badRequest(`Over-receipt blocked for ${item.sku}: pending is ${pending}, trying to accept ${acceptedNow} (RB-013 / §25)`);
      }

      await client.query(
        `INSERT INTO receipt_items (receipt_id, po_item_id, ordered_qty, received_qty, damaged_qty, rejected_qty, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [rc.id, item.id, item.total_quantity, receivedQty, damagedQty, rejectedQty, line.remarks || null]);
    }

    if (post) await postReceipt(client, rc, po, req);
    return rc;
  });
  res.status(201).json({ data: receipt });
}));

// POST /api/receipts/:id/post — draft → posted: inventory transactions + PO status reconciliation
r.post('/:id/post', requirePermission('receipt.create'), ah(async (req, res) => {
  const rc = (await query(`SELECT * FROM receipts WHERE id=$1`, [req.params.id])).rows[0];
  if (!rc) throw notFoundError('Receipt not found');
  if (rc.status === 'posted') throw badRequest('Receipt already posted');
  const po = (await query(`SELECT * FROM purchase_orders WHERE id=$1`, [rc.po_id])).rows[0];
  await withTransaction(async (client) => {
    await postReceipt(client, rc, po, req);
  });
  res.json({ ok: true });
}));

// Shared posting logic: inventory (§15.2) + PO status reconcile (§31.1, RC-04) + notifications (§18 7/8)
async function postReceipt(client, rc, po, req) {
  const { rows: items } = await client.query(`SELECT * FROM receipt_items WHERE receipt_id=$1`, [rc.id]);
  if (!items.length) throw badRequest('Receipt has no quantity lines to post');

  for (const it of items) {
    if (it.accepted_qty > 0) {
      const { rows: [poItem] } = await client.query(`SELECT * FROM purchase_order_items WHERE id=$1`, [it.po_item_id]);
      const { rows: [prod] } = await client.query(`SELECT id FROM products WHERE id=$1`, [poItem.product_id]);
      await client.query(
        `INSERT INTO inventory_transactions (division_id, product_id, receipt_item_id, txn_type, quantity, unit_cost, created_by)
         VALUES ($1,$2,$3,'receipt',$4,$5,$6)`,
        [po.division_id, prod.id, it.id, it.accepted_qty, poItem.final_value_per_unit, req.user.id]);
    }
  }
  await client.query(`UPDATE receipts SET status='posted' WHERE id=$1`, [rc.id]);

  // Reconcile PO status: all lines fully accepted → received, else partially_received (RB-013)
  const { rows: state } = await client.query(
    `SELECT i.total_quantity AS ordered,
            COALESCE((SELECT SUM(ri.accepted_qty) FROM receipt_items ri JOIN receipts r2 ON r2.id = ri.receipt_id
                       WHERE ri.po_item_id = i.id AND r2.status = 'posted'), 0) AS accepted
       FROM purchase_order_items i WHERE i.po_id = $1`, [po.id]);
  const fullyReceived = state.every((s) => s.accepted >= s.ordered);
  const anyReceived = state.some((s) => s.accepted > 0);
  const newStatus = fullyReceived ? 'received' : (anyReceived ? 'partially_received' : po.status);
  if (newStatus !== po.status) {
    await client.query(`UPDATE purchase_orders SET status=$2 WHERE id=$1`, [po.id, newStatus]);
  }

  await notifyUsers(client, [po.created_by], {
    eventType: fullyReceived ? 'receipt_full' : 'receipt_partial', entityType: 'purchase_order', entityId: po.id,
    title: `PO ${po.po_number} ${fullyReceived ? 'fully received' : 'partially received'}`,
    body: `Receipt ${rc.receipt_number} posted by ${req.user.fullName}`,
  });
  await logAudit(client, {
    userId: req.user.id, role: req.user.roles.join(','), divisionId: po.division_id,
    actionType: 'receive', entityType: 'receipt', entityId: rc.id,
    afterValue: { receipt_number: rc.receipt_number, po_status: newStatus, accepted: items.reduce((a, i) => a + i.accepted_qty, 0) },
  });
}

export default r;
