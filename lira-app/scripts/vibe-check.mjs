// Counts the quick "vibe-coded" signals in src/ and server/. Run: node scripts/vibe-check.mjs
// Complexity is measured separately (see docs/04-quality/vibe-check.md); this covers what a text scan can see.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const isTest = f => /\.test\.tsx?$|[\\/]test[\\/]/.test(f);

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

const files = ['src', 'server'].flatMap(d => walk(join(root, d))).filter(f => !isTest(f));

// Each signal: name, pattern run on every non-test line, and a limit (0 = none allowed).
// A fourth entry lists files that are allowed to break the rule (the seams themselves).
const SIGNALS = [
  ['any type', /:\s*any\b|\bas any\b|<any>/, 0],
  ['@ts-ignore / @ts-nocheck', /@ts-(ignore|nocheck)/, 0],
  ['console.log', /console\.log\(/, 0],
  ['empty catch', /catch\s*(\([^)]*\))?\s*\{\s*\}/, 0],
  ['dangerouslySetInnerHTML / eval', /dangerouslySetInnerHTML|\beval\(|new Function\(/, 0],
  ['raw localStorage', /\blocalStorage\.(getItem|setItem|removeItem)\s*\(/, 0, ['services/kvMirror.ts', 'services/localDiskSync.ts', 'utils/appStorage.ts']],
  ['arbitrary text size', /text-\[\d+(\.\d+)?px\]/, 0],
  ['lint suppressions', /(eslint|oxlint)-disable/, 10],
  ['TODO / FIXME', /\b(TODO|FIXME|HACK)\b/, 0],
];

const found = Object.fromEntries(SIGNALS.map(([n]) => [n, []]));
const big = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  if (lines.length > 400) big.push(`${relative(root, f)} (${lines.length})`);
  lines.forEach((l, i) => {
    for (const [name, re, , ok = []] of SIGNALS) if (re.test(l) && !ok.some(a => f.replaceAll('\\', '/').endsWith(a))) found[name].push(`${relative(root, f)}:${i + 1}`);
  });
}

// A logic file without a test next to it is a signal too.
const names = new Set(walk(join(root, 'src')).concat(walk(join(root, 'server'))));
const untested = files.filter(f => /[\\/](utils|hooks)[\\/]/.test(f) && !names.has(f.replace(/\.tsx?$/, '.test$&')) && !names.has(f.replace(/\.tsx?$/, '.test.tsx')));

let bad = 0;
for (const [name, , limit] of SIGNALS) {
  const n = found[name].length;
  const over = n > limit;
  if (over) bad++;
  console.log(`${over ? 'FAIL' : 'ok  '} ${name}: ${n} (limit ${limit})${over && n <= 5 ? ' ' + found[name].join(', ') : ''}`);
}
console.log(`${big.length ? 'WARN' : 'ok  '} files over 400 lines: ${big.length}${big.length ? ' ' + big.join(', ') : ''}`);
console.log(`${untested.length ? 'WARN' : 'ok  '} utils/hooks without a test next to them: ${untested.length}${untested.length && untested.length <= 8 ? ' ' + untested.map(f => relative(root, f)).join(', ') : ''}`);
process.exitCode = bad ? 1 : 0;
