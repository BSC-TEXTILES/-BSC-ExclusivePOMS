/**
 * Input sanitization middleware.
 * Strips dangerous characters and patterns from request data before
 * it reaches route handlers. This is defense-in-depth — every route
 * should also validate its own inputs.
 */

// Characters that could enable XSS or injection if stored and rendered
const DANGEROUS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,   // <script> tags
  /javascript:/gi,                           // javascript: URIs
  /on\w+\s*=/gi,                             // inline event handlers (onload=, onclick=)
  /data:text\/html/gi,                       // data: HTML URIs
  /vbscript:/gi,                             // vbscript URIs
];

// Strip null bytes (potential path traversal / C injection)
const NULL_BYTE = /\0/g;

/**
 * Sanitize a single string value: trim, remove null bytes,
 * optionally strip dangerous HTML patterns.
 */
function sanitizeString(str, opts = {}) {
  if (typeof str !== 'string') return str;
  let clean = str.trim().replace(NULL_BYTE, '');
  if (opts.stripHtml) {
    for (const pat of DANGEROUS_PATTERNS) {
      clean = clean.replace(pat, '');
    }
  }
  return clean;
}

/**
 * Recursively sanitize an object, array, or primitive.
 */
function sanitizeValue(val, opts) {
  if (typeof val === 'string') return sanitizeString(val, opts);
  if (Array.isArray(val)) return val.map((v) => sanitizeValue(v, opts));
  if (val && typeof val === 'object' && !(val instanceof Date) && !(val instanceof Buffer)) {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = sanitizeValue(v, opts);
    }
    return out;
  }
  return val;
}

/**
 * Middleware: sanitize req.body, req.query, req.params.
 * @param {object} opts
 * @param {boolean} opts.stripHtml - also strip HTML/script patterns (default true)
 */
export function sanitizeInput(opts = {}) {
  const options = { stripHtml: true, ...opts };
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body, options);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeValue(req.query, options);
    }
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeValue(req.params, options);
    }
    next();
  };
}

/**
 * Middleware: reject requests with suspicious payload patterns.
 * Catches common attack signatures in the raw body string.
 */
export function rejectSuspiciousPayload(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const str = JSON.stringify(req.body);
    // Block common SQL injection patterns in body
    if (/(\b(union|select|insert|update|delete|drop|exec|execute)\b.*\b(from|into|table|values)\b)/i.test(str)) {
      return res.status(400).json({ error: { message: 'Request contains suspicious content' } });
    }
    // Block common XSS patterns
    if (/<script/i.test(str) || /javascript:/i.test(str)) {
      return res.status(400).json({ error: { message: 'Request contains potentially harmful content' } });
    }
    // Block path traversal attempts
    if (/\.\.\//.test(str) || /\.\.\\/.test(str)) {
      return res.status(400).json({ error: { message: 'Request contains invalid path characters' } });
    }
  }
  next();
}
