import { appStorage } from './appStorage';
import type { ThemeName } from '../theme/palette';
/**
 * The light / dark theme, and which palette each of them uses. It is changed in Settings and in System settings.
 * Each dialog keeps its own draft while it is open and calls `applyTheme` only when the person presses Save, so closing a
 * dialog without saving never changes the theme. The colours themselves are in index.css and theme/palette.ts.
 */
export type Theme = 'light' | 'dark';

/** The palettes of each theme. The first of each is the one used until the person chooses another. */
export const PALETTES = {
  dark: ['pace', 'blackridge'],
  light: ['sorrel', 'fawn', 'mossgrove', 'tidewell'],
} as const satisfies Record<Theme, readonly ThemeName[]>;

const THEME_KEY = 'lira_theme';
const PALETTE_KEY: Record<Theme, string> = { light: 'lira_light_palette', dark: 'lira_dark_palette' };
export const THEME_EVENT = 'lira-theme-changed';

const belongs = (theme: Theme, palette: unknown): palette is ThemeName => (PALETTES[theme] as readonly unknown[]).includes(palette);

export function getTheme(): Theme {
  try {
    return appStorage.get(THEME_KEY) === 'light' ? 'light' : 'dark'; // dark is the default
  } catch {
    return 'dark';
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
