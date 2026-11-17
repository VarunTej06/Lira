import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import scales from './colorScales.json';

/** The surfaces the status colours are drawn on: the pages and cards of the six palettes. */
const LIGHT_SURFACES = ['#FFFFFF', '#F7F5EF', '#F2E8DA', '#F4F1EA', '#F6F9F7', '#FAF4EB'];
const DARK_SURFACES = ['#0A0A0A', '#141415', '#0B0B0C', '#151517', '#1C1C1E'];

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const ROLES = Object.keys(scales) as (keyof typeof scales)[];
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;

describe('the status colour scales', () => {
  it('are four, each with all eleven shades as plain hex', () => {
    expect(ROLES).toEqual(['danger', 'success', 'warning', 'info']);
    for (const role of ROLES) {
      expect(Object.keys(scales[role]).sort((a, b) => Number(a) - Number(b))).toEqual([...SHADES]);
      for (const shade of SHADES) expect(scales[role][shade], `${role} ${shade}`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it.each(ROLES)('%s: goes from light to dark, each shade darker than the one before', role => {
    const l = SHADES.map(s => luminance(scales[role][s]));
    for (let i = 1; i < l.length; i++) expect(l[i], `${role} ${SHADES[i]}`).toBeLessThan(l[i - 1]);
  });

  it.each(ROLES)('%s: text in shades 500 to 900 reads at 4.5 or better on every light page and card', role => {
    for (const shade of ['500', '600', '700', '800', '900'] as const) {
      for (const surface of LIGHT_SURFACES) expect(contrast(scales[role][shade], surface), `${role} ${shade} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(ROLES)('%s: a white label on shade 600 or darker reads at 4.5 or better', role => {
    for (const shade of ['600', '700', '800', '900'] as const) expect(contrast('#FFFFFF', scales[role][shade]), `${role} ${shade}`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(ROLES)('%s: the light shades used as text in dark mode (200 to 400) read at 4.5 or better on every dark page', role => {
    for (const shade of ['200', '300', '400'] as const) {
      for (const surface of DARK_SURFACES) expect(contrast(scales[role][shade], surface), `${role} ${shade} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(ROLES)('%s: the lightest tints are quiet: close to the page, not a bright fill', role => {
    for (const shade of ['50', '100'] as const) expect(contrast(scales[role][shade], '#FFFFFF'), `${role} ${shade}`).toBeLessThan(1.4);
  });
});

describe('the Tailwind config', () => {
  const config = fs.readFileSync(path.join(process.cwd(), 'tailwind.config.js'), 'utf-8');

  it('does not use Tailwind\'s own colour palette (the stock rainbow)', () => {
    expect(config).not.toMatch(/tailwindcss\/colors/);
    expect(config).not.toMatch(/theme:\s*\{\s*extend:\s*\{\s*colors/); // colours replace the stock palette, they do not add to it
  });

  it('turns every colour name used in the source into one of the four scales, or the palette accent', () => {
    for (const [role, names] of Object.entries({ danger: ['red', 'rose', 'pink'], success: ['green', 'emerald', 'lime'], warning: ['amber', 'yellow', 'orange'], info: ['blue', 'sky', 'cyan', 'teal'] })) {
      for (const name of names) expect(config, `${name} -> ${role}`).toContain(`'${name}'`);
      expect(config).toContain(`${role}: [`);
    }
  });

  it('has no purple, indigo, violet or fuchsia: those are the accent of the palette in use', () => {
    expect(config).not.toMatch(/'(purple|indigo|violet|fuchsia)'|\b(purple|indigo|violet|fuchsia):/);
  });
});
