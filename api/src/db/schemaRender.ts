import type { Column, Table } from './schemaDoc';

const cell = (text: string): string => text.replace(/\|/g, '\\|');

function columnNotes(c: Column): string {
  const notes = [c.primary ? 'primary key' : '', c.unique ? 'unique' : '', c.references ? `-> ${c.references.table}.${c.references.column}` : '', c.default ? `default ${c.default}` : '', c.check ? `check ${c.check}` : ''];
  return notes.filter(Boolean).join('; ');
}

/** The relationships between tables, as a Mermaid entity diagram: one line per foreign key, labelled with the column. */
export function erDiagram(tables: readonly Table[]): string {
  const lines = ['erDiagram'];
  for (const t of tables) for (const c of t.columns) if (c.references) lines.push(`  ${c.references.table} ||--o{ ${t.name} : "${c.name}"`);
  return lines.join('\n');
}

function renderTable(t: Table): string {
  const rows = t.columns.map(c => `| ${c.name} | ${cell(c.type)} | ${c.required ? 'yes' : 'no'} | ${cell(columnNotes(c))} |`);
  const privileges = Object.entries(t.privileges).map(([role, what]) => `${role}: ${what}`).join('; ');
  return [
    `### ${t.name}`, '',
    t.purpose ? `${t.purpose}` : '', '',
    `Created in V${t.since}. ${privileges ? `Application role may: ${privileges}.` : 'No privilege is given to the application role.'}`, '',
    '| Column | Type | Required | Notes |', '|---|---|---|---|', ...rows, '',
    ...(t.constraints.length ? ['Constraints:', ...t.constraints.map(c => `- \`${c}\``), ''] : []),
    ...(t.indexes.length ? ['Indexes:', ...t.indexes.map(i => `- \`${i}\``), ''] : []),
  ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n');
}

/** The whole description of the database as one Markdown page. Rebuilt from the migrations; a test fails when the saved copy is out of date. */
export function renderSchema(tables: readonly Table[]): string {
  return [
    '# Database schema', '',
    '<!-- Generated from api/migrations by `npm run schema-doc` in api/. Do not edit by hand: a test fails when this file is out of date. -->', '',
    `${tables.length} tables. Each is scoped to an organisation (\`org_id\`) unless it belongs to a person, a session or a team; the API filters every query by it.`, '',
    '## Relationships', '', '```mermaid', erDiagram(tables), '```', '',
    '## Tables', '', ...tables.map(renderTable), '',
  ].join('\n');
}
