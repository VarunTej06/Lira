import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../../types/issue';
import type { FiltersState } from './useFiltersState';
import { byText, cleanup, click, mount, q, qa } from '../../../test/render';
import { ResultsTable } from './ResultsTable';

afterEach(cleanup);

let n = 0;
const issue = (over: Partial<Issue> = {}): Issue => ({
  id: ++n, spaceId: 1, key: `LIRA-${n}`, title: `Ticket ${n}`, description: '', type: 'task', status: 'todo', priority: 'medium',
  reporter: 'A', reporterInitials: 'A', labels: [], subtasks: [], comments: [], activity: [], attachments: [], linkedIssues: [],
  rank: n, watchers: [], createdAt: new Date(2026, 0, 5), updatedAt: new Date(2026, 10, 9), ...over,
} as Issue);

function show(filtered: Issue[], total = filtered.length) {
  const handlers = { onSelectIssue: vi.fn(), onSelectSpace: vi.fn(), clearAllFilters: vi.fn(), toggleSort: vi.fn() };
  const state = {
    issues: Array.from({ length: total }, () => issue()), filteredIssues: filtered,
    spaceMap: { 1: { id: 1, key: 'LIRA', name: 'Lira', icon: 'L', color: '#336699' } },
    ...handlers,
  } as unknown as FiltersState;
  mount(<ResultsTable {...state} />);
  return handlers;
}
const rows = () => qa('tbody tr');
const cells = (row: HTMLElement) => qa('td', row);

describe('ResultsTable', () => {
  it('counts what is shown against all work items', () => {
    show([issue(), issue()], 5);
    expect(document.body.textContent).toContain('Showing 2 of 5 work items');
  });

  describe('when nothing matches', () => {
    it('says so and offers to reset the filters', async () => {
      const h = show([], 3);
      expect(document.body.textContent).toContain('No work items matched your filters');
      expect(q('table')).toBeNull();
      await click(byText('button', 'Reset all filters'));
      expect(h.clearAllFilters).toHaveBeenCalledTimes(1);
    });
  });

  describe('rows', () => {
    it('shows key, title, space, status, priority and the update date for each ticket', () => {
      const t = issue({ key: 'LIRA-77', title: 'Fix the board', status: 'inprogress', priority: 'high', assignee: 'Ann', assigneeInitials: 'AN' });
      show([t]);
      const row = rows()[0];
      expect(row.textContent).toContain('LIRA-77');
      expect(row.textContent).toContain('Fix the board');
      expect(row.textContent).toContain('Lira');
      expect(row.textContent).toContain('Ann');
      expect(row.textContent).toContain(new Date(2026, 10, 9).toLocaleDateString());
    });

    it('opens the ticket when the row is clicked', async () => {
      const t = issue();
      const h = show([t]);
      await click(rows()[0]);
      expect(h.onSelectIssue).toHaveBeenCalledWith(t);
    });

    it('opens the space, and only the space, from the space button', async () => {
      const h = show([issue()]);
      await click(q('button[title="Open Lira board"]'));
      expect(h.onSelectSpace).toHaveBeenCalledWith(1);
      expect(h.onSelectIssue).not.toHaveBeenCalled();
    });

    it('falls back to a plain "Space" label when the space is unknown', () => {
      const t = issue({ spaceId: 99 });
      show([t]);
      expect(q('button[title="Open Space board"]')).not.toBeNull();
    });

    it('shows up to three labels and counts the rest', () => {
      show([issue({ labels: ['a', 'b', 'c', 'd', 'e'] })]);
      const text = rows()[0].textContent!;
      expect(text).toContain('#a');
      expect(text).toContain('#c');
      expect(text).not.toContain('#d');
      expect(text).toContain('+2');
    });

    it('shows no label strip for a ticket without labels', () => {
      show([issue({ labels: [] })]);
      expect(rows()[0].textContent).not.toContain('#');
    });

    it.each([
      ['done', 'emerald'], ['inprogress', 'amber'], ['todo', 'blue'], ['backlog', 'slate'],
    ])('colours the %s status %s', (status, colour) => {
      show([issue({ status })]);
      const badge = qa('span', cells(rows()[0])[4]).find(s => s.className.includes('rounded-full'))!;
      expect(badge.className).toContain(`bg-${colour}-100`);
    });

    it('adds a Blocked badge to a blocked ticket only', () => {
      show([issue({ blocked: true }), issue()]);
      expect(cells(rows()[0])[4].textContent).toContain('Blocked');
      expect(cells(rows()[1])[4].textContent).not.toContain('Blocked');
    });

    it('shows "Unassigned" when nobody is on the ticket', () => {
      show([issue()]);
      expect(cells(rows()[0])[6].textContent).toContain('Unassigned');
    });

    it('uses the first two letters of the name when there are no initials', () => {
      show([issue({ assignee: 'Bob', assigneeInitials: undefined })]);
      expect(cells(rows()[0])[6].textContent).toContain('Bo');
    });
  });

  describe('sorting', () => {
    it.each([['Key', 'key'], ['Summary', 'title'], ['Status', 'status'], ['Priority', 'priority'], ['Updated', 'updatedAt']])('the %s heading sorts by %s', async (heading, field) => {
      const h = show([issue()]);
      await click(qa('th').find(th => th.textContent?.trim() === heading));
      expect(h.toggleSort).toHaveBeenCalledWith(field);
    });

    it('Type, Space and Assignee are not sortable', async () => {
      const h = show([issue()]);
      for (const heading of ['Type', 'Space', 'Assignee']) await click(qa('th').find(th => th.textContent?.trim() === heading));
      expect(h.toggleSort).not.toHaveBeenCalled();
    });
  });
});
