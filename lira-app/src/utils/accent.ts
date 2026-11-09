/**
 * Accent branding. The accent replaces Lira's blue (the --lira-blue colour variables behind every `lira-blue` utility:
 * primary buttons, active tabs, focus rings, links, the sidebar highlight). Light and dark themes get matching shades.
 * The chosen colour is saved as `lira_accent`, so it is written to data/settings.json like the other preferences.
 */

interface AccentColor { name: string; hex: string }

const ACCENT_KEY = 'lira_accent';
export const DEFAULT_ACCENT = '#0052CC';

export const ACCENTS: AccentColor[] = [
  { name: 'Classic Blue', hex: '#0052CC' },
  { name: 'Ocean', hex: '#0C66E4' },
  { name: 'Indigo', hex: '#4F46E5' },
  { name: 'Royal Purple', hex: '#6554C0' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Magenta', hex: '#C026D3' },
  { name: 'Rose', hex: '#DB2777' },
  { name: 'Crimson', hex: '#DE350B' },
  { name: 'Orange', hex: '#E2740B' },
  { name: 'Amber', hex: '#B45309' },
  { name: 'Lime', hex: '#4D7C0F' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Teal', hex: '#0D9488' },
  { name: 'Cyan', hex: '#0891B2' },
  { name: 'Slate', hex: '#475569' },
  { name: 'Graphite', hex: '#1F2937' },
];

type RGB = [number, number, number];

export function parseHex(hex: string): RGB | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const triplet = (c: RGB) => c.join(' ');

const WHITE: RGB = [255, 255, 255];
const DARK_BG: RGB = [13, 17, 23];

/** WCAG contrast ratio between two colours (1 to 21; 4.5 is the usual minimum for small text). */
export function contrast(a: RGB, b: RGB): number {
  const lum = (c: RGB) => {
    const [r, g, bl] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Darkens a colour, only as much as needed, until it reads at 4.5 or better on the background it sits on. A colour that already does is returned as it is. */
function readableOn(color: RGB, background: RGB): RGB {
  let c = color;
  for (let t = 0; t <= 0.6 && contrast(c, background) < 4.5; t += 0.04) c = mix(color, [0, 0, 0], t);
  return c;
}

/**
 * In dark mode the accent is lightened so it shows up on the dark page, but a lighter accent makes the white text on a
 * button harder to read. Pick the shade that is readable both ways as far as the colour allows (never darker than a little lift).
 */
function darkShade(base: RGB): RGB {
  let best = mix(base, WHITE, 0.08);
  let bestScore = 0;
  for (let t = 0.08; t <= 0.28; t += 0.04) {
    const c = mix(base, WHITE, t);
    const score = Math.min(contrast(WHITE, c), contrast(c, DARK_BG));
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best;
}

/** The three variables for a theme: the accent, its hover shade, and a soft tint for backgrounds. */
export function accentVars(hex: string, dark: boolean): { blue: string; hover: string; light: string } | undefined {
  const base = parseHex(hex);
  if (!base) return undefined;
  if (!dark) {
    const tint = mix(base, WHITE, 0.95);
    const blue = readableOn(base, tint);
    return { blue: triplet(blue), hover: triplet(mix(blue, WHITE, 0.2)), light: triplet(tint) };
  }
  const blue = darkShade(base);
  return { blue: triplet(blue), hover: triplet(mix(blue, WHITE, 0.18)), light: triplet(mix(base, DARK_BG, 0.78)) };
}

const normalize = (hex: string) => (hex.startsWith('#') ? hex : `#${hex}`).toUpperCase();
export const isDefaultAccent = (hex?: string | null) => !hex || normalize(hex) === DEFAULT_ACCENT;

/** CSS that overrides the colour variables for both themes (empty for the default blue, so it looks exactly as before). */
export function accentCss(hex: string | null | undefined): string {
  if (!hex || isDefaultAccent(hex)) return '';
  const light = accentVars(hex, false);
  const dark = accentVars(hex, true);
  if (!light || !dark) return '';
  const block = (v: NonNullable<typeof light>) => `--lira-blue:${v.blue};--lira-blue-hover:${v.hover};--lira-blue-light:${v.light};`;
  return `:root{${block(light)}}\n.dark{${block(dark)}}`;
}

/** Applies the accent to the page right now. */
export function applyAccent(hex: string | null | undefined): void {
  let el = document.getElementById('lira-accent') as HTMLStyleElement | null;
  const css = accentCss(hex);
  if (!css) { el?.remove(); return; }
  if (!el) { el = document.createElement('style'); el.id = 'lira-accent'; document.head.appendChild(el); }
  el.textContent = css;
}

export function loadAccent(): string {
  try { return localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT; } catch { return DEFAULT_ACCENT; }
}

export function saveAccent(hex: string): void {
  try { localStorage.setItem(ACCENT_KEY, normalize(hex)); } catch { /* storage unavailable */ }
  applyAccent(hex);
}
