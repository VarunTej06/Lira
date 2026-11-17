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
  [1, 'gradients', /bg-gradient-to|linear-gradient\(|radial-gradient\(/, 0],
  [2, 'stock icon set (lucide) imports', /from 'lucide-react'/, 138],
  [3, 'pure white hex', /#[fF]{3}\b|#[fF]{6}\b/, 4, /white: '#ffffff'/],
  [5, 'drop shadows', /\bshadow-(xs|2xs|sm|md|lg|xl|2xl|card|card-hover|modal|dropdown)\b|\bshadow-\[|drop-shadow/, 0],
  [8, 'glass (backdrop blur)', /backdrop-blur/, 0],
  [9, 'em dashes in text', /—/, 0, COMMENT_LINE],
  [10, 'Inter / Geist / Space Grotesk', /@fontsource\/(inter|geist|space-grotesk)|fontFamily.*(Inter|Geist|Space Grotesk)|sans: \['Inter'/, 0],
  [11, 'coloured side stripe', /border-l-[2-9]\b|border-l-\[\d|borderLeft:\s*`?\d|border-left:\s*\d/, 0, /blockquote/],
  [12, 'testimonials', /testimonial/i, 0],
  [13, 'bento grid', /bento/i, 0],
  [14, 'terminal window', /traffic.?light|terminal-window/i, 0],
  [15, '"not x, it\'s y" copy', /\b[Nn]ot (just )?[a-z ]+, (it'?s|but) |isn't [a-z ]+, it'?s/, 0, COMMENT_LINE],
  [19, 'arbitrary corner radius over 12px', /rounded-\[(1[3-9]|[2-9]\d|\d{3,})px\]/, 0],
  [20, 'purple, indigo, violet', /\b(bg|text|border|ring|from|to|via)-(purple|indigo|violet)-\d{2,3}\b/, 0],
  [22, 'radial orbs and blur blobs', /radial-gradient|(?<!backdrop-)blur-(2xl|3xl)|(?<!backdrop-)blur-\[/, 0],
  [23, 'dot grids', /dot-grid|bg-dots|bg-\[radial/, 0],
  [24, 'sparkle icons', /\bSparkles?\b/, 0, COMMENT_LINE],
  [25, 'arrows that move on hover', /group-hover:translate-x|animate-[a-z-]*arrow/, 0],
  [28, 'hover scale and slide', /hover:(scale|-?translate)|group-hover:(scale|-?translate)|hover:-translate/, 0],
  [29, 'neon and glow', /pulse-glow|\bneon\b|shadow-\[0_0_|text-(cyan|lime|fuchsia)-[2-4]00/, 0],
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
// Tells #4 (rainbow) and #30 (basic pastels): Tailwind's own palette must not be used. The colour names stay, but they resolve
// to the four status scales of src/theme/colorScales.json (contrast tested in src/theme/colorScales.test.ts).
const tailwindConfig = readFileSync(join(root, 'tailwind.config.js'), 'utf8');
const stockPalette = /tailwindcss\/colors/.test(tailwindConfig) || /extend:\s*\{\s*colors/.test(tailwindConfig);
if (stockPalette) bad++;
console.log(`${stockPalette ? 'FAIL' : 'ok  '} #4 and #30 Tailwind's stock colour palette is replaced by the four status scales: ${stockPalette ? 'no' : 'yes'}`);

// Tell #19 is measured from the corner radius scale of the Tailwind config: no step may be larger than 12px.
const MAX_RADIUS_PX = 12;
const radiusBlock = /borderRadius:\s*\{([^}]*)\}/.exec(readFileSync(join(root, 'tailwind.config.js'), 'utf8'))?.[1] ?? '';
const radii = [...radiusBlock.matchAll(/([\d.]+)rem/g)].map(m => Number(m[1]) * 16);
const biggest = Math.max(0, ...radii);
const radiusBad = biggest > MAX_RADIUS_PX || radii.length === 0;
if (radiusBad) bad++;
console.log(`${radiusBad ? 'FAIL' : 'ok  '} #19 largest step of the corner radius scale: ${biggest}px (limit ${MAX_RADIUS_PX})`);
console.log('---');
console.log(`${big.length ? 'WARN' : 'ok  '} files over 400 lines: ${big.length}${big.length ? ' ' + big.join(', ') : ''}`);
console.log(`${untested.length ? 'WARN' : 'ok  '} utils/hooks without a test next to them: ${untested.length}${untested.length && untested.length <= 8 ? ' ' + untested.map(f => relative(root, f)).join(', ') : ''}`);
process.exitCode = bad ? 1 : 0;
