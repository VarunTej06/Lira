import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { byText, choose, cleanup, click, mount, q, qa, typeInto } from '../../test/render';
import { ListView } from './ListView';

afterEach(cleanup);

let n = 0;
const t = (over: Partial<Issue> = {}) => ({ id: ++n, key: `AAA-${String(n).padStart(2, '0')}`, title: `Ticket ${n}`, type: 'task', status: 'todo', priority: 'medium', labels: [], assignee: '', ...over }) as unknown as Issue;
const space = { id: 1, name: 'Alpha' } as Space;

function show(issues: Issue[], over: Record<string, unknown> = {}) {
  const onSelectIssue = vi.fn();
  mount(<ListView issues={issues} space={space} onSelectIssue={onSelectIssue} {...over} />);
  return onSelectIssue;
}
const rows = () => qa('tbody tr');
const keys = () => rows().map(r => r.querySelector('td:nth-child(2)')!.textContent);
const heading = (label: string) => byText('th', new RegExp(`^${label}`))!;
const many = (count: number) => Array.from({ length: count }, () => t());

describe('ListView', () => {
  describe('rows', () => {
    it('has seven sortable columns', () => {
      show([]);
      expect(qa('thead th').map(h => h.textContent)).toEqual(['Type', 'Key', 'Title', 'Status', 'Priority', 'Assignee', 'Due Date']);
    });
    it('shows key, title, status, priority and a fallback assignee and due date', () => {
      show([t({ key: 'AAA-1', title: 'Fix login', status: 'inprogress', priority: 'high' })]);
      const row = rows()[0].textContent!;
      expect(row).toContain('AAA-1');
      expect(row).toContain('Fix login');
      expect(row).toContain('In Progress');
      expect(row).toContain('Unassigned');
      expect(row).toContain('None');
    });
    it('shows the assignee, with initials from the name, and the due date', () => {
      show([t({ assignee: 'Bob', dueDate: new Date(2026, 10, 20) as never })]);
      expect(rows()[0].textContent).toContain('Bob');
      expect(rows()[0].textContent).toContain('BO');
      expect(rows()[0].textContent).toContain('2026');
    });
    it('shows up to three labels and a +N for the rest', () => {
      show([t({ labels: ['a', 'b', 'c', 'd', 'e'] })]);
      expect(rows()[0].textContent).toContain('#a#b#c');
      expect(rows()[0].textContent).toContain('+2');
      expect(rows()[0].textContent).not.toContain('#d');
    });
    it('marks blocked tickets and colours the status badge', () => {
      show([t({ blocked: true, status: 'done' } as never), t({ status: 'blocked' })]);
      expect(rows()[0].textContent).toContain('Blocked');
      expect(rows()[0].querySelector('.bg-emerald-100')).not.toBeNull();
      expect(rows()[1].querySelector('.bg-slate-100')).not.toBeNull();
    });
    it('shows an unknown priority as plain text', () => {
      show([t({ priority: 'weird' as never })]);
      expect(rows()[0].querySelector('.capitalize.text-gray-500')!.textContent).toBe('weird');
    });
    it('opens a ticket on click', async () => {
      const a = t();
      const onSelect = show([a]);
      await click(rows()[0]);
      expect(onSelect).toHaveBeenCalledWith(a);
    });
  });

  describe('empty', () => {
    it('invites you to create an issue, or to adjust the search', async () => {
      show([]);
      expect(document.body.textContent).toContain('No issues found');
      expect(document.body.textContent).toContain('Create an issue to get started');
      cleanup();
      show([t()]);
      await typeInto(q<HTMLInputElement>('input[type="text"]'), 'zzz');
      expect(document.body.textContent).toContain('Try adjusting your search criteria');
      expect(document.body.textContent).toContain('0 issues');
    });
  });

  describe('search', () => {
    it('has its own box that filters by key, title or assignee and says how many', async () => {
      show([t({ key: 'AAA-1', title: 'Fix login' }), t({ key: 'AAA-2', title: 'Export', assignee: 'Bob' })]);
      expect(document.body.textContent).toContain('2 issues in Alpha');
      const box = q<HTMLInputElement>('input[type="text"]');
      await typeInto(box, 'LOGIN');
      expect(keys()).toEqual(['AAA-1']);
      expect(document.body.textContent).toContain('1 issue in Alpha');
      await typeInto(box, 'bob');
      expect(keys()).toEqual(['AAA-2']);
    });
    it('uses the page\'s own search and hides the box when given one', () => {
      show([t({ key: 'AAA-1', title: 'Fix login' }), t({ key: 'AAA-2', title: 'Export' })], { searchQuery: 'export' });
      expect(q('input[type="text"]')).toBeNull();
      expect(keys()).toEqual(['AAA-2']);
    });
    it('says "issues" without a space name when there is no space', () => {
      show([t()], { space: undefined });
      expect(document.body.textContent).toContain('1 issue');
      expect(document.body.textContent).not.toContain(' in ');
    });
  });

  describe('filters', () => {
    const list = [t({ key: 'AAA-1', priority: 'high', labels: ['ui'], status: 'todo' }), t({ key: 'AAA-2', priority: 'low', labels: ['api'], status: 'done' })];
    it('filters by priority, label and status', () => {
      show(list, { activeFilters: { statuses: [], priorities: ['high'], labels: [] } });
      expect(keys()).toEqual(['AAA-1']);
      cleanup();
      show(list, { activeFilters: { statuses: [], priorities: [], labels: ['api'] } });
      expect(keys()).toEqual(['AAA-2']);
      cleanup();
      show(list, { activeFilters: { statuses: ['done'], priorities: [], labels: [] } });
      expect(keys()).toEqual(['AAA-2']);
    });
  });

  describe('sorting', () => {
    const list = [t({ key: 'AAA-1', title: 'Charlie' }), t({ key: 'AAA-2', title: 'Alpha' }), t({ key: 'AAA-3', title: 'Bravo' })];
    it('starts by key, ascending', () => {
      show(list);
      expect(keys()).toEqual(['AAA-1', 'AAA-2', 'AAA-3']);
      expect(heading('Key').querySelector('svg.text-lira-blue')).not.toBeNull();
    });
    it('sorts by a column on click and reverses on a second click', async () => {
      show(list);
      await click(heading('Title'));
      expect(keys()).toEqual(['AAA-2', 'AAA-3', 'AAA-1']);
      await click(heading('Title'));
      expect(keys()).toEqual(['AAA-1', 'AAA-3', 'AAA-2']);
    });
    it('returns to the first page after sorting', async () => {
      show(many(20));
      await click(byText('button', /Next/));
      expect(document.body.textContent).toContain('Page 2 of 2');
      await click(heading('Title'));
      expect(document.body.textContent).toContain('Page 1 of 2');
    });
  });

  describe('paging', () => {
    it('shows 15 rows a page with the range and the page count', () => {
      show(many(40));
      expect(rows()).toHaveLength(15);
      expect(document.body.textContent).toContain('Showing 1–15 of 40');
      expect(document.body.textContent).toContain('Page 1 of 3');
    });
    it('moves with Prev and Next and stops at the ends', async () => {
      show(many(40));
      const prev = byText('button', /Prev/) as HTMLButtonElement;
      const next = byText('button', /Next/) as HTMLButtonElement;
      expect(prev.disabled).toBe(true);
      await click(next); await click(next);
      expect(document.body.textContent).toContain('Showing 31–40 of 40');
      expect(rows()).toHaveLength(10);
      expect(next.disabled).toBe(true);
      await click(prev);
      expect(document.body.textContent).toContain('Page 2 of 3');
    });
    it('changes the page size and goes back to page 1', async () => {
      show(many(40));
      await click(byText('button', /Next/));
      await choose(q<HTMLSelectElement>('select'), '25');
      expect(rows()).toHaveLength(25);
      expect(document.body.textContent).toContain('Page 1 of 2');
      expect([...q<HTMLSelectElement>('select')!.options].map(o => o.value)).toEqual(['10', '15', '25', '50']);
    });
    it('says 0 issues with nothing to page', () => {
      show([]);
      expect(document.body.textContent).toContain('Page 1 of 1');
      expect(document.body.textContent).toContain('0 issues');
    });
    it('goes to page 1 when the search changes', async () => {
      show(many(40));
      await click(byText('button', /Next/));
      await typeInto(q<HTMLInputElement>('input[type="text"]'), 'Ticket');
      expect(document.body.textContent).toContain('Page 1 of');
    });
  });
});
