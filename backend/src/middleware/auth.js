import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { ApiError, forbidden } from '../utils/httpError.js';

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

export function signAccessToken(user) {
  const payload = { sub: user.id, type: 'access' };
  // Include password_changed_at to invalidate tokens after password change
  if (user.profileUpdatedAt) {
    payload.pwChanged = new Date(user.profileUpdatedAt).getTime();
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}

export function signRefreshToken(user) {
  const payload = { sub: user.id, type: 'refresh' };
  if (user.profileUpdatedAt) {
    payload.pwChanged = new Date(user.profileUpdatedAt).getTime();
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.REFRESH_EXPIRES_IN || '7d' });
}

export async function loadUser(userId) {
  const { rows } = await query(USER_SELECT, [userId]);
  const u = rows[0];
  if (!u) return null;
  const roles = typeof u.roles === 'string' ? JSON.parse(u.roles) : u.roles;
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    fullName: u.full_name,
    status: u.status,
    forcePasswordReset: u.force_password_reset,
    profilePhotoUrl: u.profile_photo_url,
    designation: u.designation,
    roles: roles,
    divisionIds: typeof u.division_ids === 'string' ? JSON.parse(u.division_ids) : u.division_ids,
    sectionIds: typeof u.section_ids === 'string' ? JSON.parse(u.section_ids) : u.section_ids,
    permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions,
    profileUpdatedAt: u.profile_updated_at,
    passwordChangedAt: u.password_changed_at,
    failedAttempts: u.failed_attempts,
    lockedUntil: u.locked_until,
    isSuperAdmin: roles.includes('super_admin'),
  };
}

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Authentication required');
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new ApiError(401, 'Session invalid or expired — please sign in again');
    }
    if (payload.type !== 'access') throw new ApiError(401, 'Invalid token type');
    const user = await loadUser(payload.sub);
    if (!user || user.status !== 'active') throw new ApiError(401, 'Account inactive or missing');

    // Token invalidation: if the token was issued before the user's last
    // password change, reject it. This ensures password changes invalidate
    // all existing sessions.
    if (payload.pwChanged && user.passwordChangedAt) {
      const tokenIssuedAt = payload.iat * 1000;
      const passwordChangedAt = new Date(user.passwordChangedAt).getTime();
      if (tokenIssuedAt < passwordChangedAt) {
        throw new ApiError(401, 'Session invalidated — password was changed. Please sign in again');
      }
    }

    req.user = user;
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
