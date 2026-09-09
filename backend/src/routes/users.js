import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction, pool } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, forbidden, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';

const r = Router();
r.use(authenticate);

// ---------- SELF-SERVICE (any signed-in user) ----------
// GET /api/users/me — fresh session payload (photo, roles, permissions)
r.get('/me', ah(async (req, res) => {
  res.json({ data: req.user });
}));

// PATCH /api/users/me — own name / phone / designation only
// Completing the profile clears the profile-update gate (profile_updated_at).
r.patch('/me', ah(async (req, res) => {
  const { fullName, phone, designation } = req.body || {};
  if (!fullName || String(fullName).trim().length < 3) throw badRequest('Full name (min 3 characters) is required to complete your profile');
  const { rows } = await query(
    `UPDATE users SET full_name=$2, phone=COALESCE($3,phone),
            designation=COALESCE($4,designation), profile_updated_at=now(), updated_at=now()
     WHERE id=$1 RETURNING full_name, phone, designation, profile_updated_at`,
    [req.user.id, String(fullName).trim(), phone || null, designation || null]);
  await logAudit(pool, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'profile_update', entityType: 'user', entityId: req.user.id,
  }).catch(() => {});
  res.json({ data: rows[0] });
}));

// ---------- ADMINISTRATION (users.manage) ----------
r.use(requirePermission('users.manage'));

// GET /api/users — list with roles + division scope
r.get('/', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.username, u.full_name, u.phone, u.status, u.mfa_enabled,
            u.profile_photo_url, u.designation, u.profile_updated_at,
            u.force_password_reset, u.last_login_at, u.created_at,
            COALESCE((SELECT json_agg(r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '[]') AS roles,
            COALESCE((SELECT json_agg(ud.division_id) FROM user_divisions ud WHERE ud.user_id = u.id), '[]') AS division_ids,
            COALESCE((SELECT json_agg(us.section_id) FROM user_sections us WHERE us.user_id = u.id), '[]') AS section_ids
       FROM users u ORDER BY u.created_at DESC`
  );
  res.json({ data: rows });
}));

// POST /api/users — TC-01: create a user and assign a role and division
// RBAC: only the Administrator decides roles and access scope. Other account
// creators create the login; the role is attached afterwards by the admin.
r.post('/', ah(async (req, res) => {
  const { email, username, fullName, phone, password, roles = [], divisionIds = [], sections = [], sectionIds = [] } = req.body || {};
  if (!email || !username || !fullName || !password) throw badRequest('email, username, fullName, password are required');
  if (password.length < 8) throw badRequest('Password must be at least 8 characters');
  if (!req.user.isSuperAdmin && (roles.length || divisionIds.length || sections.length || sectionIds.length)) {
    throw forbidden('Only the Administrator can assign roles and access scope — the account was not created');
  }

  const user = await withTransaction(async (client) => {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(
      `INSERT INTO users (email, username, password_hash, full_name, phone)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [email, username, hash, fullName, phone || null]
    );
    const u = rows[0];
    for (const code of roles) {
      await client.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code=$2 ON CONFLICT DO NOTHING`, [u.id, code]);
    }
    for (const d of divisionIds) {
      await client.query(`INSERT INTO user_divisions (user_id, division_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [u.id, d]);
    }
    for (const s of sections) {
      await client.query(`INSERT INTO user_sections (user_id, section_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [u.id, s]);
    }
    for (const s of sectionIds) {
      await client.query(`INSERT INTO user_sections (user_id, section_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [u.id, s]);
    }
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'create',
      entityType: 'user', entityId: u.id, afterValue: { email, username, roles, divisionIds },
    });
    return u;
  });
  res.status(201).json({ data: { id: user.id } });
}));

// PATCH /api/users/:id — status, name, role/division reassignment, forced reset
// Administrator-only: account creators may create logins but never edit them.
r.patch('/:id', ah(async (req, res) => {
  if (!req.user.isSuperAdmin) throw forbidden('Only the Administrator can edit users');
  const { id } = req.params;
  const { fullName, phone, status, forcePasswordReset, roles, divisionIds, sectionIds } = req.body || {};
  const before = (await query(`SELECT full_name, phone, status, force_password_reset FROM users WHERE id=$1`, [id])).rows[0];
  if (!before) throw badRequest('User not found');

  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE users SET
         full_name = COALESCE($2, full_name),
         phone = COALESCE($3, phone),
         status = COALESCE($4, status),
         force_password_reset = COALESCE($5, force_password_reset)
       WHERE id = $1 RETURNING *`,
      [id, fullName || null, phone || null, status || null, forcePasswordReset === undefined ? null : forcePasswordReset]
    );
    if (roles) {
      await client.query(`DELETE FROM user_roles WHERE user_id=$1`, [id]);
      for (const code of roles) {
        await client.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code=$2`, [id, code]);
      }
    }
    if (divisionIds) {
      await client.query(`DELETE FROM user_divisions WHERE user_id=$1`, [id]);
      for (const d of divisionIds) {
        await client.query(`INSERT INTO user_divisions (user_id, division_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, d]);
      }
    }
    if (sectionIds) {
      await client.query(`DELETE FROM user_sections WHERE user_id=$1`, [id]);
      for (const s of sectionIds) {
        await client.query(`INSERT INTO user_sections (user_id, section_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, s]);
      }
    }
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit', entityType: 'user', entityId: id,
      beforeValue: before, afterValue: rows[0],
    });
  });
  res.json({ ok: true });
}));

// POST /api/users/:id/reset-password — admin reset (§6.2 forced-reset capability)
// Administrator-only.
r.post('/:id/reset-password', ah(async (req, res) => {
  if (!req.user.isSuperAdmin) throw forbidden('Only the Administrator can reset passwords');
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) throw badRequest('newPassword must be at least 8 characters');
  const hash = await bcrypt.hash(newPassword, 10);
  await withTransaction(async (client) => {
    await client.query(`UPDATE users SET password_hash=$1, force_password_reset=true WHERE id=$2`, [hash, req.params.id]);
    await logAudit(client, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'password_reset', entityType: 'user', entityId: req.params.id,
    });
  });
  res.json({ ok: true });
}));

// Reference data for the user-management screens
r.get('/_meta/roles', ah(async (req, res) => {
  const { rows } = await query(`SELECT id, code, name, description FROM roles ORDER BY code`);
  res.json({ data: rows });
}));

export default r;
