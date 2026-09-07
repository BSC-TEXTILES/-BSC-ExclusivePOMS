import { ApiError } from '../utils/httpError.js';

export function notFound(req, res) {
  res.status(404).json({ error: { message: `No route: ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Postgres unique violation → duplicate master data (SC-3)
  if (err.code === '23505') {
    return res.status(409).json({ error: { message: 'Duplicate value — a record with this unique identifier already exists (SC-3)', detail: err.detail } });
  }
  // Postgres FK violation → referenced / in-use record: suggest archive instead of delete (RB-014)
  if (err.code === '23503') {
    return res.status(409).json({ error: { message: 'Record is referenced by other data — archive or deactivate instead of deleting (RB-014)', detail: err.detail } });
  }
  if (err.code === '23514') {
    return res.status(400).json({ error: { message: 'Value violates a database validation constraint', detail: err.detail } });
  }
  const status = err instanceof ApiError ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: { message: err.message || 'Internal server error', details: err.details } });
}
