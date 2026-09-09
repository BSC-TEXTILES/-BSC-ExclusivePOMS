import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/poms';
const c = new pg.Client({ connectionString: url });
try {
  await c.connect();
  const sql = fs.readFileSync(new URL('../../database/migrations/005_videos.sql', import.meta.url), 'utf8');
  await c.query(sql);
  console.log('Migration 005 applied: videos table + permissions created');
} catch (e) {
  console.log('ERR:', e.message);
} finally {
  await c.end();
}