import { Router } from 'express';
import { query, pool } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';

const r = Router();
r.use(authenticate);

// ---------- AUDIT (§17.1, AU-01) — immutable, filterable ----------
r.get('/audit-logs', requirePermission('audit.view'), ah(async (req, res) => {
  const { userId, entityType, entityId, actionType, from, to, page = 1, pageSize = 50 } = req.query;
  const clauses = []; const params = [];
  if (!req.user.isSuperAdmin && req.user.permissions.includes('audit.view')) {
    params.push(req.user.divisionIds);
    clauses.push(`(al.division_id = ANY($${params.length}::uuid[]) OR al.division_id IS NULL)`);
  }
  if (userId) { params.push(userId); clauses.push(`al.user_id = $${params.length}`); }
  if (entityType) { params.push(entityType); clauses.push(`al.entity_type = $${params.length}`); }
  if (entityId) { params.push(entityId); clauses.push(`al.entity_id = $${params.length}`); }
  if (actionType) { params.push(actionType); clauses.push(`al.action_type = $${params.length}`); }
  if (from) { params.push(from); clauses.push(`al.occurred_at >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`al.occurred_at <= $${params.length}`); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const limit = Math.min(Number(pageSize) || 50, 200);
  const offset = (Math.max(Number(page), 1) - 1) * limit;
  params.push(limit, offset);
  const { rows } = await query(
    `SELECT al.*, u.full_name AS user_name, d.code AS division_code
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       LEFT JOIN divisions d ON d.id = al.division_id
       ${where} ORDER BY al.occurred_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ data: rows, page: Number(page), pageSize: limit });
}));

// ---------- NOTIFICATIONS (§18) ----------
r.get('/notifications', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 50`, [req.user.id]);
  const { rows: [{ unread }] } = await query(
    `SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND is_read = false`, [req.user.id]);
  res.json({ data: rows, unread });
}));

r.post('/notifications/read-all', ah(async (req, res) => {
  await query(`UPDATE notifications SET is_read = true, read_at = now() WHERE user_id = $1 AND is_read = false`, [req.user.id]);
  res.json({ ok: true });
}));

r.post('/notifications/:id/read', ah(async (req, res) => {
  await query(`UPDATE notifications SET is_read = true, read_at = now() WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ---------- SETTINGS (super-admin managed; read for all authenticated) ----------
r.get('/settings', ah(async (req, res) => {
  const { rows } = await query(`SELECT key, value, description FROM settings ORDER BY key`);
  res.json({ data: rows });
}));

r.put('/settings/:key', requirePermission('settings.manage'), ah(async (req, res) => {
  const { value, description } = req.body || {};
  if (value === undefined) throw badRequest('value is required');
  const { rows } = await query(
    `INSERT INTO settings (key, value, description, updated_by)
     VALUES ($1, $2::jsonb, $3, $4)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = COALESCE(EXCLUDED.description, settings.description), updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING *`,
    [req.params.key, JSON.stringify(value), description || null, req.user.id]);
  await logAudit(pool, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit',
    entityType: 'setting', entityId: req.params.key, afterValue: { value },
  });
  res.json({ data: rows[0] });
}));

export default r;
