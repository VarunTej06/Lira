import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeIssue } from '../test/factories';
import { appStorage } from './appStorage';
import { allSprintKeys, sprintKey } from './sprintUtils';
import { applyTheme, getTheme, paintTheme } from './theme';

vi.mock('./edition', () => ({ isHosted: () => true }));
afterEach(() => { localStorage.clear(); document.documentElement.className = ''; delete document.documentElement.dataset.palette; });

describe('the hosted edition starts light', () => {
  it('shows the light theme until the person chooses dark, and then keeps their choice', () => {
    expect(getTheme()).toBe('light');
    paintTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    applyTheme('dark');
    expect(getTheme()).toBe('dark');
    expect(appStorage.get('lira_theme')).toBe('dark');
    applyTheme('light');
    expect(getTheme()).toBe('light');
  });

  it('ignores a saved value that is not a theme', () => {
    appStorage.set('lira_theme', 'purple');
    expect(getTheme()).toBe('light');
  });
});

describe('a new hosted account has no sprints', () => {
  it('lists none when there is nothing, and only the months that have tickets or were made', () => {
    expect(allSprintKeys([])).toEqual([]);
    const thisMonth = sprintKey(new Date());
    expect(allSprintKeys([makeIssue({ sprint: thisMonth })])).toEqual([thisMonth]);
    expect(allSprintKeys([], ['2027-02'])).toEqual(['2027-02']);
  });
});
