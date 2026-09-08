import pg from 'pg';

const c = new pg.Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/poms' });
try {
  await c.connect();
  await c.query(`
    CREATE TABLE IF NOT EXISTS product_sizes (
      product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size_id    uuid NOT NULL REFERENCES sizes(id),
      PRIMARY KEY (product_id, size_id)
    );
    CREATE TABLE IF NOT EXISTS product_colours (
      product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      colour_id  uuid NOT NULL REFERENCES colours(id),
      PRIMARY KEY (product_id, colour_id)
    );
    CREATE INDEX IF NOT EXISTS idx_product_sizes_size ON product_sizes(size_id);
    CREATE INDEX IF NOT EXISTS idx_product_colours_colour ON product_colours(colour_id);
  `);
  console.log('Migration 004 applied: product_sizes + product_colours created');
} catch (e) {
  console.log('ERR:', e.message);
} finally {
  await c.end();
}