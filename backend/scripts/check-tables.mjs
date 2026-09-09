import pg from 'pg';

const c = new pg.Client({ connectionString: 'postgresql://postgres@localhost:5432/poms' });
try {
  await c.connect();
  const r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('Tables:', r.rows.map((x) => x.table_name).join(', '));
  const users = await c.query('SELECT count(*)::int AS n FROM users');
  console.log('Users:', users.rows[0].n);
  const sections = await c.query('SELECT count(*)::int AS n FROM sections');
  console.log('Sections:', sections.rows[0].n);
  const products = await c.query('SELECT count(*)::int AS n FROM products');
  console.log('Products:', products.rows[0].n);
} catch (e) {
  console.log('ERR:', e.message);
} finally {
  await c.end();
}