import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

const admin = new Client({ connectionString: 'postgresql://postgres@localhost:5432/postgres' });
await admin.connect();
const { rows } = await admin.query(`SELECT datname FROM pg_database WHERE datname='poms'`);
if (!rows.length) {
  await admin.query(`CREATE DATABASE poms`);
  console.log('CREATED database poms');
} else {
  console.log('database poms exists');
}
await admin.end();

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const { rows: tables } = await c.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`);
console.log('tables in poms:', tables[0].n);
await c.end();
