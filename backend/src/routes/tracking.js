import { Router } from 'express';
import { query, pool } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';

// Live session tracking — heartbeat, logout, admin live monitor (FRS §17, §6.2).
const r = Router();

// ---------- helpers ----------
function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket?.remoteAddress ? String(req.socket.remoteAddress).replace('::ffff:', '') : null;
}

function parseUa(ua = '') {
  const s = String(ua);
  let browser = 'Unknown browser';
  if (/edg\//i.test(s)) browser = 'Edge';
  else if (/opr\/|opera/i.test(s)) browser = 'Opera';
  else if (/chrome|crios/i.test(s)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(s)) browser = 'Firefox';
  else if (/safari/i.test(s)) browser = 'Safari';
  let os = 'Unknown OS';
  if (/windows/i.test(s)) os = 'Windows';
  else if (/android/i.test(s)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(s)) os = 'iOS';
  else if (/mac os x|macintosh/i.test(s)) os = 'macOS';
  else if (/linux/i.test(s)) os = 'Linux';
  const deviceType = /mobile/i.test(s) ? 'mobile' : /tablet|ipad/i.test(s) ? 'tablet' : 'desktop';
  return { browser, os, deviceType };
}

async function getSetting(key) {
  const { rows } = await query(`SELECT value FROM settings WHERE key = $1`, [key]);
  return rows[0]?.value || {};
}

// ---------- POST /api/tracking/heartbeat ----------
// Client calls every ~20s and on route change. Upserts the per-tab session row.
r.post('/heartbeat', authenticate, ah(async (req, res) => {
  const { tabId, route, title, screen, lat, lng, accuracy, devtools } = req.body || {};
  if (!tabId) throw badRequest('tabId is required');
  const ip = clientIp(req);
  const ua = req.headers['user-agent'] || '';
  const { browser, os, deviceType } = parseUa(ua);
  const dev = !!devtools;

  const existing = (await query(
    `SELECT id, devtools_seen FROM user_sessions WHERE user_id=$1 AND tab_id=$2`,
    [req.user.id, String(tabId)])).rows[0];

  if (!existing) {
    await query(
      `INSERT INTO user_sessions (user_id, tab_id, ip_address, user_agent, device_type, browser, os, screen,
                                  current_route, current_title, latitude, longitude, location_accuracy, devtools_seen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [req.user.id, String(tabId), ip, ua, deviceType, browser, os, screen || null,
       route || null, title || null,
       Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null, Number.isFinite(accuracy) ? accuracy : null,
       dev]);
    await logAudit(pool, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'login', entityType: 'session', entityId: req.user.id,
      afterValue: { ip, browser, os, deviceType, route },
    }).catch(() => {});
  } else {
    await query(
      `UPDATE user_sessions SET last_seen_at = now(), logout_at = NULL, ended_reason = NULL,
              current_route = COALESCE($2, current_route), current_title = COALESCE($3, current_title),
              screen = COALESCE($4, screen),
              latitude = COALESCE($5, latitude), longitude = COALESCE($6, longitude), location_accuracy = COALESCE($7, location_accuracy),
              ip_address = COALESCE($8, ip_address),
              devtools_seen = devtools_seen OR $9
        WHERE id = $1`,
      [existing.id, route || null, title || null, screen || null,
       Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null, Number.isFinite(accuracy) ? accuracy : null,
       ip, dev]);
  }

  // First DevTools sighting for this session → audit event the admin can see.
  if (dev && existing && !existing.devtools_seen) {
    await logAudit(pool, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'devtools_detected', entityType: 'session',
      entityId: req.user.id, afterValue: { ip, route, browser, os },
    }).catch(() => {});
  }

  const security = await getSetting('security');
  const { rows: [c] } = await query(
    `SELECT count(*)::int AS online FROM user_sessions
      WHERE logout_at IS NULL AND last_seen_at > now() - interval '45 seconds'`);
  res.json({ serverTime: new Date().toISOString(), devtoolsBlock: security.devtoolsBlock !== false, onlineCount: c.online });
}));

// ---------- POST /api/tracking/logout ----------
// Marks the caller's current tab session ended (client fires this on sign-out).
r.post('/logout', authenticate, ah(async (req, res) => {
  const { tabId, reason } = req.body || {};
  if (!tabId) throw badRequest('tabId is required');
  const { rowCount } = await query(
    `UPDATE user_sessions SET logout_at = now(), ended_reason = COALESCE($3, 'logout')
      WHERE user_id = $1 AND tab_id = $2 AND logout_at IS NULL`,
    [req.user.id, String(tabId), reason || 'logout']);
  if (rowCount) {
    await logAudit(pool, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'logout', entityType: 'session', entityId: req.user.id,
    }).catch(() => {});
  }
  res.json({ ok: true });
}));

// ---------- GET /api/tracking/live — admin live monitor ----------
r.get('/live', authenticate, requirePermission('audit.view'), ah(async (req, res) => {
  const online = (await query(
    `SELECT s.id, s.user_id, s.login_at, s.last_seen_at, s.ip_address, s.browser, s.os, s.device_type,
            s.screen, s.current_route, s.current_title, s.latitude, s.longitude, s.location_accuracy,
            s.devtools_seen,
            u.full_name, u.email, u.profile_photo_url,
            COALESCE((SELECT string_agg(r2.code, ', ') FROM user_roles ur JOIN roles r2 ON r2.id = ur.role_id WHERE ur.user_id = u.id), '') AS roles
       FROM user_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.logout_at IS NULL AND s.last_seen_at > now() - interval '45 seconds'
      ORDER BY s.last_seen_at DESC`)).rows;

  const { rows: [counts] } = await query(
    `SELECT
        (SELECT count(DISTINCT user_id)::int FROM user_sessions
          WHERE login_at >= date_trunc('day', now())) AS logins_today,
        (SELECT count(*)::int FROM user_sessions
          WHERE logout_at >= date_trunc('day', now())) AS logouts_today,
        (SELECT count(*)::int FROM user_sessions
          WHERE devtools_seen AND last_seen_at > now() - interval '24 hours') AS devtools_alerts_24h,
        (SELECT count(*)::int FROM user_sessions
          WHERE logout_at IS NULL) AS open_sessions`);

  const recent = (await query(
    `SELECT s.id, s.user_id, u.full_name, s.login_at, s.logout_at, s.ended_reason, s.ip_address,
            s.browser, s.os, s.device_type, s.devtools_seen, s.current_route
       FROM user_sessions s JOIN users u ON u.id = s.user_id
      ORDER BY s.login_at DESC LIMIT 25`)).rows;

  res.json({ online, counts, recent });
}));

// ---------- GET /api/tracking/sessions — session history ----------
r.get('/sessions', authenticate, requirePermission('audit.view'), ah(async (req, res) => {
  const { userId, limit = 100 } = req.query;
  const params = [];
  let where = 'TRUE';
  if (userId) { params.push(userId); where = `s.user_id = $${params.length}`; }
  params.push(Math.min(500, Number(limit) || 100));
  const { rows } = await query(
    `SELECT s.*, u.full_name, u.email
       FROM user_sessions s JOIN users u ON u.id = s.user_id
      WHERE ${where}
      ORDER BY s.login_at DESC LIMIT $${params.length}`, params);
  res.json({ data: rows });
}));

export default r;
