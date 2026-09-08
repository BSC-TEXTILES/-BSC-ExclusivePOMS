import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { publicUrl } from '../utils/storage.js';

const r = Router();
r.use(authenticate);

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function generateCsv(headers, rows) {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escapeCsv(row[h])).join(','));
  }
  return lines.join('\n');
}

// GET /api/csv-exports — list export history
r.get('/', requirePermission('csv_export'), ah(async (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
  const params = [];
  let where = '';
  if (type) { params.push(type); where += ` AND e.export_type = $${params.length}`; }
  const countParams = [...params];
  params.push(Number(limit), offset);
  const { rows: [{ count }] } = await query(`SELECT count(*)::int FROM csv_exports e WHERE 1=1${where}`, countParams);
  const { rows } = await query(
    `SELECT e.*, u.full_name AS generated_by_name
     FROM csv_exports e LEFT JOIN users u ON u.id = e.generated_by
     WHERE 1=1${where} ORDER BY e.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ data: rows.map(x => ({ ...x, url: publicUrl(x.storage_key) })), total: count });
}));

// POST /api/csv-exports/orders — export orders
r.post('/orders', requirePermission('csv_export'), ah(async (req, res) => {
  const { from, to, status, customerId } = req.body || {};
  const params = [];
  let where = ' WHERE 1=1';
  if (from) { params.push(from); where += ` AND o.order_date >= $${params.length}::date`; }
  if (to) { params.push(to); where += ` AND o.order_date <= $${params.length}::date`; }
  if (status) { params.push(status); where += ` AND o.status = $${params.length}`; }
  if (customerId) { params.push(customerId); where += ` AND o.customer_id = $${params.length}`; }
  const { rows } = await query(
    `SELECT o.order_number, c.name AS customer, o.order_date, o.required_date,
            o.status, o.priority, o.subtotal, o.tax_amount, o.grand_total,
            u.full_name AS created_by, su.full_name AS supervisor
     FROM om_orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     LEFT JOIN users u ON u.id = o.created_by
     LEFT JOIN users su ON su.id = o.assigned_supervisor_id
     ${where} ORDER BY o.order_date DESC`, params);
  const headers = ['order_number', 'customer', 'order_date', 'required_date', 'status', 'priority', 'subtotal', 'tax_amount', 'grand_total', 'created_by', 'supervisor'];
  const csv = generateCsv(headers, rows);
  const fileName = `orders_export_${Date.now()}.csv`;
  const storageKey = `csv-exports/${fileName}`;
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
  const dir = path.join(uploadsDir, 'csv-exports');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), csv, 'utf-8');
  const { rows: [exportRecord] } = await query(
    `INSERT INTO csv_exports (file_name, export_type, filters, file_size, storage_key, generated_by)
     VALUES ($1,'orders',$2,$3,$4,$5) RETURNING *`,
    [fileName, JSON.stringify({ from, to, status, customerId }), Buffer.byteLength(csv), storageKey, req.user.id]);
  await logAudit(query, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'csv_export',
    entityType: 'csv_export', entityId: exportRecord.id, afterValue: { type: 'orders', rows: rows.length },
  });
  res.json({ data: { ...exportRecord, url: publicUrl(exportRecord.storage_key), csv, rowCount: rows.length } });
}));

// POST /api/csv-exports/users — export users
r.post('/users', requirePermission('csv_export'), ah(async (req, res) => {
  const { rows } = await query(
    `SELECT u.username, u.full_name, u.email, u.phone, u.status, u.last_login_at, u.created_at,
            COALESCE(string_agg(r.name, ', '), '') AS roles
     FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id
     GROUP BY u.id ORDER BY u.created_at DESC`);
  const headers = ['username', 'full_name', 'email', 'phone', 'status', 'roles', 'last_login_at', 'created_at'];
  const csv = generateCsv(headers, rows);
  const fileName = `users_export_${Date.now()}.csv`;
  const storageKey = `csv-exports/${fileName}`;
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
  const dir = path.join(uploadsDir, 'csv-exports');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), csv, 'utf-8');
  const { rows: [exportRecord] } = await query(
    `INSERT INTO csv_exports (file_name, export_type, file_size, storage_key, generated_by)
     VALUES ($1,'users',$2,$3,$4) RETURNING *`,
    [fileName, Buffer.byteLength(csv), storageKey, req.user.id]);
  await logAudit(query, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'csv_export',
    entityType: 'csv_export', entityId: exportRecord.id, afterValue: { type: 'users', rows: rows.length },
  });
  res.json({ data: { ...exportRecord, url: publicUrl(exportRecord.storage_key), csv, rowCount: rows.length } });
}));

// POST /api/csv-exports/production — export production data
r.post('/production', requirePermission('csv_export'), ah(async (req, res) => {
  const { rows } = await query(
    `SELECT u.full_name AS user_name, o.order_number, p.name AS product_name, i.size_label, i.quantity,
            t.status, t.started_at, t.completed_at, t.production_notes,
            EXTRACT(EPOCH FROM (t.completed_at - t.started_at))/3600 AS duration_hours
     FROM production_tasks t
     LEFT JOIN om_orders o ON o.id = t.order_id
     LEFT JOIN om_order_items i ON i.id = t.order_item_id
     LEFT JOIN products p ON p.id = i.product_id
     LEFT JOIN users u ON u.id = t.assigned_user_id
     ORDER BY t.created_at DESC`);
  const headers = ['user_name', 'order_number', 'product_name', 'size_label', 'quantity', 'status', 'started_at', 'completed_at', 'production_notes', 'duration_hours'];
  const csv = generateCsv(headers, rows);
  const fileName = `production_export_${Date.now()}.csv`;
  const storageKey = `csv-exports/${fileName}`;
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
  const dir = path.join(uploadsDir, 'csv-exports');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), csv, 'utf-8');
  const { rows: [exportRecord] } = await query(
    `INSERT INTO csv_exports (file_name, export_type, file_size, storage_key, generated_by)
     VALUES ($1,'production',$2,$3,$4) RETURNING *`,
    [fileName, Buffer.byteLength(csv), storageKey, req.user.id]);
  await logAudit(query, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'csv_export',
    entityType: 'csv_export', entityId: exportRecord.id, afterValue: { type: 'production', rows: rows.length },
  });
  res.json({ data: { ...exportRecord, url: publicUrl(exportRecord.storage_key), csv, rowCount: rows.length } });
}));

// GET /api/csv-exports/:id/download
r.get('/:id/download', ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM csv_exports WHERE id=$1`, [req.params.id]);
  if (!rows[0]) throw badRequest('Export not found');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
  const filePath = path.join(uploadsDir, rows[0].storage_key);
  if (!fs.existsSync(filePath)) throw badRequest('File not found');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${rows[0].file_name}"`);
  fs.createReadStream(filePath).pipe(res);
}));

export default r;
