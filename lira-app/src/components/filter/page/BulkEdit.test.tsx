import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../../types/issue';
import type { Space } from '../../../types/space';
import { byText, choose, cleanup, click, mount, q, qa } from '../../../test/render';
import { makeIssue, makeSpace } from '../../../test/factories';
import { ResultsTable } from './ResultsTable';
import type { FiltersState } from './useFiltersState';

const edition = vi.hoisted(() => ({ hosted: false }));
vi.mock('../../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../../utils/edition')>()), isHosted: () => edition.hosted }));
const api = vi.hoisted(() => ({ updateIssue: vi.fn<(id: number, change: object) => Promise<void>>(async () => undefined) }));
vi.mock('../../../hooks/useIssues', () => api);

const A = makeSpace({ id: 1, key: 'AAA', name: 'Alpha', myLevel: 'edit' });
const B = makeSpace({ id: 2, key: 'BBB', name: 'Beta', myLevel: 'view' });
let onSelect = vi.fn();

function show(filtered: Issue[], spaces: Space[], rerender?: ReturnType<typeof mount>) {
  const state = { issues: filtered, filteredIssues: filtered, spaces, spaceMap: Object.fromEntries(spaces.map(s => [s.id, s])), onSelectIssue: onSelect, onSelectSpace: vi.fn(), clearAllFilters: vi.fn(), toggleSort: vi.fn() } as unknown as FiltersState;
  return rerender ? (rerender.rerender(<ResultsTable {...state} />), rerender) : mount(<ResultsTable {...state} />);
}
const tick = (key: string) => q<HTMLInputElement>(`input[aria-label="Select ${key}"]`)!;
const bar = () => q('[aria-label="Change the selected tickets"]');
const t1 = makeIssue({ id: 1, key: 'AAA-1', spaceId: 1, status: 'todo', priority: 'low', assignee: 'Bo', assigneeInitials: 'B' });
const t2 = makeIssue({ id: 2, key: 'AAA-2', spaceId: 1, status: 'todo', priority: 'low' });
const t3 = makeIssue({ id: 3, key: 'BBB-1', spaceId: 2, status: 'todo', priority: 'low' });

beforeEach(() => { edition.hosted = false; api.updateIssue.mockReset(); api.updateIssue.mockResolvedValue(undefined); onSelect = vi.fn(); });
afterEach(cleanup);

describe('ticking tickets on the Filters page', () => {
  it('shows no bar until a ticket is ticked, and ticking does not open the ticket', async () => {
    show([t1, t2], [A]);
    expect(bar()).toBeNull();
    await click(tick('AAA-1'));
    expect(bar()!.textContent).toContain('1 selected');
    expect(onSelect).not.toHaveBeenCalled();
    await click(tick('AAA-1'));
    expect(bar()).toBeNull();
  });

  it('selects every shown ticket from the header, and clears them again', async () => {
    show([t1, t2], [A]);
    await click(q('input[aria-label="Select all shown"]'));
    expect(bar()!.textContent).toContain('2 selected');
    await click(byText('button', 'Clear'));
    expect(bar()).toBeNull();
  });

  it('keeps Apply off until something is chosen, then sets only what was chosen on every ticked ticket', async () => {
    show([t1, t2], [A]);
    await click(q('input[aria-label="Select all shown"]'));
    expect(byText<HTMLButtonElement>('button', 'Apply')!.disabled).toBe(true);
    await choose(q<HTMLSelectElement>('select[aria-label="Set status"]'), 'done');
    await choose(q<HTMLSelectElement>('select[aria-label="Set assignee"]'), 'Bo');
    await click(byText('button', 'Apply'));
    expect(api.updateIssue.mock.calls).toEqual([[1, { status: 'done', assignee: 'Bo', assigneeInitials: 'B' }], [2, { status: 'done', assignee: 'Bo', assigneeInitials: 'B' }]]);
    expect(q('[role="status"]')!.textContent).toContain('Updated 2 tickets');
    expect(bar()).toBeNull(); // the selection is cleared once it worked
  });

  it('puts each ticket back to what it held when Undo is pressed', async () => {
    show([t1, t2], [A]);
    await click(q('input[aria-label="Select all shown"]'));
    await choose(q<HTMLSelectElement>('select[aria-label="Set priority"]'), 'highest');
    await click(byText('button', 'Apply'));
    api.updateIssue.mockClear();
    await click(byText('button', 'Undo'));
    expect(api.updateIssue.mock.calls).toEqual([[1, { priority: 'low' }], [2, { priority: 'low' }]]);
    expect(q('[role="status"]')!.textContent).toContain('Put 2 tickets back');
  });

  it('says how many could not be changed, keeps them ticked, and offers Undo for the rest', async () => {
    api.updateIssue.mockRejectedValueOnce(new Error('no'));
    show([t1, t2], [A]);
    await click(q('input[aria-label="Select all shown"]'));
    await choose(q<HTMLSelectElement>('select[aria-label="Set status"]'), 'done');
    await click(byText('button', 'Apply'));
    expect(q('[role="status"]')!.textContent).toContain('Updated 1 ticket, 1 could not be changed');
    expect(bar()).not.toBeNull();
    expect(byText('button', 'Undo')).toBeDefined();
  });

  it('drops a ticket from the selection when it leaves the results', async () => {
    const view = show([t1, t2], [A]);
    await click(tick('AAA-1')); await click(tick('AAA-2'));
    show([t2], [A], view);
    expect(bar()!.textContent).toContain('1 selected');
  });
});

describe('what a person who may only view cannot do (hosted edition)', () => {
  beforeEach(() => { edition.hosted = true; });

  it('offers no tick boxes at all when nothing shown can be changed', () => {
    show([t3], [B]);
    expect(qa('input[type="checkbox"]')).toHaveLength(0);
  });

  it('locks the tickets of a view-only space, says why, and never counts them in Select all', async () => {
    show([t1, t3], [A, B]);
    expect(tick('BBB-1').disabled).toBe(true);
    expect(tick('BBB-1').title).toBe('You can only view this space');
    await click(q('input[aria-label="Select all shown"]'));
    expect(bar()!.textContent).toContain('1 selected');
    await choose(q<HTMLSelectElement>('select[aria-label="Set status"]'), 'done');
    await click(byText('button', 'Apply'));
    expect(api.updateIssue.mock.calls.map(c => c[0])).toEqual([1]);
  });

  it('refuses a space whose level is not known, rather than guessing', () => {
    show([t1], [makeSpace({ id: 1, key: 'AAA', name: 'Alpha' })]);
    expect(qa('input[type="checkbox"]')).toHaveLength(0);
  });
});
