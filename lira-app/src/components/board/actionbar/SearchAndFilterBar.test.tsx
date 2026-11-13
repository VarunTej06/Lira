import { afterEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q, qa, typeInto } from '../../../test/render';
import { SearchAndFilterBar } from './SearchAndFilterBar';
import type { ActionBarState } from './useActionBarState';

afterEach(cleanup);

function show(over: Record<string, unknown> = {}) {
  const h = {
    onSearchChange: vi.fn(), onFilterAssigneeToggle: vi.fn(), handleClearFilters: vi.fn(), handleGroupChange: vi.fn(), setShowGroup: vi.fn(),
    setShowOverflow: vi.fn(), setShowWipLimitsModal: vi.fn(), handleWipToggle: vi.fn(), handleBoardSettings: vi.fn(), handleBulkActions: vi.fn(),
    handleExportViewJSON: vi.fn(), onEditSpace: vi.fn(), onToggleHideSpace: vi.fn(), onToggleArchiveSpace: vi.fn(),
    handleStatusToggle: vi.fn(), handlePriorityToggle: vi.fn(), handleLabelToggle: vi.fn(), handleClearGroup: vi.fn(),
  };
  const state = {
    searchQuery: '', filterAssignee: false, availableLabels: ['bug', 'ui'], isSpaceHidden: false, isSpaceArchived: false,
    filterPriorities: [], filterLabels: [], filterStatuses: [], groupBy: 'none', showGroup: false, groupRef: { current: null }, showOverflow: false,
    overflowRef: { current: null }, wipEnabled: false, activeFilterCount: 0, currentGroupLabel: 'None', ...h, ...over,
  } as unknown as ActionBarState;
  mount(<SearchAndFilterBar {...state} />);
  return h;
}
const btn = (re: RegExp) => byText('button', re);

describe('SearchAndFilterBar', () => {
  describe('search', () => {
    it('sends what is typed', async () => {
      const h = show();
      await typeInto(q<HTMLInputElement>('input[placeholder="Search board"]'), 'login');
      expect(h.onSearchChange).toHaveBeenCalledWith('login');
    });
    it('shows a clear button only while there is text, and it empties the search', async () => {
      show();
      expect(q('input[placeholder="Search board"]')!.parentElement!.querySelector('button')).toBeNull();
      cleanup();
      const h = show({ searchQuery: 'abc' });
      expect(q<HTMLInputElement>('input[placeholder="Search board"]')!.value).toBe('abc');
      await click(q('input[placeholder="Search board"]')!.parentElement!.querySelector('button'));
      expect(h.onSearchChange).toHaveBeenCalledWith('');
    });
  });

  describe('assignee and filters', () => {
    it('toggles the "me" filter and says what it does', async () => {
      const h = show();
      const b = q('button[title="Filter by me (VY)"]')!;
      await click(b);
      expect(h.onFilterAssigneeToggle).toHaveBeenCalled();
      cleanup();
      show({ filterAssignee: true });
      expect(q('button[title="Show all assignees"]')!.className).toContain('ring-2');
    });
    it('has Priority, Status and Labels dropdowns', () => {
      show();
      for (const l of ['Priority', 'Status', 'Labels']) expect(btn(new RegExp(l))).toBeDefined();
    });
    it('shows Clear filters only when a filter is on', async () => {
      show();
      expect(q('[data-testid="clear-filters"]')).toBeNull();
      cleanup();
      const h = show({ activeFilterCount: 2 });
      await click(q('[data-testid="clear-filters"]'));
      expect(h.handleClearFilters).toHaveBeenCalled();
    });
  });

  describe('group by', () => {
    it('shows the current grouping and toggles the list', async () => {
      const h = show({ currentGroupLabel: 'Assignee' });
      await click(btn(/Group: Assignee/));
      expect(h.setShowGroup).toHaveBeenCalledWith(true);
    });
    it('lists the options, marks the current one and picks one', async () => {
      const h = show({ showGroup: true, groupBy: 'status' });
      const options = qa('button').filter(b => b.className.includes('w-full text-left px-3 py-2'));
      expect(options.length).toBeGreaterThan(1);
      expect(options.filter(b => b.className.includes('text-lira-blue'))).toHaveLength(1);
      await click(options[1]);
      expect(h.handleGroupChange).toHaveBeenCalled();
    });
    it('is closed by default', () => {
      show();
      expect(document.body.textContent).not.toContain('Group by');
    });
  });

  describe('... menu', () => {
    it('opens from the button', async () => {
      const h = show();
      await click(q('button[title="More options"]'));
      expect(h.setShowOverflow).toHaveBeenCalledWith(true);
      expect(document.body.textContent).not.toContain('Board settings');
    });
    it('lists the always-there items and runs them', async () => {
      const h = show({ showOverflow: true });
      await click(btn(/Board settings/));
      await click(btn(/Bulk actions/));
      await click(btn(/Export view to JSON/));
      expect(h.handleBoardSettings).toHaveBeenCalled();
      expect(h.handleBulkActions).toHaveBeenCalled();
      expect(h.handleExportViewJSON).toHaveBeenCalled();
    });
    it('shows the space items only when they can be done, and closes the menu after each', async () => {
      const h = show({ showOverflow: true });
      await click(btn(/Space settings/));
      await click(btn(/Hide space/));
      await click(btn(/Archive space/));
      expect(h.onEditSpace).toHaveBeenCalled();
      expect(h.onToggleHideSpace).toHaveBeenCalled();
      expect(h.onToggleArchiveSpace).toHaveBeenCalled();
      expect(h.setShowOverflow).toHaveBeenCalledTimes(3);
      expect(h.setShowOverflow).toHaveBeenCalledWith(false);
      cleanup();
      show({ showOverflow: true, onEditSpace: undefined, onToggleHideSpace: undefined, onToggleArchiveSpace: undefined });
      expect(document.body.textContent).not.toMatch(/Space settings|Hide space|Archive space/);
    });
    it('says Unhide and Unarchive when it already is', () => {
      show({ showOverflow: true, isSpaceHidden: true, isSpaceArchived: true });
      expect(btn(/Unhide space/)).toBeDefined();
      expect(btn(/Unarchive space/)).toBeDefined();
    });
    it('shows the WIP limit state, opens its settings and has a switch', async () => {
      const h = show({ showOverflow: true });
      expect(document.body.textContent).toContain('WIP limits: OFF');
      await click(btn(/WIP limits: OFF/));
      expect(h.setShowWipLimitsModal).toHaveBeenCalledWith(true);
      expect(h.setShowOverflow).toHaveBeenCalledWith(false);
      await click(q('button[aria-label="Toggle WIP limits"]'));
      expect(h.handleWipToggle).toHaveBeenCalled();
      cleanup();
      show({ showOverflow: true, wipEnabled: true });
      expect(document.body.textContent).toContain('WIP limits: ON');
      expect(q('button[aria-label="Toggle WIP limits"]')!.className).toContain('bg-lira-blue');
    });
  });
});
