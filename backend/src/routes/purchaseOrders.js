import { Router } from 'express';
import { query, withTransaction, pool } from '../config/db.js';
import { authenticate, requirePermission, scopeDivision } from '../middleware/auth.js';
import { badRequest, forbidden, notFoundError, ah } from '../utils/httpError.js';
import { computeLineTotals, round2 } from '../utils/pricing.js';
import { logAudit } from '../utils/audit.js';
import { notifyUsers, notifyRole } from '../utils/notify.js';

// Purchase Order engine — FRS §12 (PO requirements), §13 (commercials), §14 (governance), §31.1 (lifecycle).
// All monetary values are recomputed server-side before persistence (RB-017 / SYS-01).
const r = Router();
r.use(authenticate);

async function getSetting(key, fallback) {
  const { rows } = await query(`SELECT value FROM settings WHERE key = $1`, [key]);
  return rows[0] ? rows[0].value : fallback;
}

async function loadPO(poId) {
  const { rows } = await query(`SELECT * FROM purchase_orders WHERE id = $1`, [poId]);
  if (!rows[0]) throw notFoundError('Purchase order not found');
  return rows[0];
}

function assertPOScope(req, po) {
  if (!req.user.isSuperAdmin && !req.user.divisionIds.includes(String(po.division_id))) {
    throw forbidden('PO is outside your division scope (RB-001 / RB-018)');
  }
}

async function nextPoNumber(client, divisionId, divisionCode) {
  const year = new Date().getFullYear();
  const { rows: [{ num }] } = await client.query(`SELECT next_number($1,$2,$3) AS num`, [`PO-${divisionCode}`, divisionId, year]);
  return num;
}

// §20.3 historical snapshot principle (SYS-02): freeze display values into the PO.
async function writeSnapshots(client, poId) {
  await client.query(
    `UPDATE purchase_order_items i SET
       product_snapshot = to_jsonb(p.*) - 'attributes',
       brand_snapshot   = (SELECT to_jsonb(b.*) - 'id' FROM brands b WHERE b.id = p.brand_id)
     FROM products p
     WHERE p.id = i.product_id AND i.po_id = $1`, [poId]);
  await client.query(
    `UPDATE purchase_order_items i SET colour_snapshot = to_jsonb(c.*)
     FROM colours c WHERE c.id = i.colour_id AND i.po_id = $1`, [poId]);
  await client.query(
    `UPDATE purchase_orders po SET header_snapshot = (
       SELECT jsonb_build_object(
         'po_number', po.po_number, 'po_date', po.po_date, 'version', po.version,
         'division', d.name, 'division_code', d.code,
         'department', dep.name, 'section', s.name, 'section_code', s.code,
         'supplier', jsonb_build_object('code', sup.code, 'company_name', sup.company_name,
                    'gstin', sup.gstin, 'address', sup.address, 'payment_terms', sup.payment_terms),
         'created_by', u.full_name)
       FROM divisions d, departments dep, sections s, suppliers sup, users u
       WHERE d.id = po.division_id AND dep.id = po.department_id
         AND s.id = po.section_id AND sup.id = po.supplier_id AND u.id = po.created_by)
     WHERE po.id = $1`, [poId]);
}

// Validate + price one line. Returns persisted-ready values. Enforces RB-006/007/008/009/010.
async function priceLine(client, line, po, policy, req) {
  const { rows: [product] } = await client.query(
    `SELECT p.*, b.brand_name FROM products p JOIN brands b ON b.id = p.brand_id
     WHERE p.id = $1 AND p.status = 'active'`, [line.productId]);
  if (!product) throw badRequest(`Line product ${line.productId} not found or inactive`);
  if (String(product.section_id) !== String(po.section_id)) {
    throw badRequest(`Product ${product.sku} does not belong to the PO section (RB-002)`);
  }

  const quantities = (line.quantities || []).filter((q) => Number(q.quantity) > 0);
  const totalQuantity = quantities.reduce((a, q) => a + Number(q.quantity), 0);
  if (!Number.isInteger(totalQuantity) || totalQuantity <= 0) {
    throw badRequest(`RB-007: line ${product.sku} needs a positive integer total quantity (sum of variant quantities, RB-006)`);
  }
  for (const q of quantities) {
    if (!Number.isInteger(Number(q.quantity)) || q.quantity < 0) throw badRequest('RB-007: variant quantities must be non-negative integers');
    if (q.sizeId) {
      const { rows: [sz] } = await client.query(`SELECT id, label FROM sizes WHERE id = $1`, [q.sizeId]);
      if (!sz) throw badRequest(`Unknown size on line ${product.sku}`);
      q.sizeLabel = sz.label; // snapshot label §20.3
    }
    if (!q.sizeLabel) throw badRequest(`Variant quantity on line ${product.sku} needs sizeId or sizeLabel`);
  }

  const purchasePrice = Number(line.purchasePrice);
  if (!(purchasePrice >= 0)) throw badRequest('RB-008: purchase price cannot be negative');
  const marginPercent = Number(line.marginPercent) || 0;
  if (marginPercent < 0) throw badRequest('RB-010: margin cannot be negative');
  const discountType = line.discountType === 'flat' ? 'flat' : (line.discountType === 'percent' ? 'percent' : null);
  const discountValue = discountType ? Number(line.discountValue) || 0 : 0;
  if (discountValue < 0) throw badRequest('RB-009: discount cannot be negative');

  // RB-009 / RB-010 policy gates — exception requires override permission + reason (§13 expand)
  const canOverride = req.user.isSuperAdmin || req.user.permissions.includes('po.commercial.override');
  if (marginPercent > Number(policy.max_margin_percent)) {
    if (!canOverride) throw forbidden(`RB-010: margin ${marginPercent}% exceeds configured policy (${policy.max_margin_percent}%). Request override permission.`);
    if (!line.commercialReason) throw badRequest('RB-010: over-policy margin requires a justification reason');
  }
  if (discountType === 'percent' && discountValue > Number(policy.max_discount_percent)) {
    if (!canOverride) throw forbidden(`RB-009: discount ${discountValue}% exceeds allowed policy (${policy.max_discount_percent}%). Request exception approval.`);
    if (!line.commercialReason) throw badRequest('RB-009: over-policy discount requires a justification reason');
  }

  const totals = computeLineTotals({ purchasePrice, marginPercent, discountType, discountValue, totalQuantity });
  return { product, quantities, totalQuantity, purchasePrice, marginPercent, discountType, discountValue, ...totals };
}

// Recompute + persist all lines and order totals. Used by create, update and submit (RB-017).
async function persistLines(client, po, lines, req, policy) {
  await client.query(`DELETE FROM purchase_order_items WHERE po_id = $1`, [po.id]);
  let subtotal = 0;
  let maxLineDiscountPercent = 0;
  let lineNo = 0;
  for (const line of lines) {
    const t = await priceLine(client, line, po, policy, req);
    lineNo += 1;
    subtotal = round2(subtotal + t.lineTotal);
    if (t.discountType === 'percent') maxLineDiscountPercent = Math.max(maxLineDiscountPercent, t.discountValue);
    const { rows: [item] } = await client.query(
      `INSERT INTO purchase_order_items
         (po_id, line_no, product_id, product_snapshot, brand_snapshot, colour_id, colour_snapshot,
          description, purchase_price, margin_percent, net_value_per_unit, discount_type, discount_value,
          final_value_per_unit, total_quantity, line_total)
       VALUES ($1,$2,$3,
               (SELECT to_jsonb(p.*) - 'attributes' FROM products p WHERE p.id = $3),
               (SELECT to_jsonb(b.*) - 'id' FROM brands b JOIN products p ON p.brand_id = b.id WHERE p.id = $3),
               $4, (SELECT to_jsonb(c.*) FROM colours c WHERE c.id = $4),
               $5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [po.id, lineNo, t.product.id, line.colourId || null, line.description || null,
       t.purchasePrice, t.marginPercent, t.netValuePerUnit, t.discountType,
       t.discountType ? t.discountValue : null,
       t.finalValuePerUnit, t.totalQuantity, t.lineTotal]);
    for (const q of t.quantities) {
      await client.query(
        `INSERT INTO purchase_order_quantities (po_item_id, size_id, size_label, quantity)
         VALUES ($1,$2,$3,$4) ON CONFLICT (po_item_id, size_id) DO UPDATE SET quantity = EXCLUDED.quantity, size_label = EXCLUDED.size_label`,
        [item.id, q.sizeId || null, q.sizeLabel, q.quantity]);
    }
  }

  // Order-level inputs: explicit on create/update; read back from stored rows on the
  // submit-time RB-017 recompute so nothing is dropped. (undefined = "not supplied")
  let od = po.orderDiscount;
  if (od === undefined) {
    const { rows: [dRow] } = await client.query(
      `SELECT discount_type, discount_value, reason FROM purchase_order_discounts WHERE po_id = $1 LIMIT 1`, [po.id]);
    od = dRow ? { type: dRow.discount_type, value: Number(dRow.discount_value), reason: dRow.reason } : null;
  }
  let charges = po.charges;
  if (charges === undefined) {
    const { rows: cRows } = await client.query(
      `SELECT charge_type, description, amount FROM purchase_order_charges WHERE po_id = $1`, [po.id]);
    charges = cRows.map((c) => ({ type: c.charge_type, description: c.description, amount: Number(c.amount) }));
  }

  await client.query(`DELETE FROM purchase_order_discounts WHERE po_id = $1`, [po.id]);
  await client.query(`DELETE FROM purchase_order_taxes WHERE po_id = $1`, [po.id]);
  await client.query(`DELETE FROM purchase_order_charges WHERE po_id = $1`, [po.id]);

  let orderDiscountAmount = 0;
  if (od && Number(od.value) > 0) {
    orderDiscountAmount = od.type === 'flat' ? round2(Number(od.value)) : round2(subtotal * (Number(od.value) / 100));
    if (od.type === 'percent' && Number(od.value) > Number(policy.max_discount_percent)) {
      const canOverride = req.user.isSuperAdmin || req.user.permissions.includes('po.commercial.override');
      if (!canOverride) throw forbidden(`RB-009: order discount ${od.value}% exceeds policy (${policy.max_discount_percent}%)`);
      if (!od.reason) throw badRequest('RB-009: over-policy order discount requires a reason');
    }
    if (orderDiscountAmount > subtotal) throw badRequest('Order discount cannot exceed subtotal');
    await client.query(
      `INSERT INTO purchase_order_discounts (po_id, discount_type, discount_value, discount_amount, reason)
       VALUES ($1,$2,$3,$4,$5)`,
      [po.id, od.type === 'flat' ? 'flat' : 'percent', Number(od.value), orderDiscountAmount, od.reason || null]);
    if (od.type === 'percent') maxLineDiscountPercent = Math.max(maxLineDiscountPercent, Number(od.value));
  }

  // Tax — configurable percent from settings, split by tax scheme (§13.2)
  const taxableBase = round2(subtotal - orderDiscountAmount);
  const gstPercent = Number(policy.gst_percent ?? 0);
  let taxTotal = 0;
  if (gstPercent > 0 && taxableBase > 0) {
    if (po.tax_scheme === 'GST_INTER') {
      taxTotal = round2(taxableBase * gstPercent / 100);
      await client.query(
        `INSERT INTO purchase_order_taxes (po_id, tax_name, rate, taxable_base, tax_amount)
         VALUES ($1,'IGST',$2,$3,$4)`, [po.id, gstPercent, taxableBase, taxTotal]);
    } else {
      const half = round2(gstPercent / 2);
      const halfAmt = round2(taxableBase * half / 100);
      taxTotal = round2(halfAmt * 2);
      await client.query(
        `INSERT INTO purchase_order_taxes (po_id, tax_name, rate, taxable_base, tax_amount)
         VALUES ($1,'CGST',$2,$3,$4), ($1,'SGST',$2,$3,$4)`, [po.id, half, taxableBase, halfAmt]);
    }
  }

  const chargeRows = charges.filter((c) => Number(c.amount) > 0 || Number(c.amount) < 0);
  let chargesTotal = 0;
  for (const c of chargeRows) {
    const amount = round2(Number(c.amount) || 0);
    if (amount < 0) throw badRequest('Charge amounts cannot be negative');
    chargesTotal = round2(chargesTotal + amount);
    await client.query(
      `INSERT INTO purchase_order_charges (po_id, charge_type, description, amount)
       VALUES ($1,$2,$3,$4)`, [po.id, c.type || 'other', c.description || null, amount]);
  }

  const grandTotal = round2(subtotal - orderDiscountAmount + taxTotal + chargesTotal);
  await client.query(
    `UPDATE purchase_orders SET subtotal=$2, order_discount_amount=$3, tax_amount=$4, charges_amount=$5, grand_total=$6
     WHERE id=$1`,
    [po.id, subtotal, orderDiscountAmount, taxTotal, chargesTotal, grandTotal]);

  return { subtotal, orderDiscountAmount, taxTotal, chargesTotal, grandTotal, maxLineDiscountPercent };
}

function extractHeader(body) {
  return {
    divisionId: body.divisionId,
    departmentId: body.departmentId,
    sectionId: body.sectionId,
    supplierId: body.supplierId,
    paymentTerms: body.paymentTerms || null,
    deliveryTerms: body.deliveryTerms || null,
    taxScheme: body.taxScheme || 'GST_INTRA',
    expectedDeliveryDate: body.expectedDeliveryDate || null,
    remarks: body.remarks || null,
    lines: body.lines || [],
    orderDiscount: body.orderDiscount || null,
    charges: body.charges || [],
  };
}

async function assertActiveRefs(client, h) {
  const { rows: [div] } = await client.query(`SELECT id, code, status FROM divisions WHERE id=$1`, [h.divisionId]);
  if (!div || div.status !== 'active') throw badRequest('Division must exist and be active (RB-002)');
  const { rows: [sec] } = await client.query(
    `SELECT s.id, s.status FROM sections s WHERE s.id=$1`, [h.sectionId]);
  if (!sec || sec.status !== 'active') throw badRequest('Section must exist and be active (RB-002)');
  const { rows: [sup] } = await client.query(`SELECT id, status FROM suppliers WHERE id=$1`, [h.supplierId]);
  if (!sup || sup.status !== 'active') throw badRequest('Supplier must exist and be active — inactive suppliers cannot receive new POs (§25)');
  const { rows: [dept] } = await client.query(`SELECT id FROM departments WHERE id=$1`, [h.departmentId || '00000000-0000-0000-0000-000000000000']);
  if (!dept) throw badRequest('Department not found');
  return { div };
}

const PO_POLICY_DEFAULTS = { gst_percent: 18, max_discount_percent: 15, max_margin_percent: 60 };

// ---------- GET /api/purchase-orders — list (RB-018 scoped) ----------
r.get('/', ah(async (req, res) => {
  const { divisionId, departmentId, sectionId, status, supplierId, search, from, to, page = 1, pageSize = 20 } = req.query;
  const clauses = []; const params = [];
  if (!req.user.isSuperAdmin) { params.push(req.user.divisionIds); clauses.push(`po.division_id = ANY($${params.length}::uuid[])`); }
  if (divisionId) { params.push(divisionId); clauses.push(`po.division_id = $${params.length}`); }
  if (departmentId) { params.push(departmentId); clauses.push(`po.department_id = $${params.length}`); }
  if (sectionId) { params.push(sectionId); clauses.push(`po.section_id = $${params.length}`); }
  if (status) { params.push(status); clauses.push(`po.status = $${params.length}`); }
  if (supplierId) { params.push(supplierId); clauses.push(`po.supplier_id = $${params.length}`); }
  if (from) { params.push(from); clauses.push(`po.po_date >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`po.po_date <= $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(po.po_number ILIKE $${params.length} OR sup.company_name ILIKE $${params.length} OR s.name ILIKE $${params.length})`);
  }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page), 1) - 1) * limit;
  const { rows } = await query(
    `SELECT po.id, po.po_number, po.version, po.po_date, po.status, po.grand_total, po.subtotal,
            po.expected_delivery_date, d.code AS division_code, d.name AS division_name,
            dep.name AS department_name, s.name AS section_name, sup.company_name AS supplier_name,
            (SELECT COALESCE(SUM(total_quantity),0) FROM purchase_order_items i WHERE i.po_id = po.id) AS total_quantity
       FROM purchase_orders po
       JOIN divisions d ON d.id = po.division_id
       JOIN departments dep ON dep.id = po.department_id
       JOIN sections s ON s.id = po.section_id
       JOIN suppliers sup ON sup.id = po.supplier_id
       ${where} ORDER BY po.created_at DESC LIMIT ${limit} OFFSET ${offset}`, params);
  const { rows: [{ count }] } = await query(
    `SELECT count(*)::int AS count FROM purchase_orders po
       JOIN suppliers sup ON sup.id = po.supplier_id JOIN sections s ON s.id = po.section_id ${where}`, params);
  res.json({ data: rows, total: count, page: Number(page), pageSize: limit });
}));

// ---------- POST /api/purchase-orders — create draft (§12.2 guided steps) ----------
r.post('/', requirePermission('po.create'), ah(async (req, res) => {
  const h = extractHeader(req.body || {});
  if (!h.divisionId || !h.departmentId || !h.sectionId || !h.supplierId) {
    throw badRequest('divisionId, departmentId, sectionId, supplierId are required');
  }
  if (!h.lines?.length) throw badRequest('At least one product line is required');
  scopeDivision(req, h.divisionId);

  const policy = {
    gst_percent: await getSetting('gst_percent', PO_POLICY_DEFAULTS.gst_percent),
    max_discount_percent: await getSetting('max_discount_percent', PO_POLICY_DEFAULTS.max_discount_percent),
    max_margin_percent: await getSetting('max_margin_percent', PO_POLICY_DEFAULTS.max_margin_percent),
  };

  const po = await withTransaction(async (client) => {
    const { div } = await assertActiveRefs(client, h);
    const { rows } = await client.query(
      `INSERT INTO purchase_orders (po_number, division_id, department_id, section_id, supplier_id, created_by,
           status, payment_terms, delivery_terms, tax_scheme, expected_delivery_date, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9,$10,$11) RETURNING *`,
      ['PENDING', h.divisionId, h.departmentId, h.sectionId, h.supplierId, req.user.id,
       h.paymentTerms, h.deliveryTerms, h.taxScheme, h.expectedDeliveryDate, h.remarks]);
    const created = rows[0];
    const poNumber = await nextPoNumber(client, h.divisionId, div.code);
    await client.query(`UPDATE purchase_orders SET po_number=$2 WHERE id=$1`, [created.id, poNumber]);
    created.po_number = poNumber;

    const totals = await persistLines(client, created, h.lines, req, policy);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), divisionId: h.divisionId, sectionId: h.sectionId,
      actionType: 'create', entityType: 'purchase_order', entityId: created.id,
      afterValue: { po_number: poNumber, ...totals },
    });
    return { ...created, ...totals };
  });
  res.status(201).json({ data: po });
}));

// ---------- GET /api/purchase-orders/:id — full detail bundle ----------
r.get('/:id', ah(async (req, res) => {
  const po = await loadPO(req.params.id);
  assertPOScope(req, po);
  const [header] = (
    await query(
      `SELECT po.*, d.name AS division_name, d.code AS division_code, dep.name AS department_name,
              s.name AS section_name, s.id AS section_uuid,
              sup.company_name AS supplier_name, sup.code AS supplier_code, sup.gstin AS supplier_gstin,
              sup.address AS supplier_address, u.full_name AS created_by_name
         FROM purchase_orders po
         JOIN divisions d ON d.id = po.division_id
         JOIN departments dep ON dep.id = po.department_id
         JOIN sections s ON s.id = po.section_id
         JOIN suppliers sup ON sup.id = po.supplier_id
         JOIN users u ON u.id = po.created_by
        WHERE po.id = $1`, [po.id])
  ).rows;

  const items = (await query(
    `SELECT i.*, p.sku,
            COALESCE(i.product_snapshot->>'name', p.name) AS product_name,
            COALESCE(i.brand_snapshot->>'brand_name', b.brand_name) AS brand_name,
            COALESCE(i.brand_snapshot->>'brand_number', b.brand_number) AS brand_number,
            COALESCE(i.colour_snapshot->>'name', c.name) AS colour_name,
            (SELECT json_agg(json_build_object('sizeLabel', q.size_label, 'quantity', q.quantity) ORDER BY q.size_label)
               FROM purchase_order_quantities q WHERE q.po_item_id = i.id) AS quantities,
            (SELECT COALESCE(SUM(ri.accepted_qty),0) FROM receipt_items ri JOIN receipts rc ON rc.id = ri.receipt_id
              WHERE ri.po_item_id = i.id AND rc.status = 'posted') AS accepted_qty
       FROM purchase_order_items i
       JOIN products p ON p.id = i.product_id
       JOIN brands b ON b.id = p.brand_id
       LEFT JOIN colours c ON c.id = i.colour_id
      WHERE i.po_id = $1 ORDER BY i.line_no`, [po.id])).rows;

  const discounts = (await query(`SELECT * FROM purchase_order_discounts WHERE po_id=$1`, [po.id])).rows;
  const taxes = (await query(`SELECT * FROM purchase_order_taxes WHERE po_id=$1`, [po.id])).rows;
  const charges = (await query(`SELECT * FROM purchase_order_charges WHERE po_id=$1`, [po.id])).rows;

  const approvals = (await query(
    `SELECT ai.*, r.name AS rule_name FROM approval_instances ai LEFT JOIN approval_rules r ON r.id = ai.rule_id
      WHERE ai.po_id = $1 ORDER BY ai.created_at DESC`, [po.id])).rows;
  const approvalActions = (await query(
    `SELECT aa.*, u.full_name AS approver_name FROM approval_actions aa
       JOIN approval_instances ai ON ai.id = aa.instance_id
       JOIN users u ON u.id = aa.approver_id
      WHERE ai.po_id = $1 ORDER BY aa.acted_at`, [po.id])).rows;

  const receipts = (await query(
    `SELECT rc.id, rc.receipt_number, rc.delivery_date, rc.invoice_number, rc.status, rc.created_at, u.full_name AS received_by_name
       FROM receipts rc JOIN users u ON u.id = rc.received_by WHERE rc.po_id = $1 ORDER BY rc.created_at DESC`, [po.id])).rows;

  // PO timeline (§17.3): audit events + approval actions + receipts, chronological
  const timeline = (await query(
    `(SELECT occurred_at, 'audit' AS kind, action_type AS title, COALESCE(u.full_name, 'System') AS actor
        FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
       WHERE al.entity_type = 'purchase_order' AND al.entity_id = $1)
     UNION ALL
     (SELECT aa.acted_at, 'approval' AS kind, aa.action::text || COALESCE(' — ' || aa.comments, '') AS title, u.full_name AS actor
        FROM approval_actions aa JOIN approval_instances ai ON ai.id = aa.instance_id JOIN users u ON u.id = aa.approver_id
       WHERE ai.po_id = $1)
     ORDER BY occurred_at`, [po.id])).rows;

  res.json({ data: { ...header, items, discounts, taxes, charges, approvals, approvalActions, receipts, timeline } });
}));

// ---------- PUT /api/purchase-orders/:id — edit draft only (RB-011) ----------
r.put('/:id', requirePermission('po.edit'), ah(async (req, res) => {
  const po = await loadPO(req.params.id);
  assertPOScope(req, po);
  if (po.status !== 'draft') throw forbidden('RB-011: only draft POs are editable — approved/issued POs require an amendment (§14.3)');
  const h = extractHeader(req.body || {});
  scopeDivision(req, h.divisionId || po.division_id);

  const policy = {
    gst_percent: await getSetting('gst_percent', PO_POLICY_DEFAULTS.gst_percent),
    max_discount_percent: await getSetting('max_discount_percent', PO_POLICY_DEFAULTS.max_discount_percent),
    max_margin_percent: await getSetting('max_margin_percent', PO_POLICY_DEFAULTS.max_margin_percent),
  };

  const updated = await withTransaction(async (client) => {
    const before = { subtotal: po.subtotal, grand_total: po.grand_total };
    await client.query(
      `UPDATE purchase_orders SET division_id=$2, department_id=$3, section_id=$4, supplier_id=$5,
              payment_terms=$6, delivery_terms=$7, tax_scheme=$8, expected_delivery_date=$9, remarks=$10
        WHERE id=$1`,
      [po.id, h.divisionId || po.division_id, h.departmentId || po.department_id, h.sectionId || po.section_id,
       h.supplierId || po.supplier_id, h.paymentTerms, h.deliveryTerms, h.taxScheme,
       h.expectedDeliveryDate, h.remarks]);
    const fresh = { ...po, ...h };
    const totals = await persistLines(client, fresh, h.lines, req, policy);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), divisionId: po.division_id, sectionId: po.section_id,
      actionType: 'edit', entityType: 'purchase_order', entityId: po.id, beforeValue: before, afterValue: totals,
    });
    return totals;
  });
  res.json({ data: updated });
}));

// ---------- POST /:id/submit — recalc (RB-017) → snapshot (§20.3) → route to approval (§14) ----------
r.post('/:id/submit', requirePermission('po.submit'), ah(async (req, res) => {
  const po = await loadPO(req.params.id);
  assertPOScope(req, po);
  if (po.status !== 'draft') throw badRequest(`Only draft POs can be submitted (current: ${po.status})`);

  const policy = {
    gst_percent: await getSetting('gst_percent', PO_POLICY_DEFAULTS.gst_percent),
    max_discount_percent: await getSetting('max_discount_percent', PO_POLICY_DEFAULTS.max_discount_percent),
    max_margin_percent: await getSetting('max_margin_percent', PO_POLICY_DEFAULTS.max_margin_percent),
  };

  const result = await withTransaction(async (client) => {
    // RB-017: rebuild every stored line + order total from source inputs before approval
    const storedRaw = (await client.query(
      `SELECT i.product_id, i.colour_id, i.purchase_price, i.margin_percent, i.discount_type, i.discount_value,
              (SELECT json_agg(json_build_object('sizeId', q.size_id, 'sizeLabel', q.size_label, 'quantity', q.quantity))
                 FROM purchase_order_quantities q WHERE q.po_item_id = i.id) AS quantities
         FROM purchase_order_items i WHERE i.po_id = $1 ORDER BY i.line_no`, [po.id])).rows;
    const storedLines = storedRaw.map((r) => ({
      productId: r.product_id,
      colourId: r.colour_id,
      purchasePrice: Number(r.purchase_price),
      marginPercent: Number(r.margin_percent),
      discountType: r.discount_type,
      discountValue: r.discount_value === null ? 0 : Number(r.discount_value),
      quantities: r.quantities || [],
    }));
    const storedDiscount = po.order_discount || null;
    if (!storedLines.length) throw badRequest('PO has no lines to submit');
    const totals = await persistLines(client, po, storedLines, req, policy);

    await writeSnapshots(client, po.id);
    await client.query(`UPDATE purchase_orders SET status='submitted', submitted_at=now() WHERE id=$1`, [po.id]);

    // Approval rule evaluation (§14.1) — configurable by value/division/dept/section/supplier/discount
    const { rows: [rule] } = await client.query(
      `SELECT * FROM approval_rules
        WHERE is_active
          AND (division_id IS NULL OR division_id = $1)
          AND (department_id IS NULL OR department_id = $2)
          AND (section_id IS NULL OR section_id = $3)
          AND (supplier_id IS NULL OR supplier_id = $4)
          AND (min_value IS NULL OR $5::numeric >= min_value)
          AND (max_value IS NULL OR $5::numeric <= max_value)
          AND (min_discount_percent IS NULL OR $6::numeric >= min_discount_percent)
        ORDER BY priority ASC, min_value DESC NULLS LAST
        LIMIT 1`,
      [po.division_id, po.department_id, po.section_id, po.supplier_id, totals.grandTotal, totals.maxLineDiscountPercent]);

    let exceptionQueue = false;
    if (rule) {
      await client.query(
        `INSERT INTO approval_instances (po_id, rule_id, current_level, status, created_by)
         VALUES ($1,$2,1,'under_review',$3)`, [po.id, rule.id, req.user.id]);
      const { rows: [lvl] } = await client.query(
        `SELECT l.*, ro.code AS approver_role_code FROM approval_levels l LEFT JOIN roles ro ON ro.id = l.approver_role_id
         WHERE l.rule_id = $1 AND l.level_no = 1`, [rule.id]);
      if (lvl?.approver_role_code) {
        await notifyRole(client, lvl.approver_role_code, {
          eventType: 'po_submitted', entityType: 'purchase_order', entityId: po.id,
          title: `PO ${po.po_number} awaiting your approval`,
          body: `Value ₹${totals.grandTotal.toLocaleString('en-IN')} — submitted by ${req.user.fullName}`,
        }, po.division_id);
      }
    } else {
      // §25 / SA-06: no matching rule → never issue silently; route to Super Admin exception queue
      exceptionQueue = true;
      await client.query(
        `INSERT INTO approval_instances (po_id, rule_id, current_level, status, created_by)
         VALUES ($1,NULL,1,'under_review',$2)`, [po.id, req.user.id]);
      await notifyRole(client, 'super_admin', {
        eventType: 'po_exception', entityType: 'purchase_order', entityId: po.id,
        title: `Exception queue: PO ${po.po_number} has no approval rule`,
        body: `Value ₹${totals.grandTotal.toLocaleString('en-IN')} — evaluate manually (§25)`,
      });
    }

    await notifyUsers(client, [po.created_by], {
      eventType: 'po_submitted', entityType: 'purchase_order', entityId: po.id,
      title: `PO ${po.po_number} submitted`, body: 'Your purchase order is now in the approval workflow',
    });
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), divisionId: po.division_id, sectionId: po.section_id,
      actionType: 'submit', entityType: 'purchase_order', entityId: po.id, afterValue: { totals, rule: rule?.name || 'EXCEPTION_QUEUE' },
    });
    return { totals, exceptionQueue };
  });
  res.json({ data: result });
}));

// ---------- POST /:id/approval-action — §14.2 Approve/Reject/SendBack/Hold/Escalate ----------
r.post('/:id/approval-action', requirePermission('approvals.act'), ah(async (req, res) => {
  const { action, comments } = req.body || {};
  if (!['approved', 'rejected', 'send_back', 'hold', 'escalated'].includes(action)) {
    throw badRequest('action must be one of approved | rejected | send_back | hold | escalated');
  }
  // RB-012: rejection and send-back require comments (also DB-enforced)
  if (['rejected', 'send_back'].includes(action) && !comments) {
    throw badRequest('RB-012: rejection and send-back actions require a reason/comment');
  }
  const po = await loadPO(req.params.id);
  assertPOScope(req, po);

  const result = await withTransaction(async (client) => {
    const { rows: [inst] } = await client.query(
      `SELECT * FROM approval_instances WHERE po_id=$1 AND resolved_at IS NULL ORDER BY created_at DESC LIMIT 1`, [po.id]);
    if (!inst) throw badRequest('No open approval instance for this PO');
    if (!['submitted', 'under_review'].includes(po.status)) throw badRequest(`PO is not awaiting approval (current: ${po.status})`);

    // Level authorization: acting user must match the configured approver role/user (or Super Admin)
    let level = null;
    if (inst.rule_id) {
      const { rows } = await client.query(
        `SELECT l.*, ro.code AS approver_role_code FROM approval_levels l LEFT JOIN roles ro ON ro.id = l.approver_role_id
         WHERE l.rule_id=$1 AND l.level_no=$2`, [inst.rule_id, inst.current_level]);
      level = rows[0] || null;
    }
    if (level) {
      const authorized = req.user.isSuperAdmin
        || (level.approver_role_code && req.user.roles.includes(level.approver_role_code))
        || (level.approver_user_id && String(level.approver_user_id) === String(req.user.id));
      if (!authorized) throw forbidden('You are not the approver for the current level (§14.1)');
    } else if (!req.user.isSuperAdmin) {
      throw forbidden('Exception-queue POs can only be actioned by Super Admin (SA-06)');
    }

    await client.query(
      `INSERT INTO approval_actions (instance_id, level_no, approver_id, action, comments)
       VALUES ($1,$2,$3,$4,$5)`, [inst.id, inst.current_level, req.user.id, action, comments || null]);

    if (action === 'hold') {
      await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), divisionId: po.division_id, actionType: 'approval_hold', entityType: 'purchase_order', entityId: po.id, reason: comments });
      return { poStatus: po.status, resolved: false };
    }

    if (action === 'approved' || action === 'escalated') {
      if (inst.rule_id) {
        const { rows: [next] } = await client.query(
          `SELECT 1 FROM approval_levels WHERE rule_id=$1 AND level_no=$2`, [inst.rule_id, inst.current_level + 1]);
        if (next) {
          await client.query(`UPDATE approval_instances SET current_level = current_level + 1 WHERE id=$1`, [inst.id]);
          await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), divisionId: po.division_id, actionType: action === 'approved' ? 'level_approved' : 'escalated', entityType: 'purchase_order', entityId: po.id, afterValue: { nextLevel: inst.current_level + 1 }, reason: comments });
          await notifyUsers(client, [po.created_by], { eventType: 'approval_pending', entityType: 'purchase_order', entityId: po.id, title: `PO ${po.po_number} advanced to level ${inst.current_level + 1}`, body: null });
          return { poStatus: 'under_review', resolved: false };
        }
      }
      if (action === 'escalated' && inst.rule_id) {
        throw badRequest('Already at the final approval level — nothing to escalate to');
      }
      // Final approval
      await client.query(`UPDATE approval_instances SET resolved_at=now(), status='approved' WHERE id=$1`, [inst.id]);
      await writeSnapshots(client, po.id);
      await client.query(`UPDATE purchase_orders SET status='approved', approved_at=now() WHERE id=$1`, [po.id]);
      await notifyUsers(client, [po.created_by], {
        eventType: 'po_approved', entityType: 'purchase_order', entityId: po.id,
        title: `PO ${po.po_number} approved`, body: 'The PO is approved and ready to issue',
      });
      await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), divisionId: po.division_id, sectionId: po.section_id, actionType: 'approve', entityType: 'purchase_order', entityId: po.id, afterValue: { status: 'approved' }, reason: comments });
      return { poStatus: 'approved', resolved: true };
    }

    // rejected / send_back → back to draft for correction; instance closed, history retained
    await client.query(`UPDATE approval_instances SET resolved_at=now(), status='draft' WHERE id=$1`, [inst.id]);
    await client.query(`UPDATE purchase_orders SET status='draft' WHERE id=$1`, [po.id]);
    await notifyUsers(client, [po.created_by], {
      eventType: action === 'rejected' ? 'po_rejected' : 'po_sent_back', entityType: 'purchase_order', entityId: po.id,
      title: `PO ${po.po_number} ${action === 'rejected' ? 'rejected' : 'sent back'}`,
      body: comments || null,
    });
    await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), divisionId: po.division_id, actionType: action === 'rejected' ? 'reject' : 'send_back', entityType: 'purchase_order', entityId: po.id, reason: comments });
    return { poStatus: 'draft', resolved: true };
  });
  res.json({ data: result });
}));

// ---------- POST /:id/issue — approved → issued (§14.1, §18 event 5) ----------
r.post('/:id/issue', requirePermission('po.issue'), ah(async (req, res) => {
  const po = await loadPO(req.params.id);
  assertPOScope(req, po);
  if (po.status !== 'approved') throw badRequest(`Only approved POs can be issued (current: ${po.status})`);
  await withTransaction(async (client) => {
    await writeSnapshots(client, po.id);
    await client.query(`UPDATE purchase_orders SET status='issued', issued_at=now() WHERE id=$1`, [po.id]);
    await notifyUsers(client, [po.created_by], { eventType: 'po_issued', entityType: 'purchase_order', entityId: po.id, title: `PO ${po.po_number} issued`, body: 'PO is issued to the supplier and ready for receiving' });
    await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), divisionId: po.division_id, sectionId: po.section_id, actionType: 'issue', entityType: 'purchase_order', entityId: po.id, afterValue: { status: 'issued' } });
  });
  res.json({ ok: true });
}));

// ---------- POST /:id/amend — version event for approved/issued POs (§14.3, RB-011, PM-02) ----------
r.post('/:id/amend', requirePermission('po.amend'), ah(async (req, res) => {
  const po = await loadPO(req.params.id);
  assertPOScope(req, po);
  if (!['approved', 'issued', 'partially_received'].includes(po.status)) {
    throw badRequest(`Only approved/issued/partially-received POs can be amended (current: ${po.status})`);
  }
  const newId = await withTransaction(async (client) => {
    // po_number is UNIQUE per the supplied schema, so amendment versions get an -A{n} suffix
    const { rows: [newPo] } = await client.query(
      `INSERT INTO purchase_orders (po_number, version, parent_po_id, division_id, department_id, section_id,
           supplier_id, created_by, po_date, status, payment_terms, delivery_terms, tax_scheme,
           expected_delivery_date, remarks, header_snapshot,
           subtotal, order_discount_amount, tax_amount, charges_amount, grand_total)
       SELECT regexp_replace(po_number, '-A\\d+$', '') || '-A' || ($2)::text, $4, id, division_id, department_id, section_id, supplier_id, $3,
              current_date, 'draft', payment_terms, delivery_terms, tax_scheme,
              expected_delivery_date, remarks, header_snapshot,
              subtotal, order_discount_amount, tax_amount, charges_amount, grand_total
         FROM purchase_orders WHERE id = $1 RETURNING *`, [po.id, po.version + 1, req.user.id, po.version + 1]);
    await client.query(
      `INSERT INTO purchase_order_items (po_id, line_no, product_id, product_snapshot, brand_snapshot, colour_id, colour_snapshot,
            description, purchase_price, margin_percent, net_value_per_unit, discount_type, discount_value, total_quantity)
       SELECT $2, line_no, product_id, product_snapshot, brand_snapshot, colour_id, colour_snapshot,
            description, purchase_price, margin_percent, net_value_per_unit, discount_type, discount_value, total_quantity
         FROM purchase_order_items WHERE po_id = $1`, [po.id, newPo.id]);
    await client.query(
      `INSERT INTO purchase_order_quantities (po_item_id, size_id, size_label, quantity)
       SELECT n.id, q.size_id, q.size_label, q.quantity
         FROM purchase_order_quantities q
         JOIN purchase_order_items o ON o.id = q.po_item_id AND o.po_id = $1
         JOIN purchase_order_items n ON n.po_id = $2 AND n.line_no = o.line_no`, [po.id, newPo.id]);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), divisionId: po.division_id, sectionId: po.section_id,
      actionType: 'amend', entityType: 'purchase_order', entityId: po.id,
      afterValue: { newVersionId: newPo.id, version: newPo.version },
    });
    return newPo.id;
  });
  res.status(201).json({ data: { amendmentId: newId } });
}));

// ---------- POST /:id/close — manual closure (§31.1) ----------
r.post('/:id/close', requirePermission('po.close'), ah(async (req, res) => {
  const po = await loadPO(req.params.id);
  assertPOScope(req, po);
  if (!['issued', 'partially_received', 'received'].includes(po.status)) {
    throw badRequest(`Cannot close a PO in status ${po.status}`);
  }
  await withTransaction(async (client) => {
    await client.query(`UPDATE purchase_orders SET status='closed', closed_at=now() WHERE id=$1`, [po.id]);
    await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), divisionId: po.division_id, actionType: 'close', entityType: 'purchase_order', entityId: po.id, afterValue: { status: 'closed' } });
  });
  res.json({ ok: true });
}));

// ---------- GET /:id/versions — amendment chain (§14.3, AU-02) ----------
r.get('/:id/versions', ah(async (req, res) => {
  const po = await loadPO(req.params.id);
  assertPOScope(req, po);
  const rootId = po.parent_po_id || po.id;
  const { rows } = await query(
    `WITH RECURSIVE chain AS (
       SELECT id, po_number, version, parent_po_id, status, grand_total, created_at FROM purchase_orders WHERE id = $1
       UNION ALL
       SELECT p.id, p.po_number, p.version, p.parent_po_id, p.status, p.grand_total, p.created_at
         FROM purchase_orders p JOIN chain c ON p.parent_po_id = c.id)
     SELECT * FROM chain ORDER BY version`, [rootId]);
  res.json({ data: rows });
}));

export default r;
