import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, pool } from '../config/db.js';
import { authenticate, loadUser, signAccessToken, signRefreshToken } from '../middleware/auth.js';
import { badRequest, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { generateCaptcha, verifyCaptcha, CAPTCHA_TTL_MS } from '../utils/captcha.js';
import { rateLimit } from '../middleware/security.js';
import { validate, loginSchema, changePasswordSchema, refreshTokenSchema } from '../middleware/validate.js';
import { sanitizeInput } from '../middleware/sanitize.js';
import { securityLogger, SECURITY_EVENTS } from '../middleware/securityLogger.js';

const r = Router();

// Apply sanitization to all auth routes
r.use(sanitizeInput());

// Password complexity validation helper
function validatePasswordComplexity(password) {
  const errors = [];
  if (password.length < 8) errors.push('at least 8 characters');
  if (password.length > 128) errors.push('no more than 128 characters');
  if (!/[A-Z]/.test(password)) errors.push('at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('at least one number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('at least one special character');
  return errors;
}

// GET /api/auth/captcha — a fresh 30-second, single-use login challenge.
r.get('/captcha', rateLimit(60, 60 * 1000), ah(async (req, res) => {
  const { id, answer, svg } = generateCaptcha();
  const { isDemoMode } = await import('../utils/demoMode.js');
  const reveal = req.query.reveal === '1' && isDemoMode();
  res.json({ id, svg, ttlSeconds: CAPTCHA_TTL_MS / 1000, ...(reveal ? { answer } : {}) });
}));

// POST /api/auth/login — credential validation with CAPTCHA, rate limiting, account lockout
r.post('/login',
  rateLimit(10, 5 * 60 * 1000, (req) => String(req.body?.identifier || '').slice(0, 64)),
  validate({ body: loginSchema }),
  ah(async (req, res) => {
    const { identifier, password, captchaId, captchaText } = req.body;

    // CAPTCHA verification
    const { isDemoMode } = await import('../utils/demoMode.js');
    if (!isDemoMode()) {
      if (!captchaId || !captchaText || captchaId.trim() === '' || captchaText.trim() === '') {
        throw badRequest('CAPTCHA is required — please solve the CAPTCHA challenge');
      }
      const check = verifyCaptcha(captchaId, captchaText);
      if (!check.ok) {
        securityLogger.log(SECURITY_EVENTS.CAPTCHA_FAILURE, {
          ...req.securityContext,
          message: check.reason,
        });
        throw badRequest(check.reason === 'expired'
          ? 'CAPTCHA expired or already used — enter the new code shown'
          : 'Incorrect CAPTCHA — enter the code shown exactly');
      }
    } else {
      if (captchaId && captchaId.trim() !== '' && captchaText && captchaText.trim() !== '') {
        const check = verifyCaptcha(captchaId, captchaText);
        if (!check.ok) {
          throw badRequest(check.reason === 'expired'
            ? 'CAPTCHA expired or already used — enter the new code shown'
            : 'Incorrect CAPTCHA — enter the code shown exactly');
        }
      }
    }

    // User lookup
    const { rows } = await query(
      `SELECT * FROM users WHERE (lower(email) = lower($1) OR username = $2) LIMIT 1`,
      [identifier, identifier]
    );
    const user = rows[0];

    // Verify password
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      if (user) {
        // Increment failed attempts and lock after 5 failures in 15 minutes
        await query(`UPDATE users SET failed_attempts = failed_attempts + 1,
                       locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
                     WHERE id = $1`, [user.id]);

        // Log if account gets locked
        if (user.failed_attempts + 1 >= 5) {
          securityLogger.log(SECURITY_EVENTS.ACCOUNT_LOCKED, {
            ...req.securityContext,
            userId: user.id,
            message: 'Account locked after 5 failed attempts',
          });
        }
      }

      securityLogger.log(SECURITY_EVENTS.LOGIN_FAILURE, {
        ...req.securityContext,
        userId: user?.id,
        message: `Failed login for: ${identifier}`,
      });

      // Use generic message to prevent user enumeration
      throw badRequest('Invalid credentials');
    }

    // Check account status
    if (user.status !== 'active') {
      throw badRequest('Account is inactive — contact an administrator');
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      securityLogger.log(SECURITY_EVENTS.LOGIN_FAILURE, {
        ...req.securityContext,
        userId: user.id,
        message: 'Login attempt on locked account',
      });
      throw badRequest('Account temporarily locked after failed attempts — try again later');
    }

    // Successful login: reset failed attempts, update last login
    await query(`UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`, [user.id]);

    const full = await loadUser(user.id);
    const accessToken = signAccessToken(full);
    const refreshToken = signRefreshToken(full);

    await logAudit(pool, {
      userId: full.id, role: full.roles.join(','), actionType: 'login', entityType: 'user', entityId: full.id,
    });

    securityLogger.log(SECURITY_EVENTS.LOGIN_SUCCESS, {
      ...req.securityContext,
      userId: full.id,
      message: `Login successful for: ${full.email}`,
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: full.id, email: full.email, username: full.username, fullName: full.fullName,
        roles: full.roles, divisionIds: full.divisionIds, sectionIds: full.sectionIds,
        permissions: full.permissions, profileUpdatedAt: full.profileUpdatedAt,
        isSuperAdmin: full.isSuperAdmin, forcePasswordReset: full.forcePasswordReset,
      },
    });
  })
);

// POST /api/auth/refresh — rotate access token and refresh token
r.post('/refresh',
  validate({ body: refreshTokenSchema }),
  ah(async (req, res) => {
    const { refreshToken } = req.body;
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      securityLogger.log(SECURITY_EVENTS.TOKEN_REFRESH_FAILURE, {
        ...req.securityContext,
        message: 'Invalid or expired refresh token',
      });
      throw badRequest('Refresh token invalid or expired');
    }
    if (payload.type !== 'refresh') {
      throw badRequest('Refresh token invalid or expired');
    }

    const full = await loadUser(payload.sub);
    if (!full || full.status !== 'active') {
      throw badRequest('Account inactive or missing');
    }

    // Token invalidation check: reject tokens issued before password change
    if (payload.pwChanged && full.passwordChangedAt) {
      const tokenIssuedAt = payload.iat * 1000;
      const passwordChangedAt = new Date(full.passwordChangedAt).getTime();
      if (tokenIssuedAt < passwordChangedAt) {
        throw badRequest('Session invalidated — password was changed. Please sign in again');
      }
    }

    // Issue new access token
    const newAccessToken = signAccessToken(full);

    securityLogger.log(SECURITY_EVENTS.TOKEN_REFRESH, {
      ...req.securityContext,
      userId: full.id,
    });

    res.json({
      accessToken: newAccessToken,
      user: {
        id: full.id, email: full.email, fullName: full.fullName, roles: full.roles,
        divisionIds: full.divisionIds, sectionIds: full.sectionIds, permissions: full.permissions,
        profileUpdatedAt: full.profileUpdatedAt, isSuperAdmin: full.isSuperAdmin,
      },
    });
  })
);

// POST /api/auth/logout — audit trail
r.post('/logout', authenticate, ah(async (req, res) => {
  await logAudit(pool, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'logout',
    entityType: 'user', entityId: req.user.id,
  });

  securityLogger.log(SECURITY_EVENTS.LOGOUT, {
    ...req.securityContext,
    userId: req.user.id,
  });

  res.status(204).end();
}));

// GET /api/auth/me — role + division scope resolution for the client
r.get('/me', authenticate, ah(async (req, res) => {
  res.json({ user: req.user });
}));

// POST /api/auth/change-password — self-service change with complexity requirements
r.post('/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  ah(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Additional server-side password complexity check
    const complexityErrors = validatePasswordComplexity(newPassword);
    if (complexityErrors.length) {
      throw badRequest(`Password does not meet complexity requirements: ${complexityErrors.join(', ')}`);
    }

    // Prevent password reuse
    const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    if (await bcrypt.compare(newPassword, rows[0].password_hash)) {
      throw badRequest('New password must be different from your current password');
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query(
      `UPDATE users SET password_hash = $1, force_password_reset = false, password_changed_at = now() WHERE id = $2`,
      [hash, req.user.id]
    );

    await logAudit(pool, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'password_change',
      entityType: 'user', entityId: req.user.id,
    });

    securityLogger.log(SECURITY_EVENTS.PASSWORD_CHANGE, {
      ...req.securityContext,
      userId: req.user.id,
    });

    res.json({ ok: true, message: 'Password changed successfully. All other sessions have been invalidated.' });
  })
);

export default r;
