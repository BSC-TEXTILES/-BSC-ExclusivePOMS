import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { ah } from '../utils/httpError.js';

// Global search for the top bar — POs, products, suppliers, users (permission-gated),
// division-scoped per RB-001/RB-018.
const r = Router();
r.use(authenticate);

r.get('/search', ah(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ data: { purchaseOrders: [], products: [], suppliers: [], users: [] } });
  const like = `%${q}%`;
  const out = { purchaseOrders: [], products: [], suppliers: [], users: [] };

  const poWhere = req.user.isSuperAdmin ? '' : 'AND po.division_id = ANY($2::uuid[])';
  out.purchaseOrders = (await query(
    `SELECT po.id, po.po_number, po.status, po.grand_total, d.name AS division, sup.company_name AS supplier
       FROM purchase_orders po
       JOIN divisions d ON d.id = po.division_id
       JOIN suppliers sup ON sup.id = po.supplier_id
      WHERE (po.po_number ILIKE $1 OR sup.company_name ILIKE $1) ${poWhere}
      ORDER BY po.po_date DESC LIMIT 6`,
    req.user.isSuperAdmin ? [like] : [like, req.user.divisionIds])).rows;

  out.products = (await query(
    `SELECT p.id, p.sku, p.name, b.brand_name, s.name AS section_name
       FROM products p JOIN brands b ON b.id = p.brand_id JOIN sections s ON s.id = p.section_id
      WHERE p.status <> 'archived' AND (p.name ILIKE $1 OR p.sku ILIKE $1 OR p.product_serial ILIKE $1 OR b.brand_name ILIKE $1)
      ORDER BY p.name LIMIT 6`, [like])).rows;

  out.suppliers = (await query(
    `SELECT id, code, company_name FROM suppliers
      WHERE status <> 'archived' AND (company_name ILIKE $1 OR code ILIKE $1)
      ORDER BY company_name LIMIT 5`, [like])).rows;

  if (req.user.isSuperAdmin || req.user.permissions.includes('users.manage')) {
    out.users = (await query(
      `SELECT id, email, username, full_name, status FROM users
        WHERE full_name ILIKE $1 OR email ILIKE $1 OR username ILIKE $1
        ORDER BY full_name LIMIT 5`, [like])).rows;
  }

  res.json({ data: out });
}));

export default r;
