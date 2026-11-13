import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PALETTE } from './theme/palette';

/**
 * Rules for the code itself, checked by reading the source files (no browser, no extra tools).
 * They keep promises made in the bug lists: no other product's name anywhere, no browser pop-ups, no native date field,
 * no emojis in the interface (except the icons chosen for spaces), no unsafe ways of putting text on a page.
 */

const APP = process.cwd();                 // lira-app
const ROOT = path.resolve(APP, '..');      // the repository
const SKIP = new Set(['node_modules', 'dist', '.git']);

function files(dir: string, ok: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p, ok)); else if (ok(p)) out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/');
const isCode = (p: string) => /\.(ts|tsx)$/.test(p) && !/\.test\.(ts|tsx)$/.test(p) && !p.includes(`${path.sep}test${path.sep}`);
const src = files(path.join(APP, 'src'), isCode);
const server = files(path.join(APP, 'server'), isCode);
const read = (p: string) => fs.readFileSync(p, 'utf-8');
/** The code without its comments, so a rule is not tripped by a sentence that explains it. */
const noComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const offenders = (list: string[], test: (text: string) => boolean) => list.filter(p => test(noComments(read(p)))).map(rel);

describe('The source is in the shape we agreed', () => {
  it('finds the source files it is meant to check', () => {
    expect(src.length).toBeGreaterThan(150);
    expect(server.length).toBeGreaterThanOrEqual(3);
  });

  it('no other product\'s name anywhere in the code, the styles, the page or the documents', () => {
    const docs = [
      ...['README.md', 'SETUP.md', 'ROADMAP.md', 'PUBLIC_EDITION_PLAN.md', 'SECURITY_REPORT.md'].map(f => path.join(ROOT, f)),
      ...files(path.join(ROOT, 'Prompts and Architectures'), p => p.endsWith('.md')),
    ].filter(p => fs.existsSync(p));
    const extra = [path.join(APP, 'index.html'), path.join(APP, 'tailwind.config.js'), path.join(APP, 'vite.config.ts'), ...files(path.join(APP, 'src'), p => p.endsWith('.css'))];
    const hits = [...src, ...server, ...docs, ...extra].filter(p => /jira|atlassian/i.test(read(p))).map(rel);
    expect(hits).toEqual([]);
  });

  it('no browser pop-ups (confirm, prompt, alert): Lira has its own dialogs', () => {
    const hits = offenders(src, t => /(^|[^A-Za-z0-9_.$])(window\.)?(confirm|prompt|alert)\s*\(/.test(t));
    expect(hits).toEqual([]);
  });

  it('no native <input type="date">: Lira has its own date picker', () => {
    expect(offenders(src, t => /type=["']date["']/.test(t))).toEqual([]);
  });

  it('no emojis in the interface; only the icons chosen for spaces may use them', () => {
    // These files hold the picker for space icons, the sample spaces, and the fallback shown when a space has no icon.
    const SPACE_ICON_FILES = ['components/board/CreateSpaceModal.tsx', 'components/projects/CreateProjectModal.tsx', 'db/seedData.ts'];
    const FALLBACKS = /[\u{1F4C1}\u{1F680}]/gu; // folder and rocket: the icon used when a space has none
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{2705}\u{274C}]/gu;
    const hits = src.filter(p => !SPACE_ICON_FILES.some(f => rel(p).endsWith(f))).filter(p => {
      const text = read(p).replace(FALLBACKS, '').replace(/[✓✔]/g, ''); // a plain tick character is text, not an emoji
      return emoji.test(text);
    }).map(rel);
    expect(hits).toEqual([]);
  });

  it('text is never put on the page as raw HTML, and nothing runs code from a string', () => {
    expect(offenders([...src, ...server], t => /dangerouslySetInnerHTML|\beval\s*\(|new Function\s*\(/.test(t))).toEqual([]);
    // the only places allowed to write to innerHTML or the document directly
    const allowed = ['components/common/richtext/mentions.ts', 'components/sprints/SprintReports.tsx'];
    const hits = offenders(src, t => /\.innerHTML\s*=|document\.write\s*\(/.test(t)).filter(f => !allowed.some(a => f.endsWith(a)));
    expect(hits).toEqual([]);
  });

  it('no leftover console.log in the app', () => {
    expect(offenders([...src, ...server], t => /console\.log\s*\(/.test(t))).toEqual([]);
  });

  it('every address that is opened from the app is checked first (links typed by people)', () => {
    // window.open must use noopener or a checked address. The print view of a sprint report opens an empty window
    // of its own and writes Lira's own escaped report into it, so it is the one exception.
    const hits = src.filter(p => /window\.open\s*\(/.test(noComments(read(p)))).map(rel).filter(f => !f.endsWith('components/sprints/SprintReports.tsx'));
    expect(hits.length).toBeGreaterThan(0);
    for (const f of hits) {
      const text = noComments(read(path.join(ROOT, f)));
      expect(/safeHttpUrl|absolute\(|noopener/.test(text), `${f} opens a window without noopener or a checked address`).toBe(true);
    }
  });
});

describe('The pieces fit together', () => {
  it('every page route in the table has a title, and every route kind is handled in App', () => {
    const routes = read(path.join(APP, 'src/routes.ts'));
    const app = read(path.join(APP, 'src/App.tsx')) + read(path.join(APP, 'src/AppRoutes.tsx')); // the pages are listed in AppRoutes
    for (const kind of [...routes.matchAll(/kind: '([a-zA-Z]+)'; /g)].map(m => m[1])) {
      expect(routes.includes(`case '${kind}'`), `${kind} has no case in routes.ts`).toBe(true);
    }
    for (const page of ['/dashboards', '/roadmaps', '/sprints', '/projects', '/filters', '/for-you', '/tickets', '/space/:spaceKey/*']) {
      expect(app.includes(`path="${page}`), `${page} is not a route in App.tsx`).toBe(true);
    }
  });

  it('the data files the app writes are all known to the disk store', () => {
    const store = read(path.join(APP, 'server/diskStore.ts'));
    const mirror = read(path.join(APP, 'src/services/kvMirror.ts'));
    for (const f of ['projects', 'roadmaps', 'sprints', 'teams', 'standups', 'board-config', 'dashboards', 'settings', 'secrets']) {
      expect(store.includes(`'${f}'`), `${f} missing in diskStore`).toBe(true);
      expect(mirror.includes(`'${f}'`), `${f} missing in kvMirror`).toBe(true);
    }
  });

  it('no secrets in the code (keys, tokens, passwords written out)', () => {
    const hits = offenders([...src, ...server], t => /AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{30,}|ghp_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t));
    expect(hits).toEqual([]);
  });

  it('the production build does not publish source maps', () => {
    expect(read(path.join(APP, 'vite.config.ts'))).toMatch(/sourcemap:\s*false/);
  });
});

describe('The documents match the code', () => {
  const docs = [
    ...['README.md', 'SETUP.md', 'TESTING.md', 'PUBLIC_EDITION_PLAN.md', 'SECURITY_REPORT.md'].map(f => path.join(ROOT, f)),
    ...files(path.join(ROOT, 'Prompts and Architectures'), p => p.endsWith('.md')),
  ].filter(p => fs.existsSync(p));

  it('every "npm run ..." command the documents mention exists in package.json', () => {
    const scripts = Object.keys(JSON.parse(read(path.join(APP, 'package.json'))).scripts);
    const wrong: string[] = [];
    for (const d of docs) for (const m of read(d).matchAll(/npm run ([a-z][a-z0-9:-]*)/g)) if (!scripts.includes(m[1])) wrong.push(`${rel(d)}: npm run ${m[1]}`);
    expect(wrong).toEqual([]);
  });

  it('every link to another file in the documents points at a file that exists', () => {
    const broken: string[] = [];
    for (const d of docs) {
      for (const m of read(d).matchAll(/\]\(([^)#\s]+?)(#[^)]*)?\)/g)) {
        const target = m[1];
        if (/^(https?:|mailto:|\/)/.test(target)) continue;
        const resolved = path.resolve(path.dirname(d), decodeURIComponent(target));
        if (!fs.existsSync(resolved)) broken.push(`${rel(d)} -> ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('the tests the documents talk about are really there', () => {
    const testing = path.join(ROOT, 'TESTING.md');
    if (!fs.existsSync(testing)) return;
    const text = read(testing);
    for (const m of text.matchAll(/`((?:src|server|tests)\/[A-Za-z0-9_./-]+\.test\.tsx?)`/g)) {
      expect(fs.existsSync(path.join(APP, m[1])), `TESTING.md mentions ${m[1]}, which does not exist`).toBe(true);
    }
  });
});

describe('Quality ratchets: things that were cleaned up must stay clean', () => {
  const REMAINING_REACT_HOOK_SUPPRESSIONS = 9; // roadmap drag/scroll code and the ticket popup; lower this when one is fixed, never raise it

  it('saved settings are read and written through appStorage, not by touching localStorage directly', () => {
    const allowed = ['services/kvMirror.ts', 'services/localDiskSync.ts', 'utils/appStorage.ts'];
    const hits = offenders(src, t => /\blocalStorage\.(getItem|setItem|removeItem)\s*\(/.test(t)).filter(f => !allowed.some(a => f.endsWith(a)));
    expect(hits).toEqual([]);
  });

  it('text sizes come from the type scale (text-xs, text-2xs ...), not one-off pixel sizes', () => {
    const cssFiles = files(path.join(APP, 'src'), p => p.endsWith('.css'));
    const hits = [...src, ...cssFiles].filter(p => /text-\[[0-9.]+(px|rem|em)\]/.test(read(p))).map(rel);
    expect(hits).toEqual([]);
  });

  it('no "any" type: use unknown and narrow it, or write the real type', () => {
    expect(offenders([...src, ...server], t => /:\s*any\b|\bas any\b|<any>|\bany\[\]/.test(t))).toEqual([]);
  });

  it('colours kept in the palette are not written out again as hex codes', () => {
    const allowed = ['theme/palette.ts'];
    const values = Object.values(PALETTE).map(v => v.toLowerCase());
    const hits = offenders(src, t => values.some(v => new RegExp(`['"]${v}['"]`, 'i').test(t))).filter(f => !allowed.some(a => f.endsWith(a)));
    expect(hits).toEqual([]);
  });

  it('a label on the accent colour is never fixed white: it would be unreadable on the yellow and baby blue themes', () => {
    const fill = String.raw`(?<![\w:-])bg-lira-blue(?![\w/-])`;
    const white = String.raw`(?<![\w:-])text-white(?![\w/-])`;
    const both = new RegExp(`${fill}[^'"\`]*${white}|${white}[^'"\`]*${fill}`);
    expect(offenders(src, t => both.test(t))).toEqual([]);
  });

  it('the palette holds plain 6-digit hex colours, each name once', () => {
    for (const [name, value] of Object.entries(PALETTE)) expect(value, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(new Set(Object.values(PALETTE).map(v => v.toLowerCase())).size).toBe(Object.values(PALETTE).length);
  });

  it('suppressions of the hooks rule do not grow', () => {
    const count = src.reduce((n, p) => n + (read(p).match(/eslint-disable[^\n]*react-hooks/g)?.length ?? 0), 0);
    expect(count).toBeLessThanOrEqual(REMAINING_REACT_HOOK_SUPPRESSIONS);
  });

  it('the documents agree on how many automated tests there are', () => {
    const where: Record<string, RegExp> = {
      'README.md': /(\d+) automated tests/,
      'TESTING.md': /(\d+) automated tests/,
      'SECURITY_REPORT.md': /(\d+) automated tests/,
      'lira-app/README.md': /(\d+) tests in \d+ files/,
    };
    const found = Object.entries(where).map(([f, re]) => [f, read(path.join(ROOT, f)).match(re)?.[1]] as const);
    expect(found.filter(([, n]) => !n).map(([f]) => f), 'a document no longer states the test count').toEqual([]);
    expect(new Set(found.map(([, n]) => n)).size, `documents disagree: ${JSON.stringify(found)}`).toBe(1);
  });
});
