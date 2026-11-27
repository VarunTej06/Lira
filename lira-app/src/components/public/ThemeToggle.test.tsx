import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, click, mount, q } from '../../test/render';
import { applyTheme, getTheme } from '../../utils/theme';
import { ThemeToggle } from './ThemeToggle';

beforeEach(() => { localStorage.clear(); applyTheme('light'); });
afterEach(() => { cleanup(); localStorage.clear(); });

describe('ThemeToggle', () => {
  it('offers dark in light mode, switches the whole app and then offers light', async () => {
    mount(<ThemeToggle />);
    const button = () => q<HTMLButtonElement>('button')!;
    expect(button().getAttribute('aria-label')).toBe('Switch to dark mode');
    await click(button());
    expect(getTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(button().getAttribute('aria-label')).toBe('Switch to light mode');
    await click(button());
    expect(getTheme()).toBe('light');
  });

  it('wears the top bar\'s look when it sits on the bar, and the page look otherwise', () => {
    mount(<><ThemeToggle onBar /><ThemeToggle /></>);
    const [bar, page] = Array.from(document.querySelectorAll('button'));
    expect(bar.className).toContain('bg-lira-nav');
    expect(page.className).toContain('bg-gray-100');
  });
});
