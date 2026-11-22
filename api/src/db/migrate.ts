import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from 'pg';

export interface Migration { version: number; name: string; sql: string; checksum: string }

const FILE = /^V(\d+)__([A-Za-z0-9_]+)\.sql$/;

/** The numbered SQL files of a folder, in order. Two files with one number, or a gap in the numbers, is an error. */
export function readMigrations(dir: string): Migration[] {
  const found = readdirSync(dir).flatMap(file => {
    const m = FILE.exec(file);
    if (!m) return [];
    const sql = readFileSync(join(dir, file), 'utf-8');
    return [{ version: Number(m[1]), name: m[2], sql, checksum: createHash('sha256').update(sql).digest('hex') }];
  }).sort((a, b) => a.version - b.version);
  found.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`Migrations must be numbered 1, 2, 3 without gaps or repeats; found V${m.version} at position ${i + 1}`);
  });
  return found;
}

/**
 * Applies the migrations that have not run yet, each in its own transaction, and returns their numbers. A file that was already
 * applied must not have changed: its stored checksum is compared, and a difference stops the run. One run at a time (advisory lock).
 */
export async function applyMigrations(client: Client, migrations: readonly Migration[]): Promise<number[]> {
  await client.query('SELECT pg_advisory_lock(727274)');
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version int PRIMARY KEY, name text NOT NULL, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const done = new Map((await client.query<{ version: number; checksum: string }>('SELECT version, checksum FROM schema_migrations')).rows.map(r => [r.version, r.checksum]));
    const applied: number[] = [];
    for (const m of migrations) {
      const before = done.get(m.version);
      if (before !== undefined) {
        if (before !== m.checksum) throw new Error(`Migration V${m.version} was changed after it was applied. Add a new migration instead.`);
        continue;
      }
      try {
        await client.query('BEGIN');
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [m.version, m.name, m.checksum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
      applied.push(m.version);
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)');
  }
}

/** Creates the application's login role, or sets its password again if it exists. The password is escaped by the driver, never pasted into a file. */
export async function ensureAppRole(client: Client, password: string): Promise<void> {
  const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'lira_app'");
  const literal = client.escapeLiteral(password);
  await client.query(exists.rowCount ? `ALTER ROLE lira_app LOGIN PASSWORD ${literal}` : `CREATE ROLE lira_app LOGIN PASSWORD ${literal}`);
}
