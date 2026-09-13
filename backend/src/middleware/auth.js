import { createClerkClient } from '@clerk/backend';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { ApiError, forbidden } from '../utils/httpError.js';

// Sentinel bcrypt hash for Clerk SSO users (not a real password, satisfies CHECK constraint)
const CLERK_SSO_HASH = '$2b$10$IMDdMTSeQmHjGs.lYMzWYOVpCxMk.ZGvtHlEGUd2pCXW3GzTNDlV2';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

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

export async function loadUserByEmail(email) {
  const { rows } = await query(USER_SELECT_BY_EMAIL, [email]);
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

/**
 * Authenticate middleware — verifies Clerk JWT and loads the user's RBAC
 * data from PostgreSQL. The frontend sends the Clerk session token as a
 * Bearer token in the Authorization header.
 */
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Authentication required');

    let clerkUserId;
    let clerkEmail;
    try {
      const verified = await clerkClient.verifyToken(token);
      clerkUserId = verified.sub;
      // Clerk JWTs include email in the payload
      clerkEmail = verified.email;
    } catch {
      throw new ApiError(401, 'Session invalid or expired — please sign in again');
    }

    // Try to load user by Clerk ID first, then by email as fallback
    let user = await loadUserByClerkId(clerkUserId);
    if (!user && clerkEmail) {
      user = await loadUserByEmail(clerkEmail);
      if (user) {
        // Link the Clerk ID to the existing user for future lookups
        await query('UPDATE users SET clerk_id = $1 WHERE id = $2', [clerkUserId, user.id]);
      }
    }

    // Auto-provision: self-signed-up Clerk users with no DB row get a minimal active account
    if (!user) {
      const username = clerkEmail ? clerkEmail.split('@')[0] : clerkUserId;
      const { rows } = await query(
        `INSERT INTO users (email, username, full_name, status, clerk_id, password_hash, profile_updated_at)
         VALUES ($1, $2, $3, 'active', $4, $5, now())
         ON CONFLICT (email) DO UPDATE SET clerk_id = $4
         RETURNING id, email, username, full_name, status, force_password_reset,
                   profile_photo_url, designation, profile_updated_at,
                   password_changed_at, failed_attempts, locked_until`,
        [clerkEmail || `${clerkUserId}@clerk.local`, username, username, clerkUserId, CLERK_SSO_HASH]
      );
      if (rows[0]) {
        user = {
          ...rows[0],
          roles: [], divisionIds: [], sectionIds: [], permissions: [],
          isSuperAdmin: false,
        };
      }
    }

    if (!user || user.status !== 'active') throw new ApiError(401, 'Account inactive or missing');

    req.user = user;
    req.clerkUserId = clerkUserId;
    req.requestId = req.headers['x-request-id'] || null;
    next();
  } catch (e) {
    next(e);
  }
}

const USER_SELECT_BY_CLERK_ID = `
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
   WHERE u.clerk_id = $1
   GROUP BY u.id`;

async function loadUserByClerkId(clerkId) {
  const { rows } = await query(USER_SELECT_BY_CLERK_ID, [clerkId]);
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
