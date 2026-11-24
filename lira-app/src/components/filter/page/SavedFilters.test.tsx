import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { makeSpace } from '../../../test/factories';
import { byText, cleanup, click, mount, q, qa, typeInto } from '../../../test/render';
import type { FilterSpec } from '../../../utils/savedFilters';
import { SavedFilters } from './SavedFilters';

const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../../common/dialogStore', () => dialog);

const KEY = 'lira_saved_filters';
const empty = (): FilterSpec => ({ query: '', spaces: [], statuses: [], priorities: [], types: [], assignees: [], labels: [], team: 'all', recentOnly: false, sort: 'updatedAt', ascending: false });
const open = (): FilterSpec => ({ ...empty(), statuses: ['todo', 'inprogress'] });
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '[]') as { id: string; name: string; spec: FilterSpec }[];
const seed = (...items: object[]) => localStorage.setItem(KEY, JSON.stringify(items));
const item = (id: string, name: string, spec: unknown = open()) => ({ id, name, spec, createdAt: 'now' });

function show(current: FilterSpec = empty()) {
  const applySpec = vi.fn();
  mount(<SavedFilters currentSpec={current} applySpec={applySpec} spaces={[makeSpace({ id: 1, name: 'Alpha' })]} />);
  return applySpec;
}
const save = () => byText<HTMLButtonElement>('button', 'Save current filter')!;

beforeEach(() => { localStorage.clear(); dialog.confirmDialog.mockClear(); dialog.confirmDialog.mockResolvedValue(true); });
afterEach(cleanup);

describe('saved filters', () => {
  it('says there are none yet, and offers no saving until something is chosen', () => {
    show();
    expect(q('section')!.textContent).toContain('None yet');
    expect(save().disabled).toBe(true);
    expect(save().title).toBe('Choose some filters first');
  });

  it('saves what is chosen under a name, and lists it', async () => {
    show(open());
    expect(save().disabled).toBe(false);
    await click(save());
    await typeInto(q<HTMLInputElement>('input[aria-label="Name for this filter"]'), '  Open work ');
    await click(byText('button', 'Save'));
    expect(stored()).toMatchObject([{ name: 'Open work', spec: open() }]);
    expect(byText('button', 'Open work')).toBeDefined();
    expect(q('form[aria-label="Save this filter"]')).toBeNull();
  });

  it('shows why a name is refused and keeps the form open, then accepts a better one', async () => {
    seed(item('a', 'Open work'));
    show({ ...open(), types: ['bug'] });
    await click(save());
    await click(byText('button', 'Save'));
    expect(q('[role="alert"]')!.textContent).toBe('Give it a name.');
    await typeInto(q<HTMLInputElement>('input[aria-label="Name for this filter"]'), 'open WORK');
    await click(byText('button', 'Save'));
    expect(q('[role="alert"]')!.textContent).toContain('exists');
    await typeInto(q<HTMLInputElement>('input[aria-label="Name for this filter"]'), 'Open bugs');
    expect(q('[role="alert"]')).toBeNull(); // the message goes as soon as the name is changed
    await click(byText('button', 'Save'));
    expect(stored().map(f => f.name)).toEqual(['Open work', 'Open bugs']);
  });

  it('cancels, and Escape cancels too, without saving', async () => {
    show(open());
    await click(save());
    await click(byText('button', 'Cancel'));
    expect(q('form[aria-label="Save this filter"]')).toBeNull();
    await click(save());
    await act(async () => { q('input[aria-label="Name for this filter"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(q('form[aria-label="Save this filter"]')).toBeNull();
    expect(stored()).toEqual([]);
  });

  it('applies a saved filter on a click, marks the one that matches what is chosen, and describes it in its tooltip', async () => {
    seed(item('a', 'Open work'), item('b', 'Alpha bugs', { ...empty(), spaces: [1], types: ['bug'] }));
    const apply = show(open());
    expect(byText('button', 'Open work')!.getAttribute('aria-pressed')).toBe('true');
    expect(byText('button', 'Alpha bugs')!.getAttribute('aria-pressed')).toBe('false');
    expect(byText('button', 'Alpha bugs')!.title).toBe('Alpha · bug');
    await click(byText('button', 'Alpha bugs'));
    expect(apply).toHaveBeenCalledWith({ ...empty(), spaces: [1], types: ['bug'] });
  });

  it('does not offer to save a filter that is already saved', () => {
    seed(item('a', 'Open work', { ...open(), statuses: ['inprogress', 'todo'] })); // the same choices in another order
    show(open());
    expect(save().disabled).toBe(true);
    expect(save().title).toBe('These filters are already saved');
  });

  it('deletes only after asking, and keeps it when the answer is no', async () => {
    seed(item('a', 'Open work'));
    show();
    dialog.confirmDialog.mockResolvedValueOnce(false);
    await click(q('button[aria-label="Delete saved filter Open work"]'));
    expect(stored()).toHaveLength(1);
    await click(q('button[aria-label="Delete saved filter Open work"]'));
    expect(stored()).toEqual([]);
  });

  it('shows a saved filter it cannot read as unusable, and never applies half of it', async () => {
    seed(item('a', 'Broken', { statuses: 'todo' }), item('b', 'Fine'));
    const apply = show();
    const broken = byText<HTMLButtonElement>('button', 'Broken')!;
    expect(broken.disabled).toBe(true);
    expect(broken.title).toContain('can no longer be read');
    await click(broken);
    expect(apply).not.toHaveBeenCalled();
    expect(qa('section button').some(b => b.textContent === 'Fine' && !(b as HTMLButtonElement).disabled)).toBe(true);
  });
});
