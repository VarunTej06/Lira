import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readMigrations } from './migrate';

const dirs: string[] = [];
function folder(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'lira-mig-'));
  dirs.push(dir);
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
}
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

describe('readMigrations', () => {
  it('reads numbered files in order, ignoring other files', () => {
    const m = readMigrations(folder({ 'V2__second.sql': 'SELECT 2;', 'V1__first.sql': 'SELECT 1;', 'notes.txt': 'x', 'README.md': 'y' }));
    expect(m.map(x => [x.version, x.name])).toEqual([[1, 'first'], [2, 'second']]);
    expect(m[0].checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(m[0].checksum).not.toBe(m[1].checksum);
  });

  it('gives the same checksum for the same text and another for changed text', () => {
    const a = readMigrations(folder({ 'V1__x.sql': 'SELECT 1;' }))[0].checksum;
    expect(readMigrations(folder({ 'V1__x.sql': 'SELECT 1;' }))[0].checksum).toBe(a);
    expect(readMigrations(folder({ 'V1__x.sql': 'SELECT 1; ' }))[0].checksum).not.toBe(a);
  });

  it('stops on a gap, on a repeat, and on a file that does not start at 1', () => {
    expect(() => readMigrations(folder({ 'V1__a.sql': '', 'V3__c.sql': '' }))).toThrow(/without gaps/);
    expect(() => readMigrations(folder({ 'V1__a.sql': '', 'V1__b.sql': '' }))).toThrow(/without gaps/);
    expect(() => readMigrations(folder({ 'V2__b.sql': '' }))).toThrow(/without gaps/);
  });

  it('ignores a file whose name is not in the V<number>__<name>.sql form', () => {
    expect(readMigrations(folder({ 'V1__a.sql': '', 'v2__b.sql': '', 'V3-c.sql': '', 'V4__d.txt': '' })).map(x => x.version)).toEqual([1]);
  });

  it('reads the real migrations of this project, numbered from 1, and the app role has no way to change the audit log', () => {
    const real = readMigrations(join(__dirname, '..', '..', 'migrations'));
    expect(real.map(m => m.version)).toEqual(real.map((_, i) => i + 1));
    const withoutComments = (sql: string) => sql.split(/\r?\n/).map(line => line.replace(/--.*$/, '')).join('\n');
    const statements = real.flatMap(m => withoutComments(m.sql).split(';')).map(s => s.replace(/\s+/g, ' ').trim());
    const onAudit = statements.filter(s => /^GRANT/i.test(s) && /\baudit_log\b/.test(s) && /lira_app/.test(s));
    expect(onAudit).toEqual(['GRANT SELECT, INSERT ON audit_log TO lira_app']);
    expect(statements.filter(s => /GRANT ALL|SUPERUSER|CREATEDB|CREATEROLE/i.test(s))).toEqual([]);
  });
});
