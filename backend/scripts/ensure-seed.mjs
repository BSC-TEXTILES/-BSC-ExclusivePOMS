// Deployment entry point for seeding (aidmi.md runbook §4.2):
//   node scripts/run-all-migrations.mjs && node scripts/ensure-seed.mjs
// It verifies the schema is in place, then delegates to the full idempotent
// seed (roles, permissions, sections, sizes, colours, approval rules, settings,
// demo users, 1000+ product catalogue). Safe to run repeatedly.
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/poms';

const client = new pg.Client({ connectionString: url });
await client.connect();

async function tableExists(name) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [name]);
  return rows.length > 0;
}

const users = await tableExists('users');
const roles = await tableExists('roles');
const sections = await tableExists('sections');

if (!users || !roles || !sections) {
  console.error('✗ Core tables missing (users/roles/sections).');
  console.error('  Run the migrations first:  node scripts/run-all-migrations.mjs');
  await client.end();
  process.exit(1);
}

// Readiness marker: the seed creates the 21-section catalogue. Migrations alone
// never create sections — but migration 011 DOES create a user, so users are
// NOT a valid "already seeded" signal on a fresh deploy.
const { rows } = await client.query(`SELECT count(*)::int AS count FROM sections`);
const sectionCount = rows[0].count;
const { rows: userRows } = await client.query(`SELECT count(*)::int AS count FROM users`);
await client.end();

if (sectionCount > 0) {
  console.log(`✓ Database already seeded (${sectionCount} sections, ${userRows[0].count} users) — nothing to do.`);
  console.log('  Re-run scripts/seed.js explicitly to top up master data (idempotent).');
  process.exit(0);
}

console.log('Database empty — running the full seed (roles, sections, catalogue, demo users) …');
const BACKEND_ROOT = path.dirname(HERE); // HERE = backend/scripts
const result = spawnSync(process.execPath, ['scripts/seed.js'], { cwd: BACKEND_ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
