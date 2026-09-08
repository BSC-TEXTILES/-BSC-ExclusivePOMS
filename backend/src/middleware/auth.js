import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { ApiError, forbidden } from '../utils/httpError.js';

const USER_SELECT = `
  SELECT u.id, u.email, u.username, u.full_name, u.status, u.force_password_reset,
         u.profile_photo_url, u.designation,
         COALESCE(json_agg(DISTINCT r.code)  FILTER (WHERE r.code  IS NOT NULL), '[]')  AS roles,
         COALESCE(json_agg(DISTINCT ud.division_id::text) FILTER (WHERE ud.division_id IS NOT NULL), '[]') AS division_ids,
         COALESCE(json_agg(DISTINCT p.code)  FILTER (WHERE p.code  IS NOT NULL), '[]')  AS permissions
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r       ON r.id = ur.role_id
    LEFT JOIN user_divisions ud ON ud.user_id = u.id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
   WHERE u.id = $1
   GROUP BY u.id`;

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, type: 'access' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}
export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: process.env.REFRESH_EXPIRES_IN || '7d' });
}

export async function loadUser(userId) {
  const { rows } = await query(USER_SELECT, [userId]);
  const u = rows[0];
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    fullName: u.full_name,
    status: u.status,
    forcePasswordReset: u.force_password_reset,
    profilePhotoUrl: u.profile_photo_url,
    designation: u.designation,
    roles: u.roles,
    divisionIds: u.division_ids,
    permissions: u.permissions,
    isSuperAdmin: u.roles.includes('super_admin'),
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
    req.user = user;
    req.requestId = req.headers['x-request-id'] || null;
    next();
  } catch (e) {
    next(e);
  }
}

export function requirePermission(code) {
  return (req, res, next) => {
    if (req.user.isSuperAdmin || req.user.permissions.includes(code)) return next();
    next(forbidden(`Missing permission: ${code}`));
  };
}

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
