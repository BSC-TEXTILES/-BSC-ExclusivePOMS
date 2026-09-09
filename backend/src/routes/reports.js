import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, ah } from '../utils/httpError.js';

// Dashboards, reporting and analytics — FRS §16, RB-018 (no cross-division leakage).
const r = Router();
r.use(authenticate, requirePermission('reports.view'));

function scopeParams(req) {
  if (req.user.isSuperAdmin) return { all: true, ids: null };
  return { all: false, ids: req.user.divisionIds };
}

// Dashboard scoping: division scope (RB-001) AND collection scope. A user
// assigned only the Men's collection sees Men's numbers only — no leakage.
function poScope(req) {
  const clauses = [];
  const params = [];
  // Optional section filter from query params (for section-specific dashboards)
  if (req.query.sectionId) {
    params.push(req.query.sectionId);
    clauses.push(`po.section_id = $${params.length}::uuid`);
  } else if (!req.user.isSuperAdmin) {
    params.push(req.user.divisionIds || []);
    clauses.push(`po.division_id = ANY($${params.length}::uuid[])`);
    const sec = req.user.sectionIds || [];
    if (sec.length) {
      params.push(sec);
      clauses.push(`po.section_id = ANY($${params.length}::uuid[])`);
    }
  }
  return { params, W: clauses.length ? clauses.join(' AND ') : 'TRUE' };
}

// GET /api/reports/dashboard — §16.1 / §16.2 combined dashboard payload
r.get('/dashboard', ah(async (req, res) => {
  const s = scopeParams(req);
  const { params, W } = poScope(req);

  const kpis = (await query(
    `SELECT count(*)::int AS total_pos,
            COALESCE(SUM(po.grand_total),0) AS total_value,
            COALESCE(SUM(po.order_discount_amount),0) AS total_discount,
            count(*) FILTER (WHERE po.status IN ('submitted','under_review'))::int AS pending_approvals,
            count(*) FILTER (WHERE po.status = 'approved')::int AS approved,
            count(*) FILTER (WHERE po.status = 'issued')::int AS issued,
            count(*) FILTER (WHERE po.status = 'partially_received')::int AS partially_received,
            count(*) FILTER (WHERE po.status IN ('received','closed'))::int AS completed
       FROM purchase_orders po WHERE ${W}`, params)).rows[0];

  const byDivision = (await query(
    `SELECT d.name, d.code, count(*)::int AS pos, COALESCE(SUM(po.grand_total),0) AS value
       FROM purchase_orders po JOIN divisions d ON d.id = po.division_id
      WHERE ${W} GROUP BY d.name, d.code ORDER BY value DESC`, params)).rows;

  const byStatus = (await query(
    `SELECT po.status, count(*)::int AS count, COALESCE(SUM(po.grand_total),0) AS value
       FROM purchase_orders po WHERE ${W} GROUP BY po.status ORDER BY count DESC`, params)).rows;

  const bySection = (await query(
    `SELECT s.name AS section, dep.name AS department, count(*)::int AS pos,
            COALESCE(SUM(po.grand_total),0) AS value,
            COALESCE(SUM(po.grand_total - po.subtotal + po.order_discount_amount),0) AS approx_margin_value
       FROM purchase_orders po JOIN sections s ON s.id = po.section_id JOIN departments dep ON dep.id = po.department_id
      WHERE ${W} GROUP BY s.name, dep.name ORDER BY value DESC LIMIT 12`, params)).rows;

  const bySupplier = (await query(
    `SELECT sup.company_name, count(*)::int AS pos, COALESCE(SUM(po.grand_total),0) AS value
       FROM purchase_orders po JOIN suppliers sup ON sup.id = po.supplier_id
      WHERE ${W} GROUP BY sup.company_name ORDER BY value DESC LIMIT 10`, params)).rows;

  const recentAudit = (await query(
    `SELECT al.occurred_at, al.action_type, al.entity_type, al.entity_id::text, COALESCE(u.full_name,'System') AS actor
       FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
      WHERE (${s.all ? 'TRUE' : 'al.division_id = ANY($1::uuid[])'} OR al.division_id IS NULL)
      ORDER BY al.occurred_at DESC LIMIT 12`, s.all ? [] : [s.ids])).rows;

  const divisionAdmins = (await query(
    `SELECT d.id AS division_id, d.code AS division_code, d.name AS division_name,
            COALESCE(json_agg(json_build_object('id', u.id, 'name', u.full_name, 'email', u.email, 'photo', u.profile_photo_url))
                       FILTER (WHERE u.id IS NOT NULL), '[]') AS admins
       FROM divisions d
       LEFT JOIN user_divisions ud ON ud.division_id = d.id
       LEFT JOIN user_roles ur ON ur.user_id = ud.user_id
       LEFT JOIN roles r ON r.id = ur.role_id AND r.code = 'domain_admin'
       LEFT JOIN users u ON u.id = ud.user_id AND u.status = 'active'
      WHERE d.status <> 'archived' ${s.all ? '' : 'AND d.id = ANY($1::uuid[])'}
      GROUP BY d.id, d.code, d.name ORDER BY d.code`, s.all ? [] : [s.ids])).rows;

  // Real monthly series — last 12 months, scoped, zero-filled (no synthetic data).
  const monthly = (await query(
    `WITH months AS (
       SELECT generate_series(date_trunc('month', now()) - interval '11 months',
                              date_trunc('month', now()), interval '1 month') AS m
     ), agg AS (
       SELECT date_trunc('month', po.po_date) AS m, count(*)::int AS orders,
              COALESCE(SUM(po.grand_total),0) AS value
         FROM purchase_orders po
        WHERE ${W} AND po.po_date >= date_trunc('month', now()) - interval '11 months'
        GROUP BY 1
     )
     SELECT to_char(mm.m, 'Mon') AS label, to_char(mm.m, 'YYYY-MM') AS key,
            COALESCE(a.orders, 0)::int AS orders, COALESCE(a.value, 0)::float8 AS value
       FROM months mm LEFT JOIN agg a ON a.m = mm.m
      ORDER BY mm.m`, params)).rows;

  // Real recent purchase orders for the dashboard table.
  const recentPOs = (await query(
    `SELECT po.id, po.po_number, po.po_date, po.status, po.grand_total,
            s.name AS section_name, sup.company_name AS supplier_name, d.name AS division_name,
            (SELECT COALESCE(SUM(total_quantity),0) FROM purchase_order_items i WHERE i.po_id = po.id) AS total_quantity
       FROM purchase_orders po
       JOIN divisions d ON d.id = po.division_id
       JOIN sections s ON s.id = po.section_id
       JOIN suppliers sup ON sup.id = po.supplier_id
      WHERE ${W}
      ORDER BY po.created_at DESC LIMIT 8`, params)).rows;

  // Work progress — share of orders that reached completion, plus stage split.
  const workProgress = (await query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE po.status IN ('received','closed'))::int AS completed,
            count(*) FILTER (WHERE po.status = 'partially_received')::int AS partially_received,
            count(*) FILTER (WHERE po.status IN ('approved','issued'))::int AS approved_issued,
            count(*) FILTER (WHERE po.status IN ('submitted','under_review'))::int AS in_approval,
            count(*) FILTER (WHERE po.status = 'draft')::int AS drafts,
            count(*) FILTER (WHERE po.status = 'cancelled')::int AS cancelled
       FROM purchase_orders po WHERE ${W}`, params)).rows[0];

  // Names of the collections this user is authorized for (header chips).
  const mySections = s.all ? [] : (await query(
    `SELECT s.id::text, s.name FROM sections s JOIN user_sections us ON us.section_id = s.id
      WHERE us.user_id = $1 ORDER BY s.name`, [req.user.id])).rows;

  res.json({ kpis, byDivision, byStatus, bySection, bySupplier, recentAudit, divisionAdmins, monthly, recentPOs, workProgress, mySections });
}));

// ---------- PO CALENDAR (§16 + day-wise drill-down) ----------
// GET /api/reports/calendar?year=2026&month=9 → per-day PO counts + values
r.get('/calendar', ah(async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || (now.getMonth() + 1); // 1-12
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const params = [from, to];
  const W = req.user.isSuperAdmin ? 'TRUE' : 'po.division_id = ANY($3::uuid[])';
  if (!req.user.isSuperAdmin) params.push(req.user.divisionIds);
  const days = (await query(
    `SELECT to_char(po.po_date::date, 'YYYY-MM-DD') AS day, count(*)::int AS count, COALESCE(SUM(po.grand_total),0) AS value,
            count(*) FILTER (WHERE po.status IN ('submitted','under_review'))::int AS pending,
            count(*) FILTER (WHERE po.status IN ('received','closed','partially_received'))::int AS received
       FROM purchase_orders po
      WHERE po.po_date >= $1 AND po.po_date < $2 AND ${W}
      GROUP BY po.po_date::date ORDER BY po.po_date::date`, params)).rows;
  res.json({ year, month, days });
}));

// GET /api/reports/calendar/2026-09-07 → every PO created that day (division-scoped)
r.get('/calendar/:date', ah(async (req, res) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) throw badRequest('date must be YYYY-MM-DD');
  const params = [req.params.date];
  const W = req.user.isSuperAdmin ? 'TRUE' : 'po.division_id = ANY($2::uuid[])';
  if (!req.user.isSuperAdmin) params.push(req.user.divisionIds);
  const { rows } = await query(
    `SELECT po.id, po.po_number, po.po_date, po.status, po.version, po.grand_total,
            d.name AS division, s.name AS section, sup.company_name AS supplier,
            (SELECT count(*)::int FROM attachments a WHERE a.entity_type='purchase_order' AND a.entity_id=po.id) AS attachment_count
       FROM purchase_orders po
       JOIN divisions d ON d.id = po.division_id
       JOIN sections s ON s.id = po.section_id
       JOIN suppliers sup ON sup.id = po.supplier_id
      WHERE po.po_date::date = $1::date AND ${W}
      ORDER BY po.grand_total DESC`, params);
  const params2 = [req.params.date];
  const W2 = req.user.isSuperAdmin ? 'TRUE' : 'po.division_id = ANY($2::uuid[])';
  if (!req.user.isSuperAdmin) params2.push(req.user.divisionIds);
  const { rows: [totals] } = await query(
    `SELECT count(*)::int AS count, COALESCE(SUM(po.grand_total),0) AS value
       FROM purchase_orders po
      WHERE po.po_date::date = $1::date AND ${W2}`, params2);
  res.json({ date: req.params.date, totals, data: rows });
}));

// GET /api/reports/:name?format=csv — §16.3 reports catalogue + CSV export
r.get('/:name', ah(async (req, res) => {
  const { name } = req.params;
  const { from, to, divisionId } = req.query;
  const params = [];
  const clauses = [];
  if (!req.user.isSuperAdmin) { params.push(req.user.divisionIds); clauses.push(`po.division_id = ANY($${params.length}::uuid[])`); }
  if (divisionId) { params.push(divisionId); clauses.push(`po.division_id = $${params.length}`); }
  if (from) { params.push(from); clauses.push(`po.po_date >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`po.po_date <= $${params.length}`); }
  const W = clauses.length ? 'AND ' + clauses.join(' AND ') : '';

  const reports = {
    'po-register': `SELECT po.po_number, po.po_date, d.name AS division, s.name AS section, sup.company_name AS supplier, po.status, po.version, po.grand_total
                      FROM purchase_orders po JOIN divisions d ON d.id=po.division_id JOIN sections s ON s.id=po.section_id JOIN suppliers sup ON sup.id=po.supplier_id
                     WHERE TRUE ${W} ORDER BY po.po_date DESC`,
    'purchase-summary': `SELECT d.name AS division, dep.name AS department, s.name AS section, count(*)::int AS pos, COALESCE(SUM(po.subtotal),0) AS subtotal, COALESCE(SUM(po.tax_amount),0) AS tax, COALESCE(SUM(po.charges_amount),0) AS charges, COALESCE(SUM(po.grand_total),0) AS grand_total
                      FROM purchase_orders po JOIN divisions d ON d.id=po.division_id JOIN departments dep ON dep.id=po.department_id JOIN sections s ON s.id=po.section_id
                     WHERE TRUE ${W} GROUP BY d.name, dep.name, s.name ORDER BY d.name, s.name`,
    'dealer': `SELECT sup.company_name AS dealer, d.name AS division, count(*)::int AS pos, COALESCE(SUM(po.grand_total),0) AS ordered_value
                      FROM purchase_orders po JOIN suppliers sup ON sup.id=po.supplier_id JOIN divisions d ON d.id=po.division_id
                     WHERE TRUE ${W} GROUP BY sup.company_name, d.name ORDER BY ordered_value DESC`,
    'size': `SELECT p.sku, p.name AS product, COALESCE(z.label,'—') AS size, SUM(q.quantity)::int AS qty
                      FROM purchase_order_quantities q
                      JOIN purchase_order_items i ON i.id = q.po_item_id
                      JOIN purchase_orders po ON po.id = i.po_id
                      JOIN products p ON p.id = i.product_id
                      LEFT JOIN sizes z ON z.id = q.size_id
                     WHERE TRUE ${W} GROUP BY p.sku, p.name, z.label ORDER BY p.sku, z.label`,
    'margin': `SELECT p.name AS product, s.name AS section, d.name AS division,
                      SUM(i.total_quantity)::int AS qty,
                      ROUND(AVG(i.purchase_price),2) AS avg_purchase_price,
                      ROUND(AVG(i.net_value_per_unit - i.purchase_price),2) AS avg_margin_per_unit,
                      ROUND(100.0 * AVG(i.margin_percent),2) AS avg_margin_percent
                      FROM purchase_order_items i
                      JOIN purchase_orders po ON po.id = i.po_id
                      JOIN products p ON p.id = i.product_id
                      JOIN sections s ON s.id = po.section_id
                      JOIN divisions d ON d.id = po.division_id
                     WHERE TRUE ${W} GROUP BY p.name, s.name, d.name ORDER BY avg_margin_percent DESC`,
    'receiving': `SELECT po.po_number, sup.company_name AS supplier, i.line_no, p.sku, i.total_quantity AS ordered,
                         COALESCE(SUM(ri.accepted_qty) FILTER (WHERE rc.status='posted'),0)::int AS accepted,
                         (i.total_quantity - COALESCE(SUM(ri.accepted_qty) FILTER (WHERE rc.status='posted'),0))::int AS pending
                      FROM purchase_orders po
                      JOIN suppliers sup ON sup.id = po.supplier_id
                      JOIN purchase_order_items i ON i.po_id = po.id
                      JOIN products p ON p.id = i.product_id
                      LEFT JOIN receipt_items ri ON ri.po_item_id = i.id
                      LEFT JOIN receipts rc ON rc.id = ri.receipt_id
                     WHERE TRUE ${W}
                     GROUP BY po.po_number, sup.company_name, i.line_no, p.sku, i.total_quantity
                     ORDER BY po.po_number, i.line_no`,
  };
  const sql = reports[name];
  if (!sql) throw badRequest(`Unknown report "${name}". Available: ${Object.keys(reports).join(', ')}`);
  const { rows } = await query(sql, params);

  if (req.query.format === 'csv') {
    if (!rows.length) { res.setHeader('Content-Type', 'text/csv'); return res.send(''); }
    const cols = Object.keys(rows[0]);
    const esc = (v) => v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...rows.map((r2) => cols.map((c) => esc(r2[c])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
    return res.send(csv);
  }
  res.json({ name, columns: rows.length ? Object.keys(rows[0]) : [], data: rows });
}));

export default r;
