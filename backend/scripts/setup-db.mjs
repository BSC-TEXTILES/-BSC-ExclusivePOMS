// Automatic one-step database initializer for POMS
// Supports both MySQL and PostgreSQL!
// Safe, idempotent: checks DB existence, runs complete schema if needed, and seeds if empty.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/poms';
const isMySQL = url.startsWith('mysql:') || url.startsWith('mysql://');

function formatError(err) {
  if (!err) return 'Unknown error';
  if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
    return err.errors.map(e => e.message || e.code || String(e)).join('; ');
  }
  return err.message || err.code || String(err);
}

async function setup() {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    console.error(`[ERROR] Invalid DATABASE_URL in backend/.env: ${formatError(err)}`);
    process.exit(1);
  }

  const targetDb = parsed.pathname.replace(/^\//, '') || 'poms';

  if (isMySQL) {
    const mysql = await import('mysql2/promise');
    const host = parsed.hostname || 'localhost';
    const port = parseInt(parsed.port || '3306', 10);
    const user = parsed.username || 'root';
    const password = decodeURIComponent(parsed.password || '');

    // 1. Ensure target MySQL database exists
    let adminConn;
    try {
      adminConn = await mysql.default.createConnection({ host, port, user, password });
      await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`[OK]   MySQL database "${targetDb}" exists/verified.`);
    } catch (e) {
      console.warn(`[WARN] Could not verify MySQL database creation: ${formatError(e)}`);
    } finally {
      if (adminConn) await adminConn.end().catch(() => {});
    }

    // 2. Connect to the target database
    let targetConn;
    try {
      targetConn = await mysql.default.createConnection({
        host, port, user, password, database: targetDb, multipleStatements: true
      });

      const [tables] = await targetConn.query('SHOW TABLES');
      const tableCount = tables.length;
      console.log(`[....] Found ${tableCount} tables in MySQL "${targetDb}".`);

      if (tableCount < 10) {
        console.log('[....] Applying complete_schema_mysql.sql (fresh database)...');
        const schemaPath = path.resolve(__dirname, '../../database/complete_schema_mysql.sql');
        if (fs.existsSync(schemaPath)) {
          const sql = fs.readFileSync(schemaPath, 'utf8');
          const rawStatements = sql.split(/;\s*[\r\n]+/);
          await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
          for (const s of rawStatements) {
            const clean = s.replace(/^--[^\r\n]*[\r\n]*/gm, '').trim();
            if (!clean) continue;
            try {
              await targetConn.query(clean);
            } catch (err) {
              if (err.code !== 'ER_DUP_KEYNAME' && err.code !== 'ER_DUP_FIELDNAME') {
                // Ignore harmless duplicate key errors
              }
            }
          }
          // Create next_number function
          await targetConn.query('DROP FUNCTION IF EXISTS next_number').catch(() => {});
          await targetConn.query(`
            CREATE FUNCTION next_number(p_entity VARCHAR(64), p_div VARCHAR(36), p_year INT)
            RETURNS VARCHAR(64)
            DETERMINISTIC
            MODIFIES SQL DATA
            BEGIN
              DECLARE v_val INT DEFAULT 1;
              DECLARE v_prefix VARCHAR(64);
              SET v_prefix = CONCAT(p_entity, '-', p_year, '-');
              INSERT INTO number_sequences (id, entity_type, division_id, seq_year, prefix, current_value)
              VALUES (UUID(), p_entity, p_div, p_year, v_prefix, 1)
              ON DUPLICATE KEY UPDATE current_value = current_value + 1;
              SELECT current_value INTO v_val FROM number_sequences 
              WHERE entity_type = p_entity AND ((division_id = p_div) OR (division_id IS NULL AND p_div IS NULL)) AND seq_year = p_year LIMIT 1;
              RETURN CONCAT(v_prefix, LPAD(COALESCE(v_val, 1), 5, '0'));
            END
          `).catch(() => {});
          await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
          console.log('[OK]   MySQL schema applied successfully.');
        } else {
          throw new Error(`Schema file not found at ${schemaPath}`);
        }
      }

      // 3. Check if seeded with demo users
      const [userRows] = await targetConn.query(
        `SELECT count(*) AS n FROM users WHERE email = 'admin@bsc.local'`
      ).catch(() => [[{ n: 0 }]]);

      const userCount = userRows[0]?.n || 0;
      if (userCount === 0) {
        console.log('[....] Seeding initial data and admin user...');
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
      console.error(`[ERROR] MySQL setup failed: ${formatError(err)}`);
      process.exit(1);
    } finally {
      if (targetConn) await targetConn.end().catch(() => {});
    }

  } else {
    // PostgreSQL branch
    const pg = await import('pg');
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
    const needsSsl = !isLocal || url.includes('sslmode=require') || url.includes('supabase') || url.includes('neon.tech');

    if (isLocal) {
      const serverUrl = `${parsed.protocol}//${parsed.username}${parsed.password ? ':' + parsed.password : ''}@${parsed.host}/postgres`;
      const adminClient = new pg.default.Client({ connectionString: serverUrl, ssl: false });
      try {
        await adminClient.connect();
        const checkRes = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);
        if (checkRes.rowCount === 0) {
          console.log(`[....] Database "${targetDb}" does not exist. Creating it now...`);
          await adminClient.query(`CREATE DATABASE "${targetDb}"`);
          console.log(`[OK]   Database "${targetDb}" created.`);
        } else {
          console.log(`[OK]   Database "${targetDb}" exists.`);
        }
      } catch (e) {
        console.warn(`[WARN] Could not verify database creation via admin connection: ${formatError(e)}`);
      } finally {
        await adminClient.end().catch(() => {});
      }
    }

    const targetPool = new pg.default.Pool({
      connectionString: url,
      max: 2,
      ssl: needsSsl ? { rejectUnauthorized: false } : false,
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

      const userRes = await targetPool.query(
        `SELECT count(*)::int AS n FROM users WHERE email = 'admin@bsc.local'`
      ).catch(() => ({ rows: [{ n: 0 }] }));

      if (userRes.rows[0].n === 0) {
        console.log('[....] Seeding initial data and admin user...');
        const { spawnSync } = await import('node:child_process');
        const result = spawnSync(process.execPath, ['scripts/seed.js'], {
          cwd: path.resolve(__dirname, '..'),
          stdio: 'inherit',
        });
        if (result.status !== 0) throw new Error('Seed process exited with error');
        console.log('[OK]   Database seeded.');
      } else {
        console.log('[OK]   Database schema and seed users are already present.');
      }

      console.log('[OK]   Database is ready.');
      process.exit(0);
    } catch (err) {
      console.error(`[ERROR] Database setup failed: ${formatError(err)}`);
      process.exit(1);
    } finally {
      await targetPool.end().catch(() => {});
    }
  }
}

setup();
