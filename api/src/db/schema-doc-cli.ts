import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readMigrations } from './migrate';
import { parseMigrations } from './schemaDoc';
import { renderSchema } from './schemaRender';

/** Writes database/SCHEMA.md at the root of the repository from the migrations. Needs no database. */
const root = join(__dirname, '..', '..', '..');
const text = renderSchema(parseMigrations(readMigrations(join(root, 'api', 'migrations'))));
writeFileSync(join(root, 'database', 'SCHEMA.md'), text, 'utf-8');
process.stdout.write(`Wrote database/SCHEMA.md (${text.split('\n').length} lines)\n`);
