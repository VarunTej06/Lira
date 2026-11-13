import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { APP_VERSION } from './appVersion';

const SRC = path.join(process.cwd(), 'src');
const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [path.join(dir, e.name)] : []);

describe('the app version', () => {
  it('is a major.minor number', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+$/);
  });

  it('is written in one place: no screen spells out its own "Lira v1.2"', () => {
    const hits = files(SRC).filter(f => /Lira[^'"`\n]{0,30}\bv\d+\.\d+/.test(fs.readFileSync(f, 'utf-8'))).map(f => path.relative(SRC, f));
    expect(hits).toEqual([]);
  });
});
