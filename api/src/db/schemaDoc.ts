import type { Migration } from './migrate';

export interface Column { name: string; type: string; required: boolean; default: string | null; unique: boolean; primary: boolean; check: string | null; references: { table: string; column: string } | null }
export interface Table { name: string; since: number; purpose: string; columns: Column[]; constraints: string[]; indexes: string[]; privileges: Record<string, string> }
interface Statement { comment: string; text: string }

const TABLE_CONSTRAINT = /^(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT|EXCLUDE)\b/i;

/** Splits SQL into statements at `;` outside quotes, keeping the `--` comment lines that came right before each one. */
export function splitStatements(sql: string): Statement[] {
  const out: Statement[] = [];
  let comment = '';
  let text = '';
  let quoted = false;
  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!quoted && trimmed.startsWith('--')) { if (!text.trim()) comment += `${trimmed.replace(/^--\s?/, '')} `; continue; }
    if (!trimmed && !text.trim()) { comment = ''; continue; } // a blank line ends a comment that belonged to nothing
    let kept = '';
    for (const ch of line) {
      if (ch === "'") quoted = !quoted;
      if (ch === ';' && !quoted) { if (text.trim() || kept.trim()) out.push({ comment: comment.trim(), text: `${text}${kept}`.trim() }); text = ''; kept = ''; comment = ''; continue; }
      kept += ch;
    }
    const noTrailing = !quoted ? kept.replace(/\s--.*$/, '') : kept; // a comment after code on the same line
    text += `${noTrailing}\n`;
  }
  return out;
}

/** Splits at commas that are not inside brackets or quotes. */
export function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (const ch of text) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') { parts.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const bracketed = (text: string): string => text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'));

export function parseColumn(def: string): Column {
  const flat = def.replace(/\s+/g, ' ').trim();
  const [name, ...rest] = flat.split(' ');
  const body = rest.join(' ');
  const typeEnd = body.search(/\b(NOT NULL|NULL|DEFAULT|PRIMARY KEY|REFERENCES|UNIQUE|CHECK|GENERATED)\b/i);
  const ref = /REFERENCES\s+(\w+)\s*\((\w+)\)/i.exec(body);
  const def2 = /DEFAULT\s+(.+?)(?=\s+(?:NOT NULL|NULL|PRIMARY KEY|REFERENCES|UNIQUE|CHECK)\b|$)/i.exec(body);
  const check = /CHECK\s*(\(.*\))/i.exec(body);
  return {
    name, type: (typeEnd < 0 ? body : body.slice(0, typeEnd)).trim(),
    required: /NOT NULL|PRIMARY KEY/i.test(body), default: def2 ? def2[1].trim() : null,
    unique: /\bUNIQUE\b/i.test(body), primary: /PRIMARY KEY/i.test(body), check: check ? check[1] : null,
    references: ref ? { table: ref[1], column: ref[2] } : null,
  };
}

function addAction(table: Table, action: string): void {
  const flat = action.replace(/\s+/g, ' ').trim();
  const add = /^ADD COLUMN (.+)$/i.exec(flat);
  if (add) { table.columns.push(parseColumn(add[1])); return; }
  const constraint = /^ADD CONSTRAINT (.+)$/i.exec(flat);
  if (constraint) { table.constraints.push(constraint[1]); return; }
  const drop = /^ALTER COLUMN (\w+) DROP NOT NULL$/i.exec(flat);
  if (drop) { const c = table.columns.find(x => x.name === drop[1]); if (c) c.required = false; }
}

/** Reads every migration in order and returns the tables as they stand after the last one: columns, constraints, indexes and what the app role may do. */
export function parseMigrations(migrations: readonly Pick<Migration, 'version' | 'sql'>[]): Table[] {
  const tables = new Map<string, Table>();
  for (const m of migrations) {
    for (const { comment, text } of splitStatements(m.sql)) {
      const create = /^CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(/i.exec(text);
      if (create) {
        const t: Table = { name: create[1], since: m.version, purpose: comment, columns: [], constraints: [], indexes: [], privileges: {} };
        for (const part of splitTop(bracketed(text))) { if (TABLE_CONSTRAINT.test(part)) t.constraints.push(part.replace(/\s+/g, ' ')); else t.columns.push(parseColumn(part)); }
        tables.set(t.name, t);
        continue;
      }
      const alter = /^ALTER TABLE (\w+)\s+([\s\S]+)$/i.exec(text);
      if (alter && tables.has(alter[1])) { for (const a of splitTop(alter[2])) addAction(tables.get(alter[1])!, a); continue; }
      const index = /^CREATE (UNIQUE )?INDEX (\w+) ON (\w+)\s*(?:USING \w+\s*)?\(([\s\S]+)\)/i.exec(text);
      if (index && tables.has(index[3])) { tables.get(index[3])!.indexes.push(`${index[1] ? 'unique ' : ''}${index[2]} (${index[4].replace(/\s+/g, ' ').trim()})`); continue; }
      const grant = /^GRANT ([\s\S]+?) ON ([\s\S]+?) TO (\w+)$/i.exec(text);
      if (grant) for (const name of grant[2].split(',').map(x => x.trim())) { const t = tables.get(name); if (t) t.privileges[grant[3]] = [t.privileges[grant[3]], grant[1].replace(/\s+/g, ' ')].filter(Boolean).join(', '); }
    }
  }
  return [...tables.values()];
}
