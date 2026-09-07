import { Router } from 'express';
import { query, pool } from '../config/db.js';
import { authenticate, scopeDivision } from '../middleware/auth.js';
import { badRequest, ah } from '../utils/httpError.js';
import { chatBus } from '../ws/chat.js';

// Division-scoped team chat — FRS §18 (communication), persisted + live via /ws/chat.
const r = Router();
r.use(authenticate);

// GET /api/chat/messages?divisionId=&limit=100 — history, oldest → newest
r.get('/messages', ah(async (req, res) => {
  const { divisionId } = req.query;
  if (divisionId) scopeDivision(req, divisionId);
  const params = [divisionId || null, Math.min(Number(req.query.limit) || 100, 200)];
  const { rows } = await query(
    `SELECT cm.id, cm.division_id, cm.body, cm.created_at,
            u.full_name AS user_name, u.username, ro.name AS role_label,
            d.code AS division_code, d.name AS division_name
       FROM chat_messages cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN divisions d ON d.id = cm.division_id
       LEFT JOIN LATERAL (
         SELECT r2.name FROM user_roles ur JOIN roles r2 ON r2.id = ur.role_id
          WHERE ur.user_id = u.id LIMIT 1) ro ON TRUE
      WHERE ($1::uuid IS NULL OR cm.division_id = $1::uuid)
      ORDER BY cm.created_at DESC LIMIT $2`, params);
  res.json({ data: rows.reverse() });
}));

// POST /api/chat/messages {divisionId?, body} — persist + live broadcast
r.post('/messages', ah(async (req, res) => {
  const { divisionId } = req.body || {};
  const body = (req.body?.body || '').trim();
  if (!body) throw badRequest('Message body is required');
  if (body.length > 2000) throw badRequest('Message too long (max 2000 characters)');
  if (divisionId) scopeDivision(req, divisionId);

  const { rows: [msg] } = await query(
    `INSERT INTO chat_messages (division_id, user_id, body)
     VALUES ($1, $2, $3) RETURNING id, division_id, body, created_at`,
    [divisionId || null, req.user.id, body]);

  const full = (await query(
    `SELECT cm.id, cm.division_id, cm.body, cm.created_at,
            u.full_name AS user_name, u.username, ro.name AS role_label,
            d.code AS division_code, d.name AS division_name
       FROM chat_messages cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN divisions d ON d.id = cm.division_id
       LEFT JOIN LATERAL (
         SELECT r2.name FROM user_roles ur JOIN roles r2 ON r2.id = ur.role_id
          WHERE ur.user_id = u.id LIMIT 1) ro ON TRUE
      WHERE cm.id = $1`, [msg.id])).rows[0];

  chatBus.emit('message', full);
  res.status(201).json({ data: full });
}));

export default r;
