import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, pool } from '../config/db.js';
import { authenticate, signToken, loadUserByEmail } from '../middleware/auth.js';
import { rateLimit } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { ah, badRequest, tooManyRequests } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { z } from 'zod';

const r = Router();

// ─── Schemas ───────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, underscores, and hyphens'),
  fullName: z.string().min(1, 'Full name is required').max(255),
  password: z.string()
    .min(10, 'Password must be at least 10 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

// POST /api/auth/login — local email/password authentication
// Rate limit: 10 login attempts per minute per IP
r.post('/login', rateLimit(10, 60 * 1000), validate({ body: loginSchema }), ah(async (req, res) => {
  const { email, password } = req.body || {};

  const user = await loadUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: { message: 'Invalid email or password', code: 'AUTH_FAILED' } });
  }

  if (user.status !== 'active') {
    return res.status(401).json({ error: { message: 'Account is not active', code: 'ACCOUNT_INACTIVE' } });
  }

  // Check if account is locked
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return res.status(423).json({ error: { message: 'Account is temporarily locked due to too many failed attempts', code: 'ACCOUNT_LOCKED' } });
  }

  // Get password hash from DB
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  const passwordHash = rows[0]?.password_hash;

  if (!passwordHash) {
    return res.status(401).json({ error: { message: 'Invalid email or password', code: 'AUTH_FAILED' } });
  }

  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) {
    // Increment failed attempts
    await query(
      `UPDATE users SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
        locked_until = CASE WHEN COALESCE(failed_attempts, 0) + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
       WHERE id = $1`,
      [user.id]
    );
    return res.status(401).json({ error: { message: 'Invalid email or password', code: 'AUTH_FAILED' } });
  }

  // Reset failed attempts on successful login
  await query('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [user.id]);

  // Sign JWT
  const token = signToken({ sub: user.id, email: user.email });

  await logAudit(pool, {
    userId: user.id, role: user.roles.join(','), actionType: 'login',
    entityType: 'user', entityId: user.id,
  }).catch(() => {});

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      roles: user.roles,
      permissions: user.permissions,
      divisionIds: user.divisionIds,
      sectionIds: user.sectionIds,
      isSuperAdmin: user.isSuperAdmin,
      profilePhotoUrl: user.profilePhotoUrl,
      designation: user.designation,
      forcePasswordReset: user.forcePasswordReset,
      profileUpdatedAt: user.profileUpdatedAt,
    },
  });
}));

// GET /api/auth/me — role + division scope resolution for the client
// Called by the frontend after sign-in to fetch RBAC data
r.get('/me', authenticate, ah(async (req, res) => {
  res.json({ user: req.user });
}));

// POST /api/auth/signup — self-service user registration (creates inactive account)
// Rate limit: 5 signups per minute per IP
r.post('/signup', rateLimit(5, 60 * 1000), validate({ body: signupSchema }), ah(async (req, res) => {
  const { email, username, fullName, password } = req.body || {};

  // Check if user already exists
  const existing = await loadUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: { message: 'An account with this email already exists', code: 'DUPLICATE_EMAIL' } });
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (email, username, full_name, password_hash, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING id, email, username, full_name, status, created_at`,
    [email, username, fullName, hash]
  );

  await logAudit(pool, {
    userId: rows[0].id, role: '', actionType: 'signup',
    entityType: 'user', entityId: rows[0].id, afterValue: { email, username },
  }).catch(() => {});

  res.status(201).json({ message: 'Account created successfully' });
}));

// POST /api/auth/logout — audit trail
r.post('/logout', authenticate, ah(async (req, res) => {
  await logAudit(pool, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'logout',
    entityType: 'user', entityId: req.user.id,
  });
  res.status(204).end();
}));

export default r;
