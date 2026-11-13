import { afterEach, describe, expect, it, vi } from 'vitest';
import { byText, choose, cleanup, click, mount, q, qa, typeInto } from '../../../test/render';
import { FilterControls } from './FilterControls';
import type { FiltersState } from './useFiltersState';

afterEach(cleanup);

const SPACES = [{ id: 1, key: 'AAA', name: 'Alpha', icon: 'A' }, { id: 2, key: 'BBB', name: 'Beta', icon: 'B' }];

/** Every setter is a mock; the ones that take an updater function record the new list. */
function show(over: Record<string, unknown> = {}) {
  const lists: Record<string, string[] | number[]> = {};
  const setter = (name: string, start: unknown[]) => vi.fn((u: unknown) => { lists[name] = typeof u === 'function' ? (u as (p: unknown[]) => unknown[])(start) as never : u as never; });
  const sel = (name: string) => (over[name] as unknown[]) ?? [];
  const h = {
    setSearchQuery: vi.fn(), setSelectedTeam: vi.fn(), setOpenDropdown: vi.fn(), clearAllFilters: vi.fn(), applyPreset: vi.fn(),
    setSelectedSpaces: setter('spaces', sel('selectedSpaces')), setSelectedStatuses: setter('statuses', sel('selectedStatuses')),
    setSelectedPriorities: setter('priorities', sel('selectedPriorities')), setSelectedTypes: setter('types', sel('selectedTypes')),
    setSelectedAssignees: setter('assignees', sel('selectedAssignees')), setSelectedLabels: setter('labels', sel('selectedLabels')),
  };
  const state = {
    issues: [1, 2, 3], filteredIssues: [1], spaces: SPACES, spaceMap: { 1: SPACES[0], 2: SPACES[1] }, searchQuery: '',
    selectedSpaces: [], selectedStatuses: [], selectedPriorities: [], selectedTypes: [], selectedAssignees: [], selectedLabels: [], selectedTeam: 'all',
    activePreset: 'all', openDropdown: null, allLabels: ['bug', 'ui'], allAssignees: ['VY', 'AB'], allTeams: ['Core'], presetCounts: { all: 3, open: 2, completed: 1, recent: 3 },
    activeFiltersCount: 0, ...h, ...over,
  } as unknown as FiltersState;
  mount(<FilterControls {...state} />);
  return { ...h, lists };
}
const facetButtons = () => qa('.grid.bg-gray-50\\/70 > div > button');
const facetText = () => facetButtons().map(b => b.textContent);

describe('FilterControls', () => {
  describe('search and presets', () => {
    it('sends what is typed and shows a clear x only with text', async () => {
      const h = show();
      await typeInto(q<HTMLInputElement>('input[type="text"]'), 'AI-18');
      expect(h.setSearchQuery).toHaveBeenCalledWith('AI-18');
      cleanup();
      const h2 = show({ searchQuery: 'x' });
      await click(q('input[type="text"]')!.parentElement!.querySelector('button'));
      expect(h2.setSearchQuery).toHaveBeenCalledWith('');
    });
    it('has four presets with counts, the active one filled, and applies one on click', async () => {
      const h = show({ activePreset: 'open' });
      const labels = ['All Issues', 'Open Issues', 'Completed', 'Recently Updated'];
      labels.forEach(l => expect(byText('button', new RegExp(l))).toBeDefined());
      expect(byText('button', /Open Issues/)!.className).toContain('bg-lira-blue');
      expect(byText('button', /All Issues/)!.className).not.toContain('bg-lira-blue');
      expect(byText('button', /Completed/)!.textContent).toContain('1');
      await click(byText('button', /Completed/));
      expect(h.applyPreset).toHaveBeenCalledWith('completed');
    });
    it('shows the count and Reset only when a filter is on', async () => {
      show();
      expect(document.body.textContent).toContain('1 of 3');
      expect(byText('button', /Reset/)).toBeUndefined();
      cleanup();
      const h = show({ activeFiltersCount: 2 });
      await click(byText('button', /Reset/));
      expect(h.clearAllFilters).toHaveBeenCalled();
    });
  });

  describe('facet buttons', () => {
    it('summarise each filter when nothing is chosen', () => {
      show();
      expect(facetText()).toEqual(['Space: All', 'Status: All', 'Priority: All', 'Type: All', 'Assignee: All', 'Tags & Team']);
    });
    it('summarise one or several chosen values', () => {
      show({ selectedSpaces: [1], selectedStatuses: ['todo'], selectedPriorities: ['high', 'low'], selectedTypes: ['bug'], selectedAssignees: ['VY', 'AB'], selectedLabels: ['bug'], selectedTeam: 'Core' });
      expect(facetText()).toEqual(['Alpha', 'TODO', '2 Selected', '1 Types', '2 Assignees', '2 Active']);
    });
    it('count several spaces and statuses, and fall back when a space is unknown', () => {
      show({ selectedSpaces: [1, 2], selectedStatuses: ['todo', 'done'] });
      expect(facetText().slice(0, 2)).toEqual(['2 Spaces', '2 Statuses']);
      cleanup();
      show({ selectedSpaces: [99] });
      expect(facetText()[0]).toBe('1 Space');
    });
    it('highlight only the ones in use', () => {
      show({ selectedStatuses: ['todo'] });
      expect(facetButtons().map(b => b.className.includes('border-lira-blue'))).toEqual([false, true, false, false, false, false]);
    });
    it('open and close their panel through the page', async () => {
      const h = show();
      await click(facetButtons()[1]);
      expect(h.setOpenDropdown).toHaveBeenCalledWith('status');
      cleanup();
      const h2 = show({ openDropdown: 'status' });
      await click(facetButtons()[1]);
      expect(h2.setOpenDropdown).toHaveBeenCalledWith(null);
    });
    it('show only the open panel', () => {
      show({ openDropdown: 'priority' });
      expect(document.body.textContent).toContain('Priority Tier');
      expect(document.body.textContent).not.toContain('Filter by Status');
    });
  });

  describe('panels', () => {
    it('space: lists spaces and toggles one in and out', async () => {
      const h = show({ openDropdown: 'space', selectedSpaces: [2] });
      await click(byText('button', /Alpha/, q('.top-full')!));
      expect(h.lists.spaces).toEqual([2, 1]);
      await click(byText('button', /Beta/, q('.top-full')!));
      expect(h.lists.spaces).toEqual([]);
    });
    it('status: five statuses, a tick on the chosen ones', async () => {
      const h = show({ openDropdown: 'status', selectedStatuses: ['todo'] });
      for (const l of ['Backlog', 'To Do', 'In Progress', 'Blocked (flag)', 'Done']) expect(byText('button', new RegExp(l.replace('(', '\\(').replace(')', '\\)')))).toBeDefined();
      expect(byText('button', /To Do/)!.className).toContain('bg-lira-blue-light text-lira-blue');
      await click(byText('button', /Done/));
      expect(h.lists.statuses).toEqual(['todo', 'done']);
    });
    it('priority and type: capitalised names', async () => {
      const h = show({ openDropdown: 'priority' });
      expect(['Highest', 'High', 'Medium', 'Low', 'Lowest'].every(l => byText('button', new RegExp(l)))).toBe(true);
      await click(byText('button', /Highest/));
      expect(h.lists.priorities).toEqual(['highest']);
      cleanup();
      const h2 = show({ openDropdown: 'type' });
      expect(['Epic', 'Task', 'Bug', 'Subtask'].every(l => byText('button', new RegExp(l)))).toBe(true);
      await click(byText('button', /Bug/));
      expect(h2.lists.types).toEqual(['bug']);
    });
    it('assignee: names VY as Varun Tej', async () => {
      const h = show({ openDropdown: 'assignee' });
      expect(document.body.textContent).toContain('Varun Tej (VY)');
      await click(byText('button', /^\s*AB/));
      expect(h.lists.assignees).toEqual(['AB']);
    });
    it('tags: a team picker and label buttons, each only when there is something to pick', async () => {
      const h = show({ openDropdown: 'tags' });
      await choose(q<HTMLSelectElement>('select'), 'Core');
      expect(h.setSelectedTeam).toHaveBeenCalledWith('Core');
      await click(byText('button', '#bug'));
      expect(h.lists.labels).toEqual(['bug']);
      cleanup();
      show({ openDropdown: 'tags', allTeams: [], allLabels: [] });
      expect(q('select')).toBeNull();
      expect(document.body.textContent).not.toContain('Labels / Tags');
    });
    it('tags: marks chosen labels', () => {
      show({ openDropdown: 'tags', selectedLabels: ['ui'] });
      expect(byText('button', '#ui')!.className).toContain('bg-indigo-600');
      expect(byText('button', '#bug')!.className).toContain('bg-indigo-50');
    });
  });
});

