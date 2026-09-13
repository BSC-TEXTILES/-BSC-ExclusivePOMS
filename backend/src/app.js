import express from 'express';
import cors from 'cors';
import { selfTest } from './utils/pricing.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { helmetMiddleware, additionalSecurityHeaders, rateLimit } from './middleware/security.js';
import { securityContext, logRateLimit } from './middleware/securityLogger.js';
import { sanitizeInput, rejectSuspiciousPayload } from './middleware/sanitize.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import mastersRoutes from './routes/masters.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import approvalRoutes from './routes/approvals.js';
import receiptRoutes from './routes/receipts.js';
import inventoryRoutes from './routes/inventory.js';
import reportRoutes from './routes/reports.js';
import miscRoutes from './routes/misc.js';
import chatRoutes from './routes/chat.js';
import uploadRoutes from './routes/uploads.js';
import searchRoutes from './routes/search.js';
import manufacturerRoutes from './routes/manufacturers.js';
import roleRoutes from './routes/roles.js';
import pricingRoutes from './routes/pricing.js';
import videoRoutes from './routes/videos.js';
import locationRoutes from './routes/locations.js';
import productTypeRoutes from './routes/productTypes.js';
import collectionRoutes from './routes/collections.js';
import fileRoutes from './routes/files.js';
import importRoutes from './routes/import.js';
import trackingRoutes from './routes/tracking.js';

selfTest(); // RB-017 guard: engine must reproduce FRS §13.3 exactly at boot

const app = express();
// Render / Vercel sit behind a reverse proxy — required for correct client IPs.
app.set('trust proxy', 1);

// ─── SECURITY LAYER 1: Helmet (HTTP security headers) ─────────────────────
app.use(helmetMiddleware);
app.use(additionalSecurityHeaders);

// ─── SECURITY LAYER 2: CORS ───────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
  maxAge: 86400, // preflight cache 24h
}));

// ─── SECURITY LAYER 3: Global rate limiting ───────────────────────────────
const apiLimiter = rateLimit(600, 60 * 1000);

// ─── SECURITY LAYER 4: Body parsing with size limits ──────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));

// ─── SECURITY LAYER 5: Security context for logging ──────────────────────
app.use(securityContext);

// ─── SECURITY LAYER 6: Suspicious payload detection ──────────────────────
app.use(rejectSuspiciousPayload);

// ─── SECURITY LAYER 7: Rate limit event logging ──────────────────────────
app.use(logRateLimit);

// ─── Request timing logger ─────────────────────────────────────────────────
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (req.originalUrl !== '/api/health') {
      console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`);
    }
  });
  next();
});

// ─── Public endpoints (no auth required) ───────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  service: 'poms-api',
  time: new Date().toISOString(),
  version: '1.0.0',
}));

// General per-IP budget for the whole API surface.
app.use('/api', apiLimiter);

// Public (pre-auth) flags the login page needs — DevTools blocking state only.
app.get('/api/settings/public', async (req, res, next) => {
  try {
    const { query } = await import('./config/db.js');
    const { rows } = await query(`SELECT value FROM settings WHERE key='security'`);
    res.json({ devtoolsBlock: rows[0]?.value?.devtoolsBlock !== false });
  } catch (e) { next(e); }
});

// Uploaded files (product images, PO attachments, avatars — every file type) as
// read-only static assets so <img>/<video>/PDF previews work with plain URLs.
import { uploadsDir } from './utils/storage.js';
app.use('/uploads', express.static(uploadsDir, { maxAge: '1d', index: false }));

// ─── Protected API routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes); // /api/uploads, avatars — MUST precede /api/users
app.use('/api/users', usersRoutes);
app.use('/api', mastersRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', miscRoutes); // /api/audit-logs, /api/notifications, /api/settings
app.use('/api/chat', chatRoutes);
app.use('/api', searchRoutes);
app.use('/api/manufacturers', manufacturerRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/product-types', productTypeRoutes);
app.use('/api', collectionRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/import', importRoutes);

// ─── Serve the built React client (single-origin full-stack site) ──────────
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

// ─── Error handling (must be last) ────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
