import { appStorage } from './appStorage';
/**
 * The light / dark theme, and which of the two light palettes is used. It is changed in Settings and in System settings.
 * Each dialog keeps its own draft while it is open and calls `applyTheme` only when the person presses Save, so closing a
 * dialog without saving never changes the theme. The colours themselves are in index.css and theme/palette.ts.
 */
export type Theme = 'light' | 'dark';
export type LightPalette = 'sorrel' | 'fawn';

const THEME_KEY = 'lira_theme';
const PALETTE_KEY = 'lira_light_palette';
export const THEME_EVENT = 'lira-theme-changed';

export function getTheme(): Theme {
  try {
    return appStorage.get(THEME_KEY) === 'light' ? 'light' : 'dark'; // dark is the default
  } catch {
    return 'dark';
  }
}

export function getLightPalette(): LightPalette {
  try {
    return appStorage.get(PALETTE_KEY) === 'fawn' ? 'fawn' : 'sorrel'; // Sorrel is the default
  } catch {
    return 'sorrel';
  }
}

/** Whether a choice in a settings dialog differs from what is saved. The palette only counts in light mode. */
export const isThemeChange = (theme: Theme, palette: LightPalette): boolean =>
  theme !== getTheme() || (theme === 'light' && palette !== getLightPalette());

/** Shows a theme on the page without saving it. */
export function paintTheme(theme: Theme, palette: LightPalette): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.palette = theme === 'dark' ? 'dark' : palette; // a light palette must never colour the dark theme
}

/** Saves the theme (and the light palette, when one is named) and switches the whole app to it. */
export function applyTheme(theme: Theme, palette: LightPalette = getLightPalette()): void {
  try {
    appStorage.set(THEME_KEY, theme);
    appStorage.set(PALETTE_KEY, palette);
  } catch { /* storage unavailable */ }
  paintTheme(theme, palette);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}
