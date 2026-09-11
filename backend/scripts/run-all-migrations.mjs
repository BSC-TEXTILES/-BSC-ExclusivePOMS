import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/poms';
const client = new pg.Client({ connectionString: url });

async function run() {
  await client.connect();
  console.log(`Connected to database at ${url}`);

  const migrationsDir = path.resolve(__dirname, '../../database/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files.`);

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    try {
      console.log(`Applying migration: ${file}...`);
      await client.query(sql);
      console.log(`✓ Applied ${file}`);
    } catch (err) {
      console.warn(`! Migration ${file} had note/error:`, err.message);
    }
  }

  // Also check and ensure locations, product_types, and videos exist
  const res = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('videos', 'locations', 'product_types', 'dealers', 'collections')
  `);
  console.log('Verified core tables present:', res.rows.map(r => r.table_name));

  await client.end();
}

run().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
