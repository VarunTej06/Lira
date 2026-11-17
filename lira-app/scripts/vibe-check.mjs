// Counts the quick "vibe-coded" signals in src/ and server/. Run: node scripts/vibe-check.mjs
// Complexity is measured separately (see docs/04-quality/vibe-check.md); this covers what a text scan can see.
// Part 1 is code hygiene. Part 2 is the 30 "looks vibe-coded" design tells (docs/04-quality/vibe-check.md section 4):
// the ones a text scan can see are counted here, with the limit set to today's count so it may fall and never rise.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const isTest = f => /\.test\.tsx?$|[\\/]test[\\/]/.test(f);

function walk(dir, ext = /\.tsx?$/) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    return statSync(p).isDirectory() ? walk(p, ext) : ext.test(name) ? [p] : [];
  });
}

const files = ['src', 'server'].flatMap(d => walk(join(root, d))).filter(f => !isTest(f));
// The design tells also live in the styles and the Tailwind config, so those are read too.
const designFiles = [...walk(join(root, 'src'), /\.(tsx?|css)$/).filter(f => !isTest(f)), join(root, 'tailwind.config.js')];

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

// The design tells. The number is the tell's number in the owner's list of 30 (docs/04-quality/vibe-check.md).
// A limit of 0 means none may appear; any other limit is today's count (a ratchet: lower it when you fix some, never raise it).
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)|\{\s*\/\*/;
const TELLS = [
  [1, 'gradients', /bg-gradient-to|linear-gradient\(|radial-gradient\(/, 1],
  [2, 'stock icon set (lucide) imports', /from 'lucide-react'/, 138],
  [3, 'pure white hex', /#[fF]{3}\b|#[fF]{6}\b/, 4],
  [4, 'rainbow: stock colour-family classes', /\b(bg|text|border)-(red|green|emerald|amber|yellow|orange|teal|sky|rose|pink|cyan|blue|indigo|purple|violet|fuchsia|lime)-\d{2,3}\b/, 457],
  [5, 'drop shadows', /\bshadow-(xs|2xs|sm|md|lg|xl|2xl|card|card-hover|modal|dropdown)\b|\bshadow-\[|drop-shadow/, 183],
  [8, 'glass (backdrop blur)', /backdrop-blur/, 10],
  [9, 'em dashes in text', /—/, 57, COMMENT_LINE],
  [10, 'Inter / Geist / Space Grotesk', /@fontsource\/(inter|geist|space-grotesk)|fontFamily.*(Inter|Geist|Space Grotesk)|sans: \['Inter'/, 8],
  [11, 'coloured side stripe', /border-l-[2-9]\b|border-l-\[\d|borderLeft:\s*`?\d|border-left:\s*\d/, 3],
  [12, 'testimonials', /testimonial/i, 0],
  [13, 'bento grid', /bento/i, 0],
  [14, 'terminal window', /traffic.?light|terminal-window/i, 0],
  [15, '"not x, it\'s y" copy', /\b[Nn]ot (just )?[a-z ]+, (it'?s|but) |isn't [a-z ]+, it'?s/, 0, COMMENT_LINE],
  [19, 'very round corners (xl and above)', /\brounded-(xl|2xl|3xl)\b/, 231],
  [20, 'purple, indigo, violet', /\b(bg|text|border|ring|from|to|via)-(purple|indigo|violet)-\d{2,3}\b/, 50],
  [22, 'radial orbs and blur blobs', /radial-gradient|(?<!backdrop-)blur-(2xl|3xl)|(?<!backdrop-)blur-\[/, 0],
  [23, 'dot grids', /dot-grid|bg-dots|bg-\[radial/, 0],
  [24, 'sparkle icons', /\bSparkles?\b/, 14, COMMENT_LINE],
  [25, 'arrows that move on hover', /group-hover:translate-x|animate-[a-z-]*arrow/, 3],
  [28, 'hover scale and slide', /hover:(scale|-?translate)|group-hover:(scale|-?translate)|hover:-translate/, 22],
  [29, 'neon and glow', /pulse-glow|\bneon\b|shadow-\[0_0_|text-(cyan|lime|fuchsia)-[2-4]00/, 5],
  [30, 'pastel tints (-50 and -100 shades)', /\b(bg)-(red|green|emerald|amber|yellow|orange|teal|sky|rose|cyan|blue|indigo|purple|violet)-(50|100)\b/, 176],
];
// Tells a text scan cannot see: 3 (white page), 6, 7 (src/hygiene.test.ts), 16, 17, 18, 21, 26, 27. See the document.

const found = Object.fromEntries(SIGNALS.map(([n]) => [n, []]));
const foundTells = Object.fromEntries(TELLS.map(([, n]) => [n, []]));
const big = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  if (lines.length > 400) big.push(`${relative(root, f)} (${lines.length})`);
  lines.forEach((l, i) => {
    for (const [name, re, , ok = []] of SIGNALS) if (re.test(l) && !ok.some(a => f.replaceAll('\\', '/').endsWith(a))) found[name].push(`${relative(root, f)}:${i + 1}`);
  });
}
for (const f of designFiles) {
  readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => {
    for (const [, name, re, , skip] of TELLS) if (re.test(l) && !(skip && skip.test(l))) foundTells[name].push(`${relative(root, f)}:${i + 1}`);
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
console.log('--- design tells (number = position in the list of 30)');
for (const [no, name, , limit] of TELLS) {
  const n = foundTells[name].length;
  const over = n > limit;
  if (over) bad++;
  console.log(`${over ? 'FAIL' : 'ok  '} #${no} ${name}: ${n} (limit ${limit})${over && n <= 5 ? ' ' + foundTells[name].join(', ') : ''}`);
}
console.log('---');
console.log(`${big.length ? 'WARN' : 'ok  '} files over 400 lines: ${big.length}${big.length ? ' ' + big.join(', ') : ''}`);
console.log(`${untested.length ? 'WARN' : 'ok  '} utils/hooks without a test next to them: ${untested.length}${untested.length && untested.length <= 8 ? ' ' + untested.map(f => relative(root, f)).join(', ') : ''}`);
process.exitCode = bad ? 1 : 0;
