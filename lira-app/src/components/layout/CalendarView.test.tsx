import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { byText, cleanup, click, mount, press, q, qa } from '../../test/render';
import { CalendarView } from './CalendarView';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 10, 10, 0, 0)); // Tuesday 10 Nov 2026
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

let n = 0;
const t = (over: Partial<Issue> = {}) => ({ id: ++n, key: `A-${n}`, title: `Ticket ${n}`, status: 'todo', priority: 'medium', type: 'task', spaceId: 1, ...over }) as unknown as Issue;
const due = (d: number, over: Partial<Issue> = {}) => t({ dueDate: new Date(2026, 10, d, 12) as never, ...over });
const space = { id: 1, key: 'AAA', name: 'Alpha', icon: 'A', color: '#336699' } as Space;

function show(issues: Issue[], sp: Space | null = space) {
  const onSelectIssue = vi.fn();
  mount(<CalendarView issues={issues} space={sp ?? undefined} onSelectIssue={onSelectIssue} />);
  return onSelectIssue;
}
const day = (key: string) => q(`[data-date="${key}"]`)!;
const chips = (key: string) => qa('[draggable="true"]', day(key));

describe('CalendarView', () => {
  describe('header', () => {
    it('shows the month, the year and the space', () => {
      show([]);
      expect(q('[data-testid="calendar-month-year"]')!.textContent).toContain('November 2026');
      expect(document.body.textContent).toContain('Alpha');
    });
    it('has no space chip without a space', () => {
      show([], null);
      expect(document.body.textContent).not.toContain('Alpha');
    });
    it('counts tickets due this month, how many are done, and those without a date', () => {
      show([due(3), due(4, { status: 'done' }), t(), due(5)]);
      expect(document.body.textContent).toContain('3 due this month · 1 done · 1 without a date');
    });
    it('moves a month back and forward and returns to today', async () => {
      show([]);
      await click(q('button[aria-label="Next month"]'));
      expect(q('[data-testid="calendar-month-year"]')!.textContent).toContain('December 2026');
      await click(q('button[aria-label="Previous month"]'));
      await click(q('button[aria-label="Previous month"]'));
      expect(q('[data-testid="calendar-month-year"]')!.textContent).toContain('October 2026');
      await click(byText('button', 'Today'));
      expect(q('[data-testid="calendar-month-year"]')!.textContent).toContain('November 2026');
    });
    it('opens the month and year chooser, jumps to a month and closes', async () => {
      show([]);
      const toggle = q('[data-testid="calendar-month-year"]')!;
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      await click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      await click(byText('button', /^Mar$/));
      expect(toggle.textContent).toContain('March 2026');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });
    it('closes the chooser with Escape and on an outside click', async () => {
      show([]);
      const toggle = q('[data-testid="calendar-month-year"]')!;
      await click(toggle);
      await press('Escape');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      await click(toggle);
      await act(async () => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('grid', () => {
    it('starts on Monday with seven weekday names', () => {
      show([]);
      expect(qa('.grid-cols-7')[0].textContent).toBe('MonTueWedThuFriSatSun');
    });
    it('has whole weeks and marks today', () => {
      show([]);
      const cells = qa('[data-date]');
      expect(cells.length % 7).toBe(0);
      expect(day('2026-11-10').className).toContain('bg-lira-blue-light/50');
      expect(day('2026-11-11').className).not.toContain('bg-lira-blue-light/50');
    });
    it('dims days of other months', () => {
      show([]);
      const other = qa('[data-date]').find(c => !c.getAttribute('data-date')!.startsWith('2026-11'))!;
      expect(other.className).toContain('bg-gray-50/70');
    });
    it('puts tickets on their due day, with the count', () => {
      show([due(10), due(10), due(11)]);
      expect(chips('2026-11-10')).toHaveLength(2);
      expect(day('2026-11-10').textContent).toContain('2');
      expect(chips('2026-11-11')).toHaveLength(1);
    });
    it('shows a chip with its type, key, title, and a done tick with a strike-through', () => {
      show([due(10, { status: 'done', key: 'AAA-7', title: 'Finish it' })]);
      const chip = chips('2026-11-10')[0];
      expect(chip.textContent).toContain('AAA-7');
      expect(chip.textContent).toContain('Finish it');
      expect(chip.className).toContain('opacity-70');
      expect(chip.querySelector('.line-through')).not.toBeNull();
      expect(chip.title).toContain('Drag to change the due date');
    });
    it('colours a chip by state: done, blocked, in progress, high priority, other', () => {
      show([due(1, { status: 'done' }), due(2, { blocked: true } as never), due(3, { status: 'inprogress' }), due(4, { priority: 'high' }), due(5)]);
      const tone = (d: string) => chips(`2026-11-${d}`)[0].className;
      expect(tone('01')).toContain('border-l-emerald-500');
      expect(tone('02')).toContain('border-l-red-600');
      expect(tone('03')).toContain('border-l-blue-500');
      expect(tone('04')).toContain('border-l-red-500');
      expect(tone('05')).toContain('border-l-slate-400');
    });
    it('opens a ticket on click', async () => {
      const a = due(10);
      const onSelect = show([a]);
      await click(chips('2026-11-10')[0]);
      expect(onSelect).toHaveBeenCalledWith(a);
    });
    it('shows three tickets a day, then "+N more" which expands and collapses', async () => {
      show([due(10), due(10), due(10), due(10), due(10)]);
      expect(chips('2026-11-10')).toHaveLength(3);
      await click(byText('button', '+2 more'));
      expect(chips('2026-11-10')).toHaveLength(5);
      await click(byText('button', 'Show less'));
      expect(chips('2026-11-10')).toHaveLength(3);
    });
    it('has no more-button for three or fewer', () => {
      show([due(10), due(10), due(10)]);
      expect(byText('button', /more|Show less/)).toBeUndefined();
    });
  });

  describe('tickets without a due date', () => {
    it('lists them, open by default, and folds', async () => {
      const a = t({ key: 'AAA-9', title: 'Floating' });
      show([a, due(3)]);
      expect(document.body.textContent).toContain('Floating');
      const toggle = byText('button', /Without a due date/)!;
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      await click(toggle);
      expect(document.body.textContent).not.toContain('Floating');
    });
    it('opens one on click', async () => {
      const a = t({ title: 'Floating' });
      const onSelect = show([a]);
      await click(qa('[draggable="true"]').find(e => e.textContent!.includes('Floating')));
      expect(onSelect).toHaveBeenCalledWith(a);
    });
    it('says when every ticket has a date', () => {
      show([due(3)]);
      expect(document.body.textContent).toContain('Every ticket has a due date.');
    });
  });
});
