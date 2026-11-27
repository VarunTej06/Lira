import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PALETTES, THEME_EVENT, palettesFor, applyTheme, getPalette, getTheme, isThemeChange, paintTheme } from './theme';
import { THEMES, type ThemeName } from '../theme/palette';

const root = document.documentElement;

beforeEach(() => { localStorage.clear(); root.classList.remove('dark'); delete root.dataset.palette; });

describe('theme', () => {
  it('is dark until a theme has been saved', () => {
    expect(getTheme()).toBe('dark');
  });

  it('is applied and saved only by applyTheme', () => {
    applyTheme('light');
    expect(getTheme()).toBe('light');
    expect(root.classList.contains('dark')).toBe(false);
    applyTheme('dark');
    expect(getTheme()).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('tells the rest of the app when it changes', () => {
    const seen: string[] = [];
    const on = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(THEME_EVENT, on);
    applyTheme('light');
    window.removeEventListener(THEME_EVENT, on);
    expect(seen).toEqual(['light']);
  });
});

describe('palettes', () => {
  it('offers two for dark mode and four for light mode, and every theme belongs to exactly one mode', () => {
    expect(PALETTES.dark).toEqual(['pace', 'blackridge']);
    expect(PALETTES.light).toEqual(['sorrel', 'fawn', 'mossgrove', 'tidewell']);
    expect([...PALETTES.dark, ...PALETTES.light].sort()).toEqual(Object.keys(THEMES).sort());
  });

  it('starts on the first of each mode: Pace for dark, Sorrel for light (also for a workspace saved before palettes existed)', () => {
    localStorage.setItem('lira_theme', 'light');
    expect(getPalette('dark')).toBe('pace');
    expect(getPalette('light')).toBe('sorrel');
  });

  it('is saved with the theme, for that mode only, and shown on the page', () => {
    applyTheme('light', 'mossgrove');
    expect(getPalette('light')).toBe('mossgrove');
    expect(localStorage.getItem('lira_light_palette')).toBe('mossgrove');
    expect(localStorage.getItem('lira_dark_palette')).toBeNull();
    expect(root.dataset.palette).toBe('mossgrove');
    applyTheme('dark', 'blackridge');
    expect(getPalette('dark')).toBe('blackridge');
    expect(root.dataset.palette).toBe('blackridge');
    expect(getPalette('light')).toBe('mossgrove'); // the light choice waits for the next time Light is used
  });

  it('is kept when the theme is saved without naming one', () => {
    applyTheme('light', 'fawn');
    applyTheme('dark', 'blackridge');
    applyTheme('light');
    expect(root.dataset.palette).toBe('fawn');
    applyTheme('dark');
    expect(root.dataset.palette).toBe('blackridge');
  });

  it('never puts a light palette on the dark theme or a dark one on the light theme', () => {
    applyTheme('dark', 'fawn' as never);
    expect(root.dataset.palette).toBe('pace');
    expect(localStorage.getItem('lira_dark_palette')).toBe('pace');
    applyTheme('light', 'blackridge' as never);
    expect(root.dataset.palette).toBe('sorrel');
  });

  it('falls back to the first palette when the saved value is not one', () => {
    localStorage.setItem('lira_light_palette', '<script>');
    localStorage.setItem('lira_dark_palette', 'fawn'); // a light palette saved under dark
    expect(getPalette('light')).toBe('sorrel');
    expect(getPalette('dark')).toBe('pace');
  });

  it('counts as a change to save when the theme differs, or the palette of the chosen theme differs', () => {
    expect(isThemeChange('dark', 'pace')).toBe(false);
    expect(isThemeChange('dark', 'blackridge')).toBe(true);
    expect(isThemeChange('light', 'sorrel')).toBe(true);
    applyTheme('light', 'sorrel');
    expect(isThemeChange('light', 'sorrel')).toBe(false);
    expect(isThemeChange('light', 'tidewell')).toBe(true);
  });

  it('can be shown without being saved (startup), from what is saved when nothing is named', () => {
    paintTheme('light', 'fawn');
    expect(root.dataset.palette).toBe('fawn');
    expect(localStorage.getItem('lira_light_palette')).toBeNull();
    expect(localStorage.getItem('lira_theme')).toBeNull();
    localStorage.setItem('lira_theme', 'light');
    localStorage.setItem('lira_light_palette', 'tidewell');
    paintTheme();
    expect(root.dataset.palette).toBe('tidewell');
    expect(root.classList.contains('dark')).toBe(false);
  });
});

describe('the six themes', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  /** The variables of one theme, as written in index.css. */
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    expect(start, `${selector} is missing in index.css`).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf('}', start));
  };
  const SELECTOR: Record<ThemeName, string> = {
    sorrel: ':root', fawn: "[data-palette='fawn']", mossgrove: "[data-palette='mossgrove']", tidewell: "[data-palette='tidewell']",
    pace: '.dark', blackridge: ".dark[data-palette='blackridge']",
  };
  const triplet = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(' ');
  const value = (theme: ThemeName, name: string) => {
    const m = new RegExp(`--${name}: (\\d+ \\d+ \\d+);`).exec(block(SELECTOR[theme]));
    expect(m, `--${name} is missing for ${theme}`).not.toBeNull();
    return m![1].split(' ').map(Number);
  };
  const luminance = (c: number[]) => {
    const [r, g, b] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const names = Object.keys(THEMES) as ThemeName[];

  it('are three colours each, written as plain hex, with a name of their own', () => {
    expect(names).toHaveLength(6);
    expect(new Set(names.map(n => THEMES[n].label)).size).toBe(6);
    for (const n of names) {
      expect(THEMES[n].swatches).toHaveLength(3);
      for (const s of THEMES[n].swatches) expect(s.hex, `${n} ${s.name}`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('use exactly the colours of the palette in the stylesheet', () => {
    for (const n of names) for (const s of THEMES[n].swatches) {
      expect(block(SELECTOR[n]), `${n}: ${s.name} ${s.hex} is not used in index.css`).toContain(` ${triplet(s.hex)};`);
    }
  });

  it('use the accent of each palette for buttons', () => {
    const accent: Record<ThemeName, string> = { pace: '#FFC93C', blackridge: '#C8102E', sorrel: '#E8412C', fawn: '#8EC5FF', mossgrove: '#F28C28', tidewell: '#FF5A4E' };
    for (const n of names) expect(value(n, 'lira-blue').join(' '), n).toBe(triplet(accent[n]));
  });

  it('define every colour variable in every theme', () => {
    const defined = (n: ThemeName) => [...block(SELECTOR[n]).matchAll(/--([a-z0-9-]+):/g)].map(m => m[1]).sort();
    for (const n of names) expect(defined(n), n).toEqual(defined('sorrel'));
  });

  it('dark palettes are marked dark and light palettes light, so form controls and scroll bars follow', () => {
    for (const n of PALETTES.dark) expect(block(SELECTOR[n]), n).toContain('color-scheme: dark');
    for (const n of PALETTES.light) expect(block(SELECTOR[n]), n).toContain('color-scheme: light');
  });

  it.each(names)('%s: text, muted text and links read at 4.5 or better on every surface', n => {
    for (const surface of ['lira-bg', 'lira-surface', 'surface-2', 'lira-blue-light']) {
      for (const text of ['lira-text', 'lira-muted', 'lira-blue-text']) {
        expect(contrast(value(n, text), value(n, surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(names)('%s: button labels and the navigation read on their backgrounds', n => {
    // 3 is the WCAG minimum for bold labels and controls; white on the owner's tomato red (Sorrel) is 4.0
    expect(contrast(value(n, 'lira-on-blue'), value(n, 'lira-blue'))).toBeGreaterThanOrEqual(n === 'sorrel' ? 3 : 4.5);
    expect(contrast(value(n, 'lira-on-blue'), value(n, 'lira-blue-hover'))).toBeGreaterThanOrEqual(3);
    expect(contrast([255, 255, 255], value(n, 'lira-nav'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(value(n, 'lira-nav-accent'), value(n, 'lira-nav'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the palettes of each edition', () => {
  it('has Pace for dark and Mossgrove for light and nothing else in the hosted edition', () => {
    expect(palettesFor('hosted')).toEqual({ dark: ['pace'], light: ['mossgrove'] });
  });
  it('keeps all six palettes in the local edition', () => {
    expect(palettesFor('local')).toEqual({ dark: ['pace', 'blackridge'], light: ['sorrel', 'fawn', 'mossgrove', 'tidewell'] });
  });
});
