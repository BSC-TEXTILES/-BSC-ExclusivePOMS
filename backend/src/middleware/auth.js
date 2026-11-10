import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { ApiError, forbidden } from '../utils/httpError.js';

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function verifyToken(token) {
  const hashed = hashToken(token);
  const { rows } = await query(
    `SELECT user_id FROM user_sessions WHERE token_hash = $1 AND logout_at IS NULL`,
    [hashed]
  );
  if (!rows || rows.length === 0) throw new Error('Session invalid or expired');
  return { userId: rows[0].user_id, sub: rows[0].user_id };
}

const USER_SELECT = `
  SELECT u.id, u.email, u.username, u.full_name, u.status, u.force_password_reset,
         u.profile_photo_url, u.designation, u.profile_updated_at,
         u.password_changed_at, u.failed_attempts, u.locked_until,
         COALESCE(json_agg(DISTINCT r.code)  FILTER (WHERE r.code  IS NOT NULL), '[]')  AS roles,
         COALESCE(json_agg(DISTINCT ud.division_id::text) FILTER (WHERE ud.division_id IS NOT NULL), '[]') AS division_ids,
         COALESCE(json_agg(DISTINCT us.section_id::text)  FILTER (WHERE us.section_id IS NOT NULL), '[]') AS section_ids,
         COALESCE(json_agg(DISTINCT p.code)  FILTER (WHERE p.code  IS NOT NULL), '[]')  AS permissions
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r       ON r.id = ur.role_id
    LEFT JOIN user_divisions ud ON ud.user_id = u.id
    LEFT JOIN user_sections us ON us.user_id = u.id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
   WHERE u.id = $1
   GROUP BY u.id`;

const USER_SELECT_BY_EMAIL = `
  SELECT u.id, u.email, u.username, u.full_name, u.status, u.force_password_reset,
         u.profile_photo_url, u.designation, u.profile_updated_at,
         u.password_changed_at, u.failed_attempts, u.locked_until,
         COALESCE(json_agg(DISTINCT r.code)  FILTER (WHERE r.code  IS NOT NULL), '[]')  AS roles,
         COALESCE(json_agg(DISTINCT ud.division_id::text) FILTER (WHERE ud.division_id IS NOT NULL), '[]') AS division_ids,
         COALESCE(json_agg(DISTINCT us.section_id::text)  FILTER (WHERE us.section_id IS NOT NULL), '[]') AS section_ids,
         COALESCE(json_agg(DISTINCT p.code)  FILTER (WHERE p.code  IS NOT NULL), '[]')  AS permissions
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r       ON r.id = ur.role_id
    LEFT JOIN user_divisions ud ON ud.user_id = u.id
    LEFT JOIN user_sections us ON us.user_id = u.id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
   WHERE lower(u.email) = lower($1)
   GROUP BY u.id`;

function dedupe(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter(Boolean))];
}

function parseRow(u) {
  if (!u) return null;
  const roles = dedupe(typeof u.roles === 'string' ? JSON.parse(u.roles) : u.roles);
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    fullName: u.full_name,
    status: u.status,
    forcePasswordReset: u.force_password_reset,
    profilePhotoUrl: u.profile_photo_url,
    designation: u.designation,
    roles,
    divisionIds: dedupe(typeof u.division_ids === 'string' ? JSON.parse(u.division_ids) : u.division_ids),
    sectionIds: dedupe(typeof u.section_ids === 'string' ? JSON.parse(u.section_ids) : u.section_ids),
    permissions: dedupe(typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions),
    profileUpdatedAt: u.profile_updated_at,
    passwordChangedAt: u.password_changed_at,
    failedAttempts: u.failed_attempts,
    lockedUntil: u.locked_until,
    isSuperAdmin: roles.includes('super_admin'),
  };
}

export async function loadUser(userId) {
  const { rows } = await query(USER_SELECT, [userId]);
  return parseRow(rows[0]);
}

export async function loadUserByEmail(email) {
  const { rows } = await query(USER_SELECT_BY_EMAIL, [email]);
  return parseRow(rows[0]);
}

/**
 * Authenticate middleware — verifies hashed token from DB and loads RBAC.
 */
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Authentication required');

    const hashed = hashToken(token);
    
    // Look up active session
    const { rows } = await query(
      `SELECT user_id FROM user_sessions WHERE token_hash = $1 AND logout_at IS NULL`,
      [hashed]
    );
    
    if (rows.length === 0) {
      throw new ApiError(401, 'Session invalid or expired — please sign in again');
    }

    const userId = rows[0].user_id;
    let user = await loadUser(userId);

    if (!user || user.status !== 'active') throw new ApiError(401, 'Account inactive or missing');

    // Update last_seen_at for session
    await query(`UPDATE user_sessions SET last_seen_at = now() WHERE token_hash = $1`, [hashed]).catch(() => {});

    req.user = user;
    req.sessionId = hashed; // Attach session hash for logout
    req.requestId = req.headers['x-request-id'] || null;
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Middleware: require a specific permission (or super_admin).
 */
export function requirePermission(code) {
  return (req, res, next) => {
    if (req.user.isSuperAdmin || req.user.permissions.includes(code)) return next();
    next(forbidden(`Missing permission: ${code}`));
  };
}

/**
 * Middleware: require ANY of the listed permissions (or super_admin).
 */
export function requireAnyPermission(codes) {
  return (req, res, next) => {
    if (req.user.isSuperAdmin) return next();
    if (codes.some(c => req.user.permissions.includes(c))) return next();
    next(forbidden(`Missing any of permissions: ${codes.join(', ')}`));
  };
}

// RB-001: user may act only within divisions granted by authorization policy.
export function scopeDivision(req, divisionId) {
  if (req.user.isSuperAdmin) return;
  if (!req.user.divisionIds.includes(String(divisionId))) {
    throw forbidden('Division out of authorized scope (RB-001)');
  }
}

// Collection (section) scope: a user assigned specific collections may only
// operate on those. Super admin and users without a collection restriction
// (empty scope) pass through.
export function scopeSection(req, sectionId) {
  if (req.user.isSuperAdmin) return;
  const ids = req.user.sectionIds || [];
  if (ids.length && !ids.includes(String(sectionId))) {
    throw forbidden('Collection out of authorized scope — you are not assigned to this collection');
  }
}
