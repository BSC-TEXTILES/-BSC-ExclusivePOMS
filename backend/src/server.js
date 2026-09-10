import 'dotenv/config';
import app from './app.js';
import { pool } from './config/db.js';
import { attachChatWs } from './ws/chat.js';

const port = process.env.PORT || 4000;

// ── Boot diagnostics: verify PostgreSQL at startup with a precise message ──
async function probeDatabase() {
  const started = Date.now();
  try {
    await pool.query('SELECT 1');
    console.log(`✓ PostgreSQL connected in ${Date.now() - started} ms — database ready`);
  } catch (e) {
    const reason = e.code === 'ECONNREFUSED'
      ? 'connection refused — PostgreSQL service is not running'
      : e.message;
    console.error(`\n⚠ DATABASE WARNING: ${reason}`);
    console.error('  The API will still start, but every /api route will fail until the DB is reachable.');
    console.error('  Diagnose with:  cd backend && node scripts/check-db.mjs');
  }
}
probeDatabase();

const server = app.listen(port, () => {
  console.log(`POMS API listening on http://localhost:${port}`);
  console.log(`  frontend dev proxy target: http://localhost:${port} (must match frontend/vite.config.js)`);
});

// Keep chat/notify WebSockets alive; log upstream socket errors instead of crashing
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n✗ Port ${port} is already in use — another POMS API instance is probably running.`);
    console.error(`  Stop it or change PORT in backend/.env. (Frontend proxy expects port 4040.)`);
    process.exit(1);
  }
  console.error('Server error:', e.message);
});

// Global safety nets — log loudly in dev instead of dying silently
process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e?.message || e));
process.on('uncaughtException', (e) => console.error('Uncaught exception:', e?.message || e));

attachChatWs(server); // live team chat on ws://localhost:<port>/ws/chat

async function shutdown(signal) {
  console.log(`\n${signal} received — closing server and DB pool`);
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
