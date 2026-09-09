import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5433/poms';
const client = new pg.Client({ connectionString: url });

async function seed() {
  await client.connect();

  // Locations
  const locs = await client.query('SELECT count(*)::int AS count FROM locations');
  if (locs.rows[0].count === 0) {
    await client.query(`
      INSERT INTO locations (code, name, address, city, state, country, contact_person, phone) VALUES
      ('WH-BLR-01', 'Bangalore Central Distribution Hub', 'Plot 14B, Electronic City Phase 1', 'Bangalore', 'Karnataka', 'India', 'Ramesh Kumar', '+91 98450 12345'),
      ('WH-DVG-01', 'Davanagere Regional Warehouse', 'Industrial Estate, PB Road', 'Davanagere', 'Karnataka', 'India', 'Manjunath S', '+91 98451 67890'),
      ('ST-MUM-01', 'Mumbai Flagship Boutique', 'Phoenix Palladium, Lower Parel', 'Mumbai', 'Maharashtra', 'India', 'Priya Sharma', '+91 98200 11223')
      ON CONFLICT (code) DO NOTHING
    `);
    console.log('✓ Seeded locations');
  }

  // Company Settings
  const comp = await client.query('SELECT count(*)::int AS count FROM company_settings');
  if (comp.rows[0].count === 0) {
    await client.query(`
      INSERT INTO company_settings (
        company_name, legal_name, gstin, pan, cin, email, phone, website,
        registered_address, city, state, postal_code, country, logo_url
      ) VALUES (
        'BSC Exclusive',
        'BSC Exclusive Private Limited',
        '29AABCB1234F1Z5',
        'AABCB1234F',
        'U17120KA2024PTC188920',
        'procurement@bscexclusive.com',
        '+91 80 2345 6789',
        'https://bscexclusive.com',
        '#42, Commercial Avenue, PB Road',
        'Davanagere',
        'Karnataka',
        '577002',
        'India',
        '/bsc-logo.png'
      )
    `);
    console.log('✓ Seeded company settings');
  }

  // Product types
  const pts = await client.query('SELECT count(*)::int AS count FROM product_types');
  if (pts.rows[0].count === 0) {
    const sec = await client.query('SELECT id FROM sections LIMIT 1');
    if (sec.rows.length > 0) {
      const sectionId = sec.rows[0].id;
      await client.query(`
        INSERT INTO product_types (section_id, code, name) VALUES
        ($1, 'MENS_SHIRTS', 'Formal & Casual Shirts'),
        ($1, 'MENS_TROUSERS', 'Trousers & Chinos'),
        ($1, 'SAREES', 'Designer Sarees'),
        ($1, 'KURTIS', 'Ethnic Kurtis'),
        ($1, 'JEWELLERY', 'Fashion Jewellery')
        ON CONFLICT DO NOTHING
      `, [sectionId]);
      console.log('✓ Seeded product types');
    }
  }

  console.log('✓ Seed verification completed successfully.');
  await client.end();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
