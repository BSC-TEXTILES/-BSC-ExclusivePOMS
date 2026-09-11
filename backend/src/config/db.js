import dotenv from 'dotenv';
import pg from 'pg';

// Always re-read .env from disk to prevent stale parent process environments
dotenv.config({ override: true });

let connStr = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/poms';

// Resilience: auto-correct accidental port 5433 to standard 5432 for localhost
if (connStr.includes('localhost:5433') || connStr.includes('127.0.0.1:5433')) {
  connStr = connStr.replace(':5433', ':5432');
}

// Resilience: if local postgres user has no password specified, supply local default 'postgres'
if (connStr.includes('postgresql://postgres@localhost') || connStr.includes('postgresql://postgres@127.0.0.1')) {
  connStr = connStr.replace('postgresql://postgres@', 'postgresql://postgres:postgres@');
}

const isSupabase = connStr.includes('supabase');

export const pool = new pg.Pool({
  connectionString: connStr,
  max: 10,
  ssl: isSupabase ? { rejectUnauthorized: false } : false,
});

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
