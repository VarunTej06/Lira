import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readMigrations } from './migrate';
import { parseColumn, parseMigrations, splitStatements, splitTop } from './schemaDoc';
import { erDiagram, renderSchema } from './schemaRender';

const sample = [
  { version: 1, sql: `-- People who sign in. Passwords are never stored here in clear.
CREATE TABLE users (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  name  text,
  UNIQUE (email)
);
CREATE UNIQUE INDEX users_email ON users (lower(email));
GRANT SELECT, INSERT ON users TO lira_app;` },
  { version: 2, sql: `CREATE TABLE notes (
  id      bigint PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- who wrote it
  body    text DEFAULT 'a; b'
);
ALTER TABLE notes ADD COLUMN pinned boolean NOT NULL DEFAULT false;
ALTER TABLE users ALTER COLUMN name SET DEFAULT 'x', ADD COLUMN google_sub text UNIQUE;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;` },
];

describe('reading SQL', () => {
  it('splits statements at semicolons outside quotes and keeps the comment above each', () => {
    const s = splitStatements(sample[1].sql);
    expect(s[0].text.startsWith('CREATE TABLE notes')).toBe(true);
    expect(s[0].text).toContain("'a; b'");
    expect(splitStatements(sample[0].sql)[0].comment).toBe('People who sign in. Passwords are never stored here in clear.');
  });
  it('splits at commas only outside brackets', () => {
    expect(splitTop("a int, b text CHECK (b IN ('x','y')), c numeric(10,2)")).toEqual(['a int', "b text CHECK (b IN ('x','y'))", 'c numeric(10,2)']);
  });
  it('reads a column: type, required, default, unique, check and where it points', () => {
    expect(parseColumn("org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE")).toMatchObject({ name: 'org_id', type: 'uuid', required: true, references: { table: 'organisations', column: 'id' } });
    expect(parseColumn("level text NOT NULL DEFAULT 'view' CHECK (level IN ('view','edit'))")).toMatchObject({ type: 'text', default: "'view'", check: "(level IN ('view','edit'))" });
    expect(parseColumn('id uuid PRIMARY KEY')).toMatchObject({ primary: true, required: true });
  });
});

describe('the tables after every migration', () => {
  const tables = parseMigrations(sample);
  const byName = (n: string) => tables.find(t => t.name === n)!;
  it('finds each table, in which migration it began, and the comment that explains it', () => {
    expect(tables.map(t => [t.name, t.since])).toEqual([['users', 1], ['notes', 2]]);
    expect(byName('users').purpose).toContain('People who sign in');
  });
  it('applies later changes: added columns, dropped NOT NULL, indexes, constraints and privileges', () => {
    expect(byName('notes').columns.map(c => c.name)).toEqual(['id', 'user_id', 'body', 'pinned']);
    expect(byName('users').columns.find(c => c.name === 'email')!.required).toBe(false);
    expect(byName('users').columns.map(c => c.name)).toContain('google_sub');
    expect(byName('users').indexes).toEqual(['unique users_email (lower(email))']);
    expect(byName('users').constraints).toEqual(['UNIQUE (email)']);
    expect(byName('users').privileges).toEqual({ lira_app: 'SELECT, INSERT' });
  });
  it('draws one relationship line per foreign key', () => {
    expect(erDiagram(tables)).toBe('erDiagram\n  users ||--o{ notes : "user_id"');
  });
});

describe('the real database', () => {
  const migrations = readMigrations(join(__dirname, '..', '..', 'migrations'));
  const tables = parseMigrations(migrations);
  it('is read completely: every table has columns and a way to tell its rows apart (a primary key or a unique index)', () => {
    expect(tables.length).toBeGreaterThanOrEqual(27);
    for (const t of tables) {
      expect(t.columns.length, t.name).toBeGreaterThan(0);
      expect(t.columns.some(c => c.primary) || t.constraints.some(c => /^PRIMARY KEY/i.test(c)) || t.indexes.some(i => i.startsWith('unique ')), `${t.name} can tell its rows apart`).toBe(true);
    }
  });
  it('points every foreign key at a table that exists', () => {
    const names = new Set(tables.map(t => t.name));
    for (const t of tables) for (const c of t.columns) if (c.references) expect(names.has(c.references.table), `${t.name}.${c.name}`).toBe(true);
  });
  it('matches database/SCHEMA.md; run `npm run schema-doc` in api/ when this fails', () => {
    const saved = readFileSync(join(__dirname, '..', '..', '..', 'database', 'SCHEMA.md'), 'utf-8').replace(/\r\n/g, '\n');
    expect(saved).toBe(renderSchema(tables).replace(/\r\n/g, '\n'));
  });
});
