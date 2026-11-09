import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SavedToastHost } from './SavedToast';
import { notifySaved } from './savedToastStore';
import { MonthYearGrid } from './MonthYearGrid';
import { isOwnComment } from '../issue/commentUtils';
import { formatBytes } from '../../utils/attachments';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { act(() => root.unmount()); host.remove(); await wait(0); });

describe('saved toast', () => {
  it('shows the message with a status role, and a custom message', async () => {
    act(() => root.render(<SavedToastHost />));
    expect(document.body.querySelector('[data-testid=saved-toast]')).toBeNull();
    await act(async () => { notifySaved(); await wait(10); });
    expect(document.body.querySelector('[data-testid=saved-toast]')?.textContent).toContain('Changes saved');
    await act(async () => { notifySaved('Profile saved'); await wait(10); });
    expect([...document.body.querySelectorAll('[data-testid=saved-toast]')].map(e => e.textContent).join('|')).toContain('Profile saved');
  });
});

describe('month and year chooser', () => {
  it('calls back with the chosen year and month, and the year arrows move the year', () => {
    const picks: [number, number][] = [];
    act(() => root.render(<MonthYearGrid year={2026} month={10} onPick={(y, m) => picks.push([y, m])} />));
    const btn = (label: string) => [...host.querySelectorAll('button')].find(b => b.textContent?.trim() === label || b.getAttribute('aria-label') === label) as HTMLButtonElement;
    act(() => btn('Next year').click());
    act(() => btn('Mar').click());
    expect(picks).toEqual([[2027, 2]]);
    expect(btn('Nov').getAttribute('aria-pressed')).toBe('false'); // 2027 is shown, the selected month is in 2026
  });
});

describe('comment ownership', () => {
  it('lets people edit only their own comments', () => {
    localStorage.setItem('lira_user_initials', 'VY');
    localStorage.setItem('lira_user_name', 'Varuntej Yadla');
    const base = { id: '1', content: 'x', createdAt: new Date() };
    expect(isOwnComment({ ...base, author: 'VY', authorInitials: 'VY' })).toBe(true);
    expect(isOwnComment({ ...base, author: 'Varuntej Yadla', authorInitials: '' })).toBe(true);
    expect(isOwnComment({ ...base, author: 'Alex Morgan', authorInitials: 'AM' })).toBe(false);
    localStorage.clear();
  });
});

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(11)).toBe('11 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
