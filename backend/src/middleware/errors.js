import { ApiError } from '../utils/httpError.js';

export function notFound(req, res) {
  res.status(404).json({ error: { message: 'Resource not found' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Log the full error for debugging (server-side only)
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', err);
  } else {
    // In production, log structured error without sensitive data
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: err.message,
      code: err.code,
      status: err.status,
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      // Do NOT log stack traces, passwords, tokens, or secrets
    }));
  }

  // Postgres unique violation → duplicate master data (SC-3)
  if (err.code === '23505') {
    return res.status(409).json({
      error: {
        message: 'A record with this unique identifier already exists',
        code: 'DUPLICATE_VALUE',
      },
    });
  }

  // Postgres FK violation → referenced / in-use record
  if (err.code === '23503') {
    return res.status(409).json({
      error: {
        message: 'This record is referenced by other data and cannot be modified',
        code: 'REFERENCE_CONSTRAINT',
      },
    });
  }

  // Postgres check constraint violation
  if (err.code === '23514') {
    return res.status(400).json({
      error: {
        message: 'The provided value does not meet the required constraints',
        code: 'VALIDATION_ERROR',
      },
    });
  }

  // Postgres connection errors
  if (err.code === 'ECONNREFUSED' || err.code === '57P01' || err.code === '57P02' || err.code === '57P03') {
    return res.status(503).json({
      error: {
        message: 'Service temporarily unavailable — please try again later',
        code: 'SERVICE_UNAVAILABLE',
      },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        message: 'Session invalid or expired — please sign in again',
        code: 'INVALID_TOKEN',
      },
    });
  }

  // Application errors with status codes
  const status = err instanceof ApiError ? err.status : 500;

  // For 500 errors, return generic message (never expose internals)
  if (status >= 500) {
    return res.status(500).json({
      error: {
        message: 'An unexpected error occurred — please try again later',
        code: 'INTERNAL_ERROR',
      },
    });
  }

  // For client errors, return the message but not implementation details
  res.status(status).json({
    error: {
      message: err.message || 'An error occurred',
      code: err.code || 'CLIENT_ERROR',
      details: err.details || undefined,
    },
  });
}
