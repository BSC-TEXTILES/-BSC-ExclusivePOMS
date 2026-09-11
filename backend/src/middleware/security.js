// Security middleware: hardened response headers, helmet integration, and
// dependency-free sliding window rate limiter. Render/Heroku sit behind a
// proxy, so the client IP is taken from X-Forwarded-For (first hop).
import helmet from 'helmet';
import { tooManyRequests } from '../utils/httpError.js';

/**
 * Helmet-based security headers. Applies industry-standard protections:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Strict-Transport-Security (HSTS)
 * - Content-Security-Policy
 * - X-DNS-Prefetch-Control
 * - X-XSS-Protection (legacy browsers)
 * - X-Download-Options
 * - Referrer-Policy
 * - Permissions-Policy
 * - Cross-Origin-Opener-Policy
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      mediaSrc: ["'self'", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:", "http:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,   // needed for external images
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
  frameguard: { action: 'sameorigin' },
  dnsPrefetchControl: { allow: false },
  ieNoOpen: true,
});

/**
 * Additional security headers beyond what helmet provides.
 * These supplement helmet for project-specific needs.
 */
export function additionalSecurityHeaders(req, res, next) {
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=(), usb=(), battery=(), midi=(), accelerometer=(), gyroscope=(), magnetometer=(), fullscreen=(self), autoplay=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  // Prevent MIME type sniffing beyond what helmet covers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}

/**
 * HSTS enforcement for HTTPS connections.
 */
export function hstsEnforcement(req, res, next) {
  if ((req.headers['x-forwarded-proto'] || '') === 'https' || req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
}

export function clientIpOf(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket?.remoteAddress ? String(req.socket.remoteAddress).replace('::ffff:', '') : 'unknown';
}

const buckets = new Map(); // key -> { count, windowStart }
setInterval(() => {
  // periodic sweep so idle buckets don't grow unbounded
  const now = Date.now();
  for (const [k, b] of buckets) if (now - b.windowStart > 10 * 60 * 1000) buckets.delete(k);
}, 60 * 1000).unref();

let limiterSeq = 0;

/**
 * Fixed-window rate limiter. Each limiter instance has its own bucket
 * namespace so a tight budget (e.g. login) never shares counters with the
 * general API budget.
 * @param {number} max allowed requests per window
 * @param {number} windowMs window length
 * @param {(req)=>string} [keyOf] extra keying (e.g. identifier) — combined with IP
 */
export function rateLimit(max, windowMs, keyOf) {
  const ns = ++limiterSeq;
  return (req, res, next) => {
    const key = `${ns}|${clientIpOf(req)}${keyOf ? '|' + keyOf(req) : ''}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now - b.windowStart > windowMs) {
      b = { count: 0, windowStart: now };
      buckets.set(key, b);
    }
    b.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - b.count)));
    if (b.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((b.windowStart + windowMs - now) / 1000)));
      return next(tooManyRequests('Too many requests — please slow down and try again shortly'));
    }
    next();
  };
}

/**
 * Stricter rate limiter for sensitive operations (password reset, etc.)
 */
export function strictRateLimit(max, windowMs) {
  return rateLimit(max, windowMs);
}
