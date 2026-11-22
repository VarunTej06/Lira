import { join } from 'node:path';
import { Client } from 'pg';
import { applyMigrations, ensureAppRole, readMigrations } from './migrate';

/**
 * Prepares a database: creates the application role, then applies the migrations. Run it as the server's admin, never as the application.
 *   ADMIN_DATABASE_URL  the admin connection
 *   APP_DB_PASSWORD     the password to give the lira_app role
 *   DATABASE_SSL        `disable` only for a local test database
 */
async function main(): Promise<void> {
  const url = process.env.ADMIN_DATABASE_URL;
  const password = process.env.APP_DB_PASSWORD;
  if (!url || !password) throw new Error('Set ADMIN_DATABASE_URL and APP_DB_PASSWORD');
  const client = new Client({ connectionString: url, ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: true } });
  await client.connect();
  try {
    await ensureAppRole(client, password);
    const applied = await applyMigrations(client, readMigrations(join(__dirname, '..', '..', 'migrations')));
    process.stdout.write(applied.length ? `Applied migrations: ${applied.join(', ')}\n` : 'Nothing to apply: the database is up to date.\n');
  } finally {
    await client.end();
  }
}

main().catch(error => {
  process.stderr.write(`Migration failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exit(1);
});
