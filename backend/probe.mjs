import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const sql = `SELECT p.id, p.product_serial, p.sku, p.name, p.status, p.hsn_sac,
        p.brand_id, p.section_id, p.category_id, p.purchase_price,
        b.brand_name, b.brand_number, b.manufacturer,
        s.name AS section_name, dep.name AS department_name, dep.id AS department_id,
        (SELECT pi.storage_key FROM product_images pi WHERE pi.product_id = p.id
          ORDER BY pi.is_primary DESC, pi.sort_order, pi.uploaded_at LIMIT 1) AS primary_image_key,
        (SELECT count(*)::int FROM product_images pi WHERE pi.product_id = p.id) AS image_count,
        COALESCE((SELECT json_agg(sup.company_name)
                    FROM supplier_brands sb JOIN suppliers sup ON sup.id = sb.supplier_id
                   WHERE sb.brand_id = p.brand_id), '[]') AS providers
   FROM products p
   JOIN brands b ON b.id = p.brand_id
   JOIN sections s ON s.id = p.section_id
   JOIN departments dep ON dep.id = s.department_id
   WHERE p.status <> 'archived'
   ORDER BY p.name
   LIMIT 3 OFFSET 0`;
try { const r = await client.query(sql); console.log('PRODUCTS QUERY OK rows=', r.rows.length); }
catch (e) { console.log('PRODUCTS SQL ERROR:', e.message); }
try {
  const c = await client.query("SELECT count(*)::int AS count FROM products p JOIN brands b ON b.id = p.brand_id JOIN sections s ON s.id = p.section_id");
  console.log('COUNT OK', c.rows);
} catch (e) { console.log('COUNT ERROR:', e.message); }
try {
  const t = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='products' ORDER BY ordinal_position");
  console.log('PRODUCT COLS:', t.rows.map((x) => x.column_name).join(','));
} catch (e) { console.log('COLS ERROR', e.message); }
await client.end();
