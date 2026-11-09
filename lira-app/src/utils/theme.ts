/**
 * The light / dark theme. It is changed in several dialogs (Settings, the account menu, System settings). Each of them
 * keeps its own draft while it is open and calls `applyTheme` only when the person presses Save, so closing a dialog
 * without saving never changes the theme.
 */
export type Theme = 'light' | 'dark';

const THEME_KEY = 'lira_theme';
export const THEME_EVENT = 'lira-theme-changed';

export function getTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; // dark is the default
  } catch {
    return 'dark';
  }
}

/** Saves the theme and switches the whole app to it. */
export function applyTheme(theme: Theme): void {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable */ }
  document.documentElement.classList.toggle('dark', theme === 'dark');
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

