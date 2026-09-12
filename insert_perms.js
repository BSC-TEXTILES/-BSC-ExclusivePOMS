import { pool } from './backend/src/config/db.js';

const newPerms = [
  { id: crypto.randomUUID(), code: 'dashboard.view', module: 'dashboard', description: 'View Dashboard' },
  { id: crypto.randomUUID(), code: 'catalogue.view', module: 'catalogue', description: 'View Catalogue' },
  { id: crypto.randomUUID(), code: 'brands.view', module: 'brand', description: 'View Brands' },
  { id: crypto.randomUUID(), code: 'categories.view', module: 'category', description: 'View Categories' },
  { id: crypto.randomUUID(), code: 'product_types.view', module: 'product_type', description: 'View Product Types' },
  { id: crypto.randomUUID(), code: 'colors.view', module: 'color', description: 'View Colors' },
  { id: crypto.randomUUID(), code: 'sizes.view', module: 'size', description: 'View Sizes' },
  { id: crypto.randomUUID(), code: 'manufacturers.view', module: 'manufacturer', description: 'View Manufacturers' },
  { id: crypto.randomUUID(), code: 'locations.view', module: 'location', description: 'View Locations' },
  { id: crypto.randomUUID(), code: 'calendar.view', module: 'calendar', description: 'View PO Calendar' },
  { id: crypto.randomUUID(), code: 'chat.view', module: 'chat', description: 'Access Team Chat' },
  { id: crypto.randomUUID(), code: 'auctions.view', module: 'auction', description: 'View Auctions' },
  { id: crypto.randomUUID(), code: 'import.manage', module: 'import', description: 'Import Data' },
  { id: crypto.randomUUID(), code: 'attachments.view', module: 'attachment', description: 'View Attachments' }
];

async function run() {
  const client = await pool.connect();
  try {
    for (const p of newPerms) {
      await client.query(`
        INSERT INTO permissions (id, code, module, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (code) DO NOTHING
      `, [p.id, p.code, p.module, p.description]);
      console.log('Inserted', p.code);
    }
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

run();
