import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_EVENT, applyTheme, getTheme } from './theme';

beforeEach(() => { localStorage.clear(); document.documentElement.classList.remove('dark'); });

describe('theme', () => {
  it('is dark until a theme has been saved', () => {
    expect(getTheme()).toBe('dark');
  });

  it('is applied and saved only by applyTheme', () => {
    applyTheme('light');
    expect(getTheme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    applyTheme('dark');
    expect(getTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
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
