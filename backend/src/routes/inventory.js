import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { ah } from '../utils/httpError.js';

// Inventory views — FRS §15.2 (inventory update on accepted receipt), §20.1.
const r = Router();
r.use(authenticate, requirePermission('inventory.view'));

// GET /api/inventory/balances?divisionId=&search= — aggregated stock per division/product/size
r.get('/balances', ah(async (req, res) => {
  const { divisionId, search } = req.query;
  const clauses = []; const params = [];
  if (!req.user.isSuperAdmin) { params.push(req.user.divisionIds); clauses.push(`t.division_id = ANY($${params.length}::uuid[])`); }
  if (divisionId) { params.push(divisionId); clauses.push(`t.division_id = $${params.length}`); }
  if (search) { params.push(`%${search}%`); clauses.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const { rows } = await query(
    `SELECT d.name AS division_name, p.sku, p.name AS product_name, COALESCE(z.label,'—') AS size_label,
            SUM(t.quantity) AS balance
       FROM inventory_transactions t
       JOIN divisions d ON d.id = t.division_id
       JOIN products p ON p.id = t.product_id
       LEFT JOIN sizes z ON z.id = t.size_id
       ${where}
       GROUP BY d.name, p.sku, p.name, z.label
       HAVING SUM(t.quantity) <> 0
       ORDER BY p.name, z.label`, params);
  res.json({ data: rows });
}));

// GET /api/inventory/transactions — raw movement log
r.get('/transactions', ah(async (req, res) => {
  const params = [];
  let scope = '';
  if (!req.user.isSuperAdmin) { params.push(req.user.divisionIds); scope = `WHERE t.division_id = ANY($1::uuid[])`; }
  const { rows } = await query(
    `SELECT t.*, p.sku, p.name AS product_name, d.code AS division_code, rc.receipt_number
       FROM inventory_transactions t
       JOIN products p ON p.id = t.product_id
       JOIN divisions d ON d.id = t.division_id
       LEFT JOIN receipt_items ri ON ri.id = t.receipt_item_id
       LEFT JOIN receipts rc ON rc.id = ri.receipt_id
       ${scope} ORDER BY t.created_at DESC LIMIT 500`, params);
  res.json({ data: rows });
}));

export default r;
