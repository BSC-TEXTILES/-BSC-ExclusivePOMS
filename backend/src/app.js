import express from 'express';
import cors from 'cors';
import { selfTest } from './utils/pricing.js';
import { notFound, errorHandler } from './middleware/errors.js';

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

selfTest(); // RB-017 guard: engine must reproduce FRS §13.3 exactly at boot

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (req.originalUrl !== '/api/health') {
      console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`);
    }
  });
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'poms-api', time: new Date().toISOString() }));

// Uploaded files (product images, PO attachments, avatars — every file type) as
// read-only static assets so <img>/<video>/PDF previews work with plain URLs.
import { uploadsDir } from './utils/storage.js';
app.use('/uploads', express.static(uploadsDir, { maxAge: '1d', index: false }));

app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes); // /api/uploads, avatars (/users/me|:id/photo) — MUST precede /api/users so the self-service photo routes aren't caught by the users router's admin gate
app.use('/api/users', usersRoutes);
app.use('/api', mastersRoutes); // /api/divisions, /api/sections, /api/brands, ...
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', miscRoutes); // /api/audit-logs, /api/notifications, /api/settings
app.use('/api/chat', chatRoutes);
app.use('/api', searchRoutes); // /api/search
app.use('/api/manufacturers', manufacturerRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/product-types', productTypeRoutes);

// ---- Serve the built React client (single-origin full-stack site) ----
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

export default app;
