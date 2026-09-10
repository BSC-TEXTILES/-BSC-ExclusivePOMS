// DB connectivity diagnostic — run:  node scripts/check-db.mjs
// Prints a precise reason when PostgreSQL is unreachable so dev never guesses.
import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/poms';
// Never print credentials in the error output
const safeUrl = url.replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@');

async function main() {
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
      console.log('WARN Schema is empty - run:  psql -d poms -f database/complete_schema.sql  then seed:  npm run seed');
    }
    process.exitCode = 0;
  } catch (e) {
    console.error(`FAIL PostgreSQL NOT reachable - ${safeUrl}`);
    console.error(`  reason: ${e.message}`);
    if (e.code === 'ECONNREFUSED') {
      console.error('  hint  : PostgreSQL service is not running. Start it (services.msc -> postgresql-x64) or use a Supabase DATABASE_URL.');
    } else if (/password authentication/i.test(e.message)) {
      console.error('  hint  : Set the correct password in backend/.env -> DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/poms');
    } else if (/does not exist/i.test(e.message)) {
      console.error('  hint  : Database "poms" does not exist - create it with CREATE DATABASE poms;');
    }
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}
main();
