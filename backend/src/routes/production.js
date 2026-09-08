import { Router } from 'express';
import { query, withTransaction } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';

const r = Router();
r.use(authenticate);

// GET /api/production/tasks — list tasks for current user or all (admin/supervisor)
r.get('/tasks', ah(async (req, res) => {
  const { status, userId, orderId, page = 1, limit = 50 } = req.query;
  const params = [];
  let where = '';
  const isAdmin = req.user.isSuperAdmin || req.user.permissions.includes('order.assign');
  if (!isAdmin) {
    params.push(req.user.id);
    where += ` AND t.assigned_user_id = $${params.length}`;
  } else if (userId) {
    params.push(userId);
    where += ` AND t.assigned_user_id = $${params.length}`;
  }
  if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }
  if (orderId) { params.push(orderId); where += ` AND t.order_id = $${params.length}`; }
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
  const countParams = [...params];
  params.push(Number(limit), offset);
  const { rows: [{ count }] } = await query(`SELECT count(*)::int FROM production_tasks t WHERE 1=1${where}`, countParams);
  const { rows } = await query(
    `SELECT t.*, o.order_number, o.priority AS order_priority,
            p.name AS product_name, p.sku AS product_code,
            u.full_name AS assigned_user_name, su.full_name AS supervisor_name,
            i.size_label, i.quantity, i.sheet_id,
            ps.sheet_name, ps.color_name, ps.swatch_hex,
            img.storage_key AS image_storage_key
     FROM production_tasks t
     LEFT JOIN om_orders o ON o.id = t.order_id
     LEFT JOIN om_order_items i ON i.id = t.order_item_id
     LEFT JOIN products p ON p.id = i.product_id
     LEFT JOIN users u ON u.id = t.assigned_user_id
     LEFT JOIN users su ON su.id = t.supervisor_id
     LEFT JOIN product_sheets ps ON ps.id = i.sheet_id
     LEFT JOIN product_images img ON img.product_id = i.product_id AND img.is_primary = true
     WHERE 1=1${where}
     ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.due_date NULLS LAST
     LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ data: rows, total: count, page: Number(page), limit: Number(limit) });
}));

// POST /api/production/tasks/:id/start
r.post('/tasks/:id/start', ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM production_tasks WHERE id=$1`, [req.params.id]);
  if (!existing[0]) throw notFoundError('Task not found');
  if (existing[0].assigned_user_id !== req.user.id && !req.user.isSuperAdmin) throw badRequest('Not your task');
  if (!['pending', 'paused'].includes(existing[0].status)) throw badRequest('Task cannot be started from current status');
  await withTransaction(async (client) => {
    await client.query(`UPDATE production_tasks SET status='started', started_at=COALESCE(started_at,now()) WHERE id=$1`, [req.params.id]);
    await client.query(`UPDATE om_orders SET status='production_started' WHERE id=$1 AND status IN ('assigned','production_started')`, [existing[0].order_id]);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'production_start',
      entityType: 'production_task', entityId: req.params.id,
    });
  });
  res.json({ ok: true });
}));

// POST /api/production/tasks/:id/update
r.post('/tasks/:id/update', ah(async (req, res) => {
  const { status, notes } = req.body || {};
  const VALID = ['pending','started','in_progress','paused','completed','delayed'];
  if (!status || !VALID.includes(status)) throw badRequest('Invalid status');
  const { rows: existing } = await query(`SELECT * FROM production_tasks WHERE id=$1`, [req.params.id]);
  if (!existing[0]) throw notFoundError('Task not found');
  if (existing[0].assigned_user_id !== req.user.id && !req.user.isSuperAdmin) throw badRequest('Not your task');
  const updateFields = { status };
  if (status === 'completed') updateFields.completed_at = new Date().toISOString();
  if (notes) updateFields.production_notes = notes;
  const sets = Object.entries(updateFields).map(([k], i) => `${k}=$${i + 2}`).join(', ');
  await withTransaction(async (client) => {
    await client.query(`UPDATE production_tasks SET ${sets} WHERE id=$1`, [req.params.id, ...Object.values(updateFields)]);
    if (status === 'completed') {
      const allDone = (await client.query(
        `SELECT count(*)::int AS cnt FROM production_tasks WHERE order_id=$1 AND status != 'completed'`, [existing[0].order_id])).rows[0].cnt;
      if (allDone === 0) {
        await client.query(`UPDATE om_orders SET status='production_completed' WHERE id=$1`, [existing[0].order_id]);
      } else {
        await client.query(`UPDATE om_orders SET status='in_production' WHERE id=$1 AND status IN ('assigned','production_started')`, [existing[0].order_id]);
      }
    }
    if (status === 'in_progress') {
      await client.query(`UPDATE om_orders SET status='in_production' WHERE id=$1 AND status IN ('assigned','production_started')`, [existing[0].order_id]);
    }
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'production_update',
      entityType: 'production_task', entityId: req.params.id, beforeValue: { status: existing[0].status }, afterValue: { status },
    });
  });
  res.json({ ok: true });
}));

// GET /api/production/dashboard — supervisor/production dashboard
r.get('/dashboard', ah(async (req, res) => {
  const isAdmin = req.user.isSuperAdmin || req.user.permissions.includes('order.assign');
  const userId = req.user.id;
  const where = isAdmin ? '' : ` AND t.assigned_user_id = '${userId}'`;
  const [totalTasks, pending, inProgress, completed, overdue, todayActivity] = await Promise.all([
    query(`SELECT count(*)::int AS cnt FROM production_tasks t WHERE 1=1${where}`),
    query(`SELECT count(*)::int AS cnt FROM production_tasks t WHERE t.status IN ('pending')${where}`),
    query(`SELECT count(*)::int AS cnt FROM production_tasks t WHERE t.status IN ('started','in_progress')${where}`),
    query(`SELECT count(*)::int AS cnt FROM production_tasks t WHERE t.status = 'completed'${where}`),
    query(`SELECT count(*)::int AS cnt FROM production_tasks t WHERE t.status NOT IN ('completed') AND t.due_date < current_date${where}`),
    query(`SELECT count(*)::int AS cnt FROM daily_user_activity WHERE activity_date = current_date AND status != 'offline'`),
  ]);
  const totalUsers = (await query(`SELECT count(*)::int AS cnt FROM users WHERE status='active'`)).rows[0].cnt;
  const prodUsers = (await query(`SELECT count(*)::int AS cnt FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='men_production_user' AND u.status='active'`)).rows[0].cnt;
  const activeToday = todayActivity.rows[0].cnt;
  res.json({
    data: {
      totalTasks: totalTasks.rows[0].cnt, pending: pending.rows[0].cnt,
      inProgress: inProgress.rows[0].cnt, completed: completed.rows[0].cnt,
      overdue: overdue.rows[0].cnt, totalUsers, prodUsers, activeToday,
    }
  });
}));

// GET /api/production/daily-activity — daily activity list
r.get('/daily-activity', requirePermission('order.assign'), ah(async (req, res) => {
  const { date } = req.query;
  const d = date || new Date().toISOString().split('T')[0];
  const { rows } = await query(
    `SELECT da.*, u.full_name, u.username, r.code AS role_code
     FROM daily_user_activity da
     JOIN users u ON u.id = da.user_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE da.activity_date = $1
     ORDER BY u.full_name`, [d]);
  res.json({ data: rows, date: d });
}));

// POST /api/production/activity — track user activity
r.post('/activity', ah(async (req, res) => {
  const { status } = req.body || {};
  const today = new Date().toISOString().split('T')[0];
  await query(
    `INSERT INTO daily_user_activity (user_id, activity_date, last_activity, status)
     VALUES ($1,$2,now(),$3)
     ON CONFLICT (user_id, activity_date) DO UPDATE SET last_activity=now(), status=COALESCE($3,daily_user_activity.status)`,
    [req.user.id, today, status || 'online']);
  res.json({ ok: true });
}));

export default r;
