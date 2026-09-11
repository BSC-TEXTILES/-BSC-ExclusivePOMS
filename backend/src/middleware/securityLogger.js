/**
 * Security event logging middleware.
 * Records authentication events, authorization failures, suspicious
 * activity, and other security-relevant events to a structured log.
 */

const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
  LOGOUT: 'auth.logout',
  TOKEN_REFRESH: 'auth.token.refresh',
  TOKEN_REFRESH_FAILURE: 'auth.token.refresh.failure',
  PASSWORD_CHANGE: 'auth.password.change',
  PASSWORD_RESET_REQUEST: 'auth.password.reset.request',
  PASSWORD_RESET_COMPLETE: 'auth.password.reset.complete',
  ACCOUNT_LOCKED: 'auth.account.locked',
  CAPTCHA_FAILURE: 'auth.captcha.failure',
  AUTH_REQUIRED: 'auth.unauthorized',
  PERMISSION_DENIED: 'auth.forbidden',
  RATE_LIMITED: 'security.rate_limited',
  SUSPICIOUS_PAYLOAD: 'security.suspicious_payload',
  FILE_UPLOAD_BLOCKED: 'security.file_upload.blocked',
  SQL_INJECTION_ATTEMPT: 'security.sql_injection',
  XSS_ATTEMPT: 'security.xss_attempt',
  PATH_TRAVERSAL: 'security.path_traversal',
  ROLE_ESCALATION: 'security.role_escalation',
  ADMIN_ACTION: 'admin.action',
  DATA_EXPORT: 'data.export',
};

class SecurityLogger {
  constructor() {
    this.events = [];
    this.maxEvents = 10000;
  }

  log(event, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      ip: details.ip || 'unknown',
      userId: details.userId || null,
      userAgent: details.userAgent || null,
      path: details.path || null,
      method: details.method || null,
      message: details.message || null,
      metadata: details.metadata || null,
    };

    this.events.push(entry);

    // Trim old events if we exceed the limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // In production, these would go to a log aggregator
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(entry));
    } else {
      console.log(`[SECURITY] ${event}: ${details.message || ''} (IP: ${entry.ip})`);
    }

    return entry;
  }

  getRecentEvents(count = 100) {
    return this.events.slice(-count);
  }

  getEventsByUser(userId, count = 50) {
    return this.events
      .filter((e) => e.userId === userId)
      .slice(-count);
  }

  getFailedLogins(windowMs = 15 * 60 * 1000) {
    const cutoff = Date.now() - windowMs;
    return this.events.filter(
      (e) => e.event === SECURITY_EVENTS.LOGIN_FAILURE &&
        new Date(e.timestamp).getTime() > cutoff
    );
  }
}

export const securityLogger = new SecurityLogger();

/**
 * Middleware: attach security context to request for downstream logging.
 */
export function securityContext(req, res, next) {
  req.securityContext = {
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || null,
    path: req.originalUrl,
    method: req.method,
  };
  next();
}

/**
 * Middleware: log authorization failures.
 */
export function logAuthFailure(reason) {
  return (req, res, next) => {
    const originalEnd = res.end;
    res.end = function (...args) {
      if (res.statusCode === 401 || res.statusCode === 403) {
        securityLogger.log(
          res.statusCode === 403 ? SECURITY_EVENTS.PERMISSION_DENIED : SECURITY_EVENTS.AUTH_REQUIRED,
          {
            ...req.securityContext,
            userId: req.user?.id,
            message: reason || `HTTP ${res.statusCode}`,
          }
        );
      }
      originalEnd.apply(this, args);
    };
    next();
  };
}

/**
 * Middleware: log rate limit events.
 */
export function logRateLimit(req, res, next) {
  const originalEnd = res.end;
  res.end = function (...args) {
    if (res.statusCode === 429) {
      securityLogger.log(SECURITY_EVENTS.RATE_LIMITED, {
        ...req.securityContext,
        userId: req.user?.id,
        message: 'Rate limit exceeded',
      });
    }
    originalEnd.apply(this, args);
  };
  next();
}

/**
 * Middleware: log all state-changing operations for audit.
 */
export function logStateChange(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const originalEnd = res.end;
    res.end = function (...args) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        securityLogger.log(SECURITY_EVENTS.ADMIN_ACTION, {
          ...req.securityContext,
          userId: req.user?.id,
          message: `${req.method} ${req.originalUrl} -> ${res.statusCode}`,
          metadata: { statusCode: res.statusCode },
        });
      }
      originalEnd.apply(this, args);
    };
  }
  next();
}

export { SECURITY_EVENTS };
