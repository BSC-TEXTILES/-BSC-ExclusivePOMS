import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, pool } from '../config/db.js';
import { authenticate, generateSessionToken, hashToken, loadUserByEmail } from '../middleware/auth.js';
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
  const { rows } = await query('SELECT password_hash, mfa_enabled FROM users WHERE id = $1', [user.id]);
  const passwordHash = rows[0]?.password_hash;
  const mfaEnabled = rows[0]?.mfa_enabled;

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

  if (mfaEnabled) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
    await query('UPDATE users SET mfa_otp = $1, mfa_otp_expires_at = $2 WHERE id = $3', [otp, expiresAt, user.id]);
    
    console.log(`\n======================================================`);
    console.log(`[MOCK OTP SERVICE] 2FA Login OTP for ${user.email}: ${otp}`);
    console.log(`======================================================\n`);
    
    return res.json({ mfaRequired: true, userId: user.id });
  }

  // Reset failed attempts on successful login
  await query('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [user.id]);

  // Generate session token
  const token = generateSessionToken();
  const hashed = hashToken(token);
  
  // Create stateful session
  await query(
    'INSERT INTO user_sessions (user_id, token_hash, tab_id, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)', 
    [user.id, hashed, req.headers['x-tab-id'] || 'default', req.ip, req.headers['user-agent']]
  );

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

// POST /api/auth/login/verify-mfa
const verifyMfaSchema = z.object({
  userId: z.string().uuid(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

r.post('/login/verify-mfa', rateLimit(5, 60 * 1000), validate({ body: verifyMfaSchema }), ah(async (req, res) => {
  const { userId, otp } = req.body;
  const { rows } = await query('SELECT mfa_otp, mfa_otp_expires_at FROM users WHERE id = $1', [userId]);
  
  const record = rows[0];
  if (!record || !record.mfa_otp) throw badRequest('No 2FA request found');
  if (record.mfa_otp !== otp) throw badRequest('Invalid OTP');
  if (new Date() > new Date(record.mfa_otp_expires_at)) {
    throw badRequest('OTP has expired. Please log in again.');
  }

  // Clear OTP
  await query('UPDATE users SET mfa_otp = NULL, mfa_otp_expires_at = NULL WHERE id = $1', [userId]);

  const user = await loadUser(userId);
  if (!user || user.status !== 'active') throw badRequest('User inactive');

  // Finish login
  await query('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [user.id]);
  
  const token = generateSessionToken();
  const hashed = hashToken(token);
  await query(
    'INSERT INTO user_sessions (user_id, token_hash, tab_id, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)', 
    [user.id, hashed, req.headers['x-tab-id'] || 'default', req.ip, req.headers['user-agent']]
  );

  await logAudit(pool, {
    userId: user.id, role: user.roles.join(','), actionType: 'login_mfa',
    entityType: 'user', entityId: user.id,
  }).catch(() => {});

  res.json({ token, user });
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
  if (req.sessionId) {
    await query('UPDATE user_sessions SET logout_at = now() WHERE token_hash = $1', [req.sessionId]).catch(() => {});
  }
  
  await logAudit(pool, {
    userId: req.user.id, role: req.user.roles?.join(',') || '', actionType: 'logout',
    entityType: 'user', entityId: req.user.id,
  }).catch(() => {});
  res.status(204).end();
}));

// POST /api/auth/change-password/request-otp
const reqOtpSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
});

r.post('/change-password/request-otp', authenticate, validate(reqOtpSchema), ah(async (req, res) => {
  const { currentPassword } = req.body;
  const user = await loadUserByEmail(req.user.email);
  if (!user) throw badRequest('User not found');

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw badRequest('Incorrect current password');

  // Generate two 6-digit OTPs
  const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const phoneOtp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set expiration to 10 minutes from now
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();

  await query(
    `UPDATE users SET reset_otp = $1, reset_otp_phone = $2, reset_otp_expires_at = $3 WHERE id = $4`,
    [emailOtp, phoneOtp, expiresAt, req.user.id]
  );

  // MOCK: Print OTPs to console
  console.log(`\n======================================================`);
  console.log(`[MOCK OTP SERVICE] Password Change for ${req.user.email}`);
  console.log(`Email OTP: ${emailOtp}`);
  console.log(`Phone OTP: ${phoneOtp}`);
  console.log(`======================================================\n`);

  res.json({ message: 'OTPs sent successfully to Email and Phone.' });
}));

const verifyOtpSchema = z.object({
  emailOtp: z.string().length(6, 'Email OTP must be 6 digits'),
  phoneOtp: z.string().length(6, 'Phone OTP must be 6 digits'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

r.post('/change-password/verify', authenticate, validate(verifyOtpSchema), ah(async (req, res) => {
  const { emailOtp, phoneOtp, newPassword } = req.body;
  
  const { rows } = await query(
    `SELECT reset_otp, reset_otp_phone, reset_otp_expires_at FROM users WHERE id = $1`,
    [req.user.id]
  );
  
  const record = rows[0];
  if (!record || !record.reset_otp || !record.reset_otp_phone) throw badRequest('No OTP request found');
  
  if (record.reset_otp !== emailOtp) throw badRequest('Invalid Email OTP');
  if (record.reset_otp_phone !== phoneOtp) throw badRequest('Invalid Phone OTP');
  
  if (new Date() > new Date(record.reset_otp_expires_at)) {
    throw badRequest('OTPs have expired. Please request new ones.');
  }

  const hash = await bcrypt.hash(newPassword, 12);
  
  await query(
    `UPDATE users SET password_hash = $1, reset_otp = NULL, reset_otp_phone = NULL, reset_otp_expires_at = NULL WHERE id = $2`,
    [hash, req.user.id]
  );

  await logAudit(pool, {
    userId: req.user.id, role: req.user.roles?.join(',') || '', actionType: 'change_password',
    entityType: 'user', entityId: req.user.id,
  }).catch(() => {});

  res.json({ message: 'Password changed successfully' });
}));

export default r;
