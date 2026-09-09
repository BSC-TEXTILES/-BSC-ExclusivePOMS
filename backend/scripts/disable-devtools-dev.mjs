import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5433/poms';
const client = new pg.Client({ connectionString: url });

async function run() {
  await client.connect();
  await client.query(`
    INSERT INTO settings ("key", "value", "description")
    VALUES ('security', '{"devtoolsBlock": false}', 'DevTools blocking — disabled in development')
    ON CONFLICT ("key") DO UPDATE SET "value" = '{"devtoolsBlock": false}';
  `);
  console.log('✓ Successfully set devtoolsBlock: false in settings');
  await client.end();
}

run().catch(console.error);
