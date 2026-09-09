// Security middleware: hardened response headers + dependency-free sliding
// window rate limiter. Render/Heroku sit behind a proxy, so the client IP is
// taken from X-Forwarded-For (first hop), falling back to socket address.
import { tooManyRequests } from '../utils/httpError.js';

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if ((req.headers['x-forwarded-proto'] || '') === 'https' || req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
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
