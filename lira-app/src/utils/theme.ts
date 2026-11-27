import { appStorage } from './appStorage';
import { EDITION, isHosted, type Edition } from './edition';
import type { ThemeName } from '../theme/palette';
/**
 * The light / dark theme, and which palette each of them uses. It is changed in Settings and in System settings.
 * Each dialog keeps its own draft while it is open and calls `applyTheme` only when the person presses Save, so closing a
 * dialog without saving never changes the theme. The colours themselves are in index.css and theme/palette.ts.
 */
export type Theme = 'light' | 'dark';

/**
 * The palettes of each theme. The first of each is the one used until the person chooses another. The hosted edition has exactly one
 * per theme (Pace in dark, Mossgrove in light) and no choice; the local edition keeps all six.
 */
export const palettesFor = (edition: Edition): Record<Theme, readonly ThemeName[]> =>
  edition === 'hosted' ? { dark: ['pace'], light: ['mossgrove'] } : { dark: ['pace', 'blackridge'], light: ['sorrel', 'fawn', 'mossgrove', 'tidewell'] };

export const PALETTES = palettesFor(EDITION);

const THEME_KEY = 'lira_theme';
const PALETTE_KEY: Record<Theme, string> = { light: 'lira_light_palette', dark: 'lira_dark_palette' };
export const THEME_EVENT = 'lira-theme-changed';

const belongs = (theme: Theme, palette: unknown): palette is ThemeName => (PALETTES[theme] as readonly unknown[]).includes(palette);

/** Light until the person chooses dark in the hosted edition, on the public pages and in the app alike. The local edition keeps its own default. */
const DEFAULT_THEME: Theme = isHosted() ? 'light' : 'dark';

export function getTheme(): Theme {
  try {
    const saved = appStorage.get(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** The palette saved for a theme, or its first one when nothing (or nothing valid) is saved. */
export function getPalette(theme: Theme): ThemeName {
  try {
    const saved = appStorage.get(PALETTE_KEY[theme]);
    return belongs(theme, saved) ? saved : PALETTES[theme][0];
  } catch {
    return PALETTES[theme][0];
  }
}

/** Whether a choice in a settings dialog differs from what is saved. */
export const isThemeChange = (theme: Theme, palette: ThemeName): boolean => theme !== getTheme() || palette !== getPalette(theme);

/** Shows a theme on the page without saving it. With nothing named, shows what is saved. */
export function paintTheme(theme: Theme = getTheme(), palette: ThemeName = getPalette(theme)): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.palette = palette;
}

/** Saves the theme and its palette (the saved one when none is named) and switches the whole app to it. */
export function applyTheme(theme: Theme, palette: ThemeName = getPalette(theme)): void {
  const chosen = belongs(theme, palette) ? palette : getPalette(theme); // a light palette is never put on the dark theme
  try {
    appStorage.set(THEME_KEY, theme);
    appStorage.set(PALETTE_KEY[theme], chosen);
  } catch { /* storage unavailable */ }
  paintTheme(theme, chosen);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}
