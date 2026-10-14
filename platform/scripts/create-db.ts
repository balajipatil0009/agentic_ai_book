import 'dotenv/config';
import { Client } from 'pg';

/**
 * Creates the target database when it doesn't exist yet, so a fresh machine
 * can go from clone to `npm run db:setup` without opening psql.
 * Safe to run repeatedly — an existing database is left untouched.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set — copy .env.example to .env first.');

  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.replace(/^\//, '').split('?')[0]);
  if (!dbName) throw new Error('DATABASE_URL must include a database name.');

  const admin = new URL(target);
  admin.pathname = '/postgres';

  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rows.length > 0) {
      console.log(`Database "${dbName}" already exists.`);
      return;
    }
    // CREATE DATABASE cannot be parameterized — quote the identifier instead.
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database "${dbName}".`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
