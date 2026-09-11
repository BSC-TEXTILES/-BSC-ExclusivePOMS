// Automatic one-step database initializer for POMS
// Safe, idempotent: checks DB existence, runs complete_schema.sql if needed, and seeds if empty.
import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/poms';

async function setup() {
  const parsed = new URL(url);
  const targetDb = parsed.pathname.replace(/^\//, '') || 'poms';
  
  // 1. Connect to default postgres DB first to ensure target DB exists
  const serverUrl = `${parsed.protocol}//${parsed.username}${parsed.password ? ':' + parsed.password : ''}@${parsed.host}/postgres`;
  const isSupabase = url.includes('supabase');
  
  if (!isSupabase) {
    const adminClient = new pg.Client({
      connectionString: serverUrl,
      ssl: false,
    });
    try {
      await adminClient.connect();
      const checkRes = await adminClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [targetDb]
      );
      if (checkRes.rowCount === 0) {
        console.log(`[....] Database "${targetDb}" does not exist. Creating it now...`);
        await adminClient.query(`CREATE DATABASE "${targetDb}"`);
        console.log(`[OK]   Database "${targetDb}" created.`);
      } else {
        console.log(`[OK]   Database "${targetDb}" exists.`);
      }
    } catch (e) {
      console.warn(`[WARN] Could not verify database creation via admin connection: ${e.message}`);
    } finally {
      await adminClient.end().catch(() => {});
    }
  }

  // 2. Connect to the target database
  const targetPool = new pg.Pool({
    connectionString: url,
    max: 2,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
  });

  try {
    const tableRes = await targetPool.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const tableCount = tableRes.rows[0].n;
    console.log(`[....] Found ${tableCount} tables in "${targetDb}".`);

    if (tableCount < 10) {
      console.log('[....] Applying complete_schema.sql (tables missing or fresh database)...');
      const schemaPath = path.resolve(__dirname, '../../database/complete_schema.sql');
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await targetPool.query(sql);
        console.log('[OK]   Schema applied successfully.');
      } else {
        throw new Error(`Schema file not found at ${schemaPath}`);
      }
    }

    // 3. Check if seeded with demo users
    const userRes = await targetPool.query(
      `SELECT count(*)::int AS n FROM users WHERE email = 'admin@bsc.local'`
    ).catch(() => ({ rows: [{ n: 0 }] }));

    if (userRes.rows[0].n === 0) {
      console.log('[....] Seeding initial data and admin user...');
      // Run the seed script
      const { spawnSync } = await import('node:child_process');
      const result = spawnSync(process.execPath, ['scripts/seed.js'], {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
      });
      if (result.status !== 0) {
        throw new Error('Seed process exited with error');
      }
      console.log('[OK]   Database seeded.');
    } else {
      console.log('[OK]   Database schema and seed users are already present.');
    }

    console.log('[OK]   Database is ready.');
    process.exit(0);
  } catch (err) {
    console.error(`[ERROR] Database setup failed: ${err.message}`);
    process.exit(1);
  } finally {
    await targetPool.end().catch(() => {});
  }
}

setup();
