import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { THEME_EVENT, applyTheme, getLightPalette, getTheme, isThemeChange, paintTheme } from './theme';
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

describe('light palette', () => {
  it('is Sorrel until one has been saved, so a workspace saved as "light" before palettes existed opens in Sorrel', () => {
    localStorage.setItem('lira_theme', 'light');
    expect(getLightPalette()).toBe('sorrel');
  });

  it('is saved with the theme and shown on the page', () => {
    applyTheme('light', 'fawn');
    expect(getLightPalette()).toBe('fawn');
    expect(localStorage.getItem('lira_light_palette')).toBe('fawn');
    expect(root.dataset.palette).toBe('fawn');
  });

  it('is kept when the theme is saved without naming one', () => {
    applyTheme('light', 'fawn');
    applyTheme('dark');
    applyTheme('light');
    expect(root.dataset.palette).toBe('fawn');
  });

  it('never colours the dark theme: the page is marked dark, the saved light palette waits', () => {
    applyTheme('light', 'fawn');
    applyTheme('dark');
    expect(root.dataset.palette).toBe('dark');
    expect(getLightPalette()).toBe('fawn');
  });

  it('falls back to Sorrel when the saved value is not a palette', () => {
    localStorage.setItem('lira_light_palette', '<script>');
    expect(getLightPalette()).toBe('sorrel');
  });

  it('counts as a change to save only when the theme differs, or the palette differs in light mode', () => {
    expect(isThemeChange('dark', 'sorrel')).toBe(false);
    expect(isThemeChange('dark', 'fawn')).toBe(false); // the palette is not used in dark mode
    expect(isThemeChange('light', 'sorrel')).toBe(true);
    applyTheme('light', 'sorrel');
    expect(isThemeChange('light', 'sorrel')).toBe(false);
    expect(isThemeChange('light', 'fawn')).toBe(true);
  });

  it('can be shown without being saved (startup)', () => {
    paintTheme('light', 'fawn');
    expect(root.dataset.palette).toBe('fawn');
    expect(localStorage.getItem('lira_light_palette')).toBeNull();
    expect(localStorage.getItem('lira_theme')).toBeNull();
  });
});

describe('the three themes', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  /** The variables of one theme, as written in index.css. */
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    expect(start, `${selector} is missing in index.css`).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf('}', start));
  };
  const SELECTOR: Record<ThemeName, string> = { sorrel: ':root', fawn: "[data-palette='fawn']", dark: '.dark' };
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

  it('are three colours each, written as plain hex', () => {
    expect(names.sort()).toEqual(['dark', 'fawn', 'sorrel']);
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

  it('use the yellow, tomato red and baby blue of the palette for buttons', () => {
    expect(value('dark', 'lira-blue').join(' ')).toBe(triplet('#FFC93C'));
    expect(value('sorrel', 'lira-blue').join(' ')).toBe(triplet('#E8412C'));
    expect(value('fawn', 'lira-blue').join(' ')).toBe(triplet('#8EC5FF'));
  });

  it('define every colour variable in every theme', () => {
    const defined = (n: ThemeName) => [...block(SELECTOR[n]).matchAll(/--([a-z0-9-]+):/g)].map(m => m[1]).sort();
    expect(defined('fawn')).toEqual(defined('sorrel'));
    expect(defined('dark')).toEqual(defined('sorrel'));
  });

  it.each(names)('%s: text, muted text and links read at 4.5 or better on every surface', n => {
    for (const surface of ['lira-bg', 'lira-surface', 'surface-2', 'lira-blue-light']) {
      for (const text of ['lira-text', 'lira-muted', 'lira-blue-text']) {
        expect(contrast(value(n, text), value(n, surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(names)('%s: button labels and the navigation read on their backgrounds', n => {
    // 3 is the WCAG minimum for bold labels and controls; white on the owner's tomato red is 4.0
    expect(contrast(value(n, 'lira-on-blue'), value(n, 'lira-blue'))).toBeGreaterThanOrEqual(n === 'sorrel' ? 3 : 4.5);
    expect(contrast(value(n, 'lira-on-blue'), value(n, 'lira-blue-hover'))).toBeGreaterThanOrEqual(3);
    expect(contrast([255, 255, 255], value(n, 'lira-nav'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(value(n, 'lira-nav-accent'), value(n, 'lira-nav'))).toBeGreaterThanOrEqual(4.5);
  });
});
