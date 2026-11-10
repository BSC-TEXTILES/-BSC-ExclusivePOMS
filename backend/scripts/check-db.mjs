// DB connectivity diagnostic — run:  node scripts/check-db.mjs
// Prints a precise reason when MySQL / PostgreSQL is unreachable so dev never guesses.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/poms';
const safeUrl = url.replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@');
const isMySQL = url.startsWith('mysql:') || url.startsWith('mysql2:');

async function checkPostgres() {
  const { default: pg } = await import('pg');
  const isSupabase = url.includes('supabase');
  const pool = new pg.Pool({ connectionString: url, max: 1, ssl: isSupabase ? { rejectUnauthorized: false } : false });
  const started = Date.now();
  try {
    const { rows } = await pool.query('SELECT version() AS v, current_database() AS db');
    console.log(`OK PostgreSQL reachable (${Date.now() - started} ms)`);
    console.log(`  database : ${rows[0].db}`);
    console.log(`  server   : ${String(rows[0].v).split(',')[0]}`);
    const tables = await pool.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log(`  tables   : ${tables.rows[0].n} in schema public`);
    if (tables.rows[0].n === 0) {
      console.log('WARN Schema is empty - run: node scripts/setup-db.mjs');
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

async function checkMySQL() {
  const { default: mysql } = await import('mysql2/promise');
  const started = Date.now();
  const pool = mysql.createPool({ uri: url, waitForConnections: true, connectionLimit: 2 });
  try {
    const [verRows] = await pool.query('SELECT VERSION() AS v, DATABASE() AS db');
    console.log(`OK MySQL reachable (${Date.now() - started} ms)`);
    console.log(`  database : ${verRows[0].db}`);
    console.log(`  server   : MySQL ${verRows[0].v}`);
    const [tblRows] = await pool.query(
      `SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = ?`,
      [verRows[0].db]
    );
    console.log(`  tables   : ${tblRows[0].n} in database ${verRows[0].db}`);
    if (tblRows[0].n === 0) {
      console.log('WARN Schema is empty - run: node scripts/setup-db.mjs');
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  try {
    if (isMySQL) {
      await checkMySQL();
    } else {
      await checkPostgres();
    }
    process.exitCode = 0;
  } catch (e) {
    const dbType = isMySQL ? 'MySQL' : 'PostgreSQL';
    console.error(`FAIL ${dbType} NOT reachable - ${safeUrl}`);
    console.error(`  reason: ${e.message || e.code || e}`);
    if (e.code === 'ECONNREFUSED' || e.code === 'EACCES') {
      console.error(`  hint  : ${dbType} service is not running or port is blocked.`);
    } else if (/access denied|password authentication/i.test(e.message)) {
      console.error(`  hint  : Check database credentials in backend/.env -> DATABASE_URL`);
    } else if (/unknown database|does not exist/i.test(e.message)) {
      console.error(`  hint  : Database "poms" does not exist - run: node scripts/setup-db.mjs`);
    }
    process.exitCode = 1;
  }
}
main();
