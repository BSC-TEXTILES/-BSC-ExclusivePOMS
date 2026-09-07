import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, pool } from '../config/db.js';
import { authenticate, loadUser, signAccessToken, signRefreshToken } from '../middleware/auth.js';
import { badRequest, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';

const r = Router();

// POST /api/auth/login — §6.2 credential validation → role + division scope resolution
r.post('/login', ah(async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) throw badRequest('Identifier (email/username) and password are required');

  const { rows } = await query(
    `SELECT * FROM users WHERE (lower(email) = lower($1) OR username = $2) LIMIT 1`,
    [identifier, identifier]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    if (user) {
      await query(`UPDATE users SET failed_attempts = failed_attempts + 1,
                     locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
                   WHERE id = $1`, [user.id]);
    }
    throw badRequest('Invalid credentials');
  }
  if (user.status !== 'active') throw badRequest('Account is inactive — contact an administrator');
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw badRequest('Account temporarily locked after failed attempts — try again later');
  }

  await query(`UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`, [user.id]);
  const full = await loadUser(user.id);
  await logAudit(pool, {
    userId: full.id, role: full.roles.join(','), actionType: 'login', entityType: 'user', entityId: full.id,
  });
  res.json({
    accessToken: signAccessToken(full),
    refreshToken: signRefreshToken(full),
    user: {
      id: full.id, email: full.email, username: full.username, fullName: full.fullName,
      roles: full.roles, divisionIds: full.divisionIds, permissions: full.permissions,
      isSuperAdmin: full.isSuperAdmin, forcePasswordReset: full.forcePasswordReset,
    },
  });
}));

// POST /api/auth/refresh — rotate access token
r.post('/refresh', ah(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) throw badRequest('refreshToken required');
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
  } catch {
    throw badRequest('Refresh token invalid or expired');
  }
  if (payload.type !== 'refresh') throw badRequest('Invalid token type');
  const full = await loadUser(payload.sub);
  if (!full || full.status !== 'active') throw badRequest('Account inactive or missing');
  res.json({
    accessToken: signAccessToken(full),
    user: { id: full.id, email: full.email, fullName: full.fullName, roles: full.roles, divisionIds: full.divisionIds, permissions: full.permissions, isSuperAdmin: full.isSuperAdmin },
  });
}));

// POST /api/auth/logout — stateless client-side drop; event recorded in the audit stream
r.post('/logout', authenticate, ah(async (req, res) => {
  await logAudit(pool, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'logout',
    entityType: 'user', entityId: req.user.id,
  });
  res.status(204).end();
}));

// GET /api/auth/me — role + division scope resolution for the client
r.get('/me', authenticate, ah(async (req, res) => {
  res.json({ user: req.user });
}));

// POST /api/auth/change-password — self-service change (§6.2 password management)
r.post('/change-password', authenticate, ah(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) throw badRequest('currentPassword and newPassword are required');
  if (newPassword.length < 8) throw badRequest('New password must be at least 8 characters');
  const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) throw badRequest('Current password is incorrect');
  const hash = await bcrypt.hash(newPassword, 10);
  await query(`UPDATE users SET password_hash = $1, force_password_reset = false WHERE id = $2`, [hash, req.user.id]);
  await logAudit(pool, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'password_change', entityType: 'user', entityId: req.user.id,
  });
  res.json({ ok: true });
}));

export default r;
