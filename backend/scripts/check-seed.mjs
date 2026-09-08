import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const checks = [
  ['users', 'SELECT count(*)::int n FROM users'],
  ['divisions', 'SELECT count(*)::int n FROM divisions'],
  ['sections', 'SELECT count(*)::int n FROM sections'],
  ['products', 'SELECT count(*)::int n FROM products'],
  ['manufacturers', 'SELECT (SELECT count(*)::int FROM information_schema.tables WHERE table_name=\'manufacturers\') AS tbl, count(*)::int n FROM manufacturers'],
  ['product profit_margin', "SELECT count(*)::int n FROM information_schema.columns WHERE table_name='products' AND column_name='profit_margin'"],
  ['sizes', 'SELECT count(*)::int n FROM sizes'],
  ['colours', 'SELECT count(*)::int n FROM colours'],
  ['suppliers', 'SELECT count(*)::int n FROM suppliers'],
  ['purchase_orders', 'SELECT count(*)::int n FROM purchase_orders'],
  ['roles', 'SELECT count(*)::int n FROM roles'],
  ['permissions', 'SELECT count(*)::int n FROM permissions'],
];

for (const [name, sql] of checks) {
  try {
    const { rows } = await pool.query(sql);
    console.log(`${name}:`, rows[0].tbl !== undefined ? `table=1 count=${rows[0].n}` : rows[0].n);
  } catch (e) {
    console.log(`${name}: ERROR ${e.message.split('\n')[0]}`);
  }
}
await pool.end();
