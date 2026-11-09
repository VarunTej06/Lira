import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import type { Roadmap, RoadmapItem } from '../../utils/roadmapUtils';
import { byText, choose, cleanup, click, mount, q, qa, wait } from '../../test/render';

const h = vi.hoisted(() => ({
  state: { roadmap: undefined as unknown, last: undefined as unknown },
  update: vi.fn(),
  remove: vi.fn(),
  prompt: vi.fn(),
  confirm: vi.fn(),
  saved: vi.fn(),
  svc: {
    addTicketToEpic: vi.fn(async () => {}), createEpicForItem: vi.fn(async () => 'AAA-9'), ensureTaskForItem: vi.fn(async () => 'AAA-10'),
    setTicketDate: vi.fn(async () => {}), syncEpicFromItem: vi.fn(async () => {}), syncTaskFromItem: vi.fn(async () => {}),
  },
}));

vi.mock('../../hooks/useRoadmaps', () => ({ useRoadmaps: () => ({ roadmaps: h.state.roadmap ? [h.state.roadmap] : [], update: h.update, remove: h.remove }) }));
vi.mock('../common/dialogStore', () => ({ promptDialog: h.prompt, confirmDialog: h.confirm }));
vi.mock('../common/savedToastStore', () => ({ notifySaved: h.saved }));
vi.mock('../../services/roadmapEpics', () => ({ ...h.svc, spaceForRoadmap: (r: { spaceKey?: string }, spaces: { key: string }[]) => spaces.find(s => s.key === r.spaceKey) }));
vi.mock('./useEnsureEpics', () => ({ useEnsureEpics: () => {} }));
vi.mock('./RoadmapSummary', () => ({ RoadmapSummary: ({ conflicts }: { conflicts: number }) => <div data-testid="summary">conflicts {conflicts}</div> }));
vi.mock('./RoadmapToolbar', () => ({
  RoadmapToolbar: (p: { prefs: { view: string }; setPrefs: (x: object) => void; setFilter: (x: object) => void; onToday: () => void; owners: string[] }) => (
    <div data-testid="toolbar">
      <span data-testid="view">{p.prefs.view}</span><span data-testid="owners">{p.owners.join(',')}</span>
      <button onClick={() => p.setPrefs({ view: 'planner' })}>to-planner</button>
      <button onClick={() => p.setPrefs({ view: 'horizon' })}>to-horizon</button>
      <button onClick={() => p.setPrefs({ view: 'table' })}>to-table</button>
      <button onClick={() => p.setFilter({ search: 'zzz' })}>filter-none</button>
      <button onClick={p.onToday}>today</button>
    </div>
  ),
}));
vi.mock('./TimelineView', () => ({
  TimelineView: (p: { items: RoadmapItem[]; collapsedLanes: string[]; onToggleLane: (l: string) => void; onChangeItem: (i: RoadmapItem) => void; onOpenItem: (id: string) => void; onOpenMilestone: (id: string) => void; scrollToTodayKey: number }) => (
    <div data-testid="timeline">
      <span data-testid="shown">{p.items.length}</span><span data-testid="collapsed">{p.collapsedLanes.join(',')}</span><span data-testid="todaykey">{p.scrollToTodayKey}</span>
      <button onClick={() => p.onChangeItem({ ...p.items[0], end: '2026-11-30' })}>drag</button>
      <button onClick={() => p.onOpenItem('i1')}>open-item</button>
      <button onClick={() => p.onOpenItem('nope')}>open-missing</button>
      <button onClick={() => p.onOpenMilestone('m1')}>open-ms</button>
      <button onClick={() => p.onOpenMilestone('nope')}>open-ms-missing</button>
      <button onClick={() => p.onToggleLane('Core')}>toggle-lane</button>
    </div>
  ),
}));
vi.mock('./PlannerView', () => ({
  PlannerView: (p: { onMoveTicket: (i: unknown, d: string) => void; onOpenIssue: (i: unknown) => void; onAddTicket: (e: string, t: string) => void }) => (
    <div data-testid="planner">
      <button onClick={() => p.onMoveTicket({ id: 1 }, '2026-11-12')}>move-ticket</button>
      <button onClick={() => p.onOpenIssue({ id: 7, key: 'AAA-7' })}>open-issue</button>
      <button onClick={() => p.onAddTicket('AAA-1', 'New thing')}>add-ticket</button>
    </div>
  ),
}));
vi.mock('./HorizonBoard', () => ({ HorizonBoard: () => <div data-testid="horizon" /> }));
vi.mock('./RoadmapTable', () => ({ RoadmapTable: () => <div data-testid="table" /> }));
vi.mock('./RoadmapModals', () => ({
  ItemModal: (p: { item: RoadmapItem; isNew: boolean; onSave: (i: RoadmapItem, o: object) => void; onDelete: (id: string) => void; onOpenEpic: (k: string) => void; onClose: () => void }) => (
    <div data-testid="item-modal">
      <span data-testid="item-title">{p.item.title}</span><span data-testid="item-new">{String(p.isNew)}</span>
      <button onClick={() => p.onSave(p.item, { epicMode: 'new', statusChanged: false, newLane: 'Fresh' })}>save-new-epic</button>
      <button onClick={() => p.onSave(p.item, { epicMode: 'existing', existingKey: 'AAA-5', statusChanged: true })}>save-existing</button>
      <button onClick={() => p.onSave({ ...p.item, children: [{ id: 'c', title: 'c', done: false }] } as RoadmapItem, { epicMode: 'keep', statusChanged: false })}>save-with-checklist</button>
      <button onClick={() => p.onSave({ ...p.item, taskKey: 'AAA-2' }, { epicMode: 'keep', statusChanged: false })}>save-with-task</button>
      <button onClick={() => p.onSave(p.item, { epicMode: 'keep', statusChanged: false })}>save-keep</button>
      <button onClick={() => p.onDelete('i1')}>delete-item</button>
      <button onClick={() => p.onOpenEpic('AAA-1')}>open-epic</button>
      <button onClick={p.onClose}>close-item</button>
    </div>
  ),
  MilestoneModal: (p: { milestone: { id: string; title: string }; isNew: boolean; onSave: (m: object) => void; onDelete: (id: string) => void; onClose: () => void }) => (
    <div data-testid="ms-modal">
      <span data-testid="ms-new">{String(p.isNew)}</span>
      <button onClick={() => p.onSave({ ...p.milestone, title: 'Launch', id: p.milestone.id })}>save-ms</button>
      <button onClick={() => p.onSave({ id: '', title: 'Fresh', date: '2026-12-01', kind: 'milestone' })}>save-ms-blank-id</button>
      <button onClick={() => p.onDelete(p.milestone.id)}>delete-ms</button>
      <button onClick={p.onClose}>close-ms</button>
    </div>
  ),
}));

import { RoadmapDetail } from './RoadmapDetail';

const item = (over: Partial<RoadmapItem> = {}): RoadmapItem => ({ id: 'i1', title: 'Epic one', lane: 'Core', status: 'planned', start: '2026-11-01', end: '2026-11-10', progress: 0, owner: 'VY', deps: [], children: [], ...over }) as RoadmapItem;
const roadmap = (over: Partial<Roadmap> = {}): Roadmap => ({
  id: 'r1', name: 'My Plan', description: '', spaceKey: 'AAA', lanes: ['Core'],
  milestones: [{ id: 'm1', title: 'M', date: '2026-11-20', kind: 'milestone' }], items: [item(), item({ id: 'i2', title: 'Epic two', owner: 'AB', start: '2026-11-11', end: '2026-11-20', deps: ['i1'] })], ...over,
}) as Roadmap;
const SPACES = [{ id: 1, key: 'AAA', name: 'Alpha' }] as unknown as Space[];
const ISSUES = [{ id: 1, key: 'AAA-1' }, { id: 2, key: 'AAA-2' }] as unknown as Issue[];

/** What the last update() call did to the roadmap. */
const after = (): Roadmap => h.state.last as Roadmap;
function show(r: Roadmap | null = roadmap(), spaces = SPACES) {
  h.state.roadmap = r ?? undefined;
  const onBack = vi.fn();
  mount(<RoadmapDetail roadmapId="r1" issues={ISSUES} spaces={spaces} onBack={onBack} />);
  return { onBack };
}
const btn = (t: string | RegExp) => byText('button', t)!;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  h.state.last = undefined;
  h.update.mockImplementation((_id: string, fn: (r: unknown) => unknown) => { h.state.last = fn(h.state.roadmap); });
  h.confirm.mockResolvedValue(true);
});
afterEach(cleanup);

describe('RoadmapDetail', () => {
  describe('a roadmap that is gone', () => {
    it('says so and goes back', async () => {
      const { onBack } = show(null);
      expect(document.body.textContent).toContain('This roadmap no longer exists.');
      await click(btn('Back to roadmaps'));
      expect(onBack).toHaveBeenCalled();
    });
  });

  describe('header', () => {
    it('shows the name, the epics space and the default description', () => {
      show();
      expect(q('h1')!.textContent).toContain('My Plan');
      expect(q('h1')!.textContent).toContain('Epics in Alpha');
      expect(document.body.textContent).toContain('Plan work over time, track progress and keep dependencies visible.');
    });
    it('shows its own description when it has one', () => {
      show(roadmap({ description: 'Q4 goals' }));
      expect(document.body.textContent).toContain('Q4 goals');
    });
    it('goes back to all roadmaps', async () => {
      const { onBack } = show();
      await click(btn(/All roadmaps/));
      expect(onBack).toHaveBeenCalled();
    });
    it('asks for a space when the roadmap has none, and saves the choice', async () => {
      show(roadmap({ spaceKey: undefined }));
      const sel = q<HTMLSelectElement>('select[aria-label="Choose the space for this roadmap\'s epics"]')!;
      expect([...sel.options].map(o => o.textContent)).toEqual(['Choose a space for the epics…', 'Alpha (AAA)']);
      await choose(sel, 'AAA');
      expect(after().spaceKey).toBe('AAA');
    });
    it('lists the owners to the toolbar without repeats', () => {
      show();
      expect(q('[data-testid="owners"]')!.textContent).toBe('VY,AB');
    });
  });

  describe('options menu', () => {
    const open = async () => { await click(q('button[aria-label="Roadmap options"]')); };
    it('is closed until opened', async () => {
      show();
      expect(byText('button', 'Rename roadmap')).toBeUndefined();
      await open();
      expect(btn('Rename roadmap')).toBeDefined();
    });
    it('renames, ignoring an empty answer', async () => {
      show();
      h.prompt.mockResolvedValueOnce('New name');
      await open(); await click(btn('Rename roadmap'));
      expect(h.prompt).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rename roadmap', defaultValue: 'My Plan' }));
      expect(after().name).toBe('New name');
      h.update.mockClear();
      h.prompt.mockResolvedValueOnce(null);
      await open(); await click(btn('Rename roadmap'));
      expect(h.update).not.toHaveBeenCalled();
    });
    it('edits the description, and accepts an empty one', async () => {
      show();
      h.prompt.mockResolvedValueOnce('');
      await open(); await click(btn('Edit description'));
      expect(h.prompt).toHaveBeenCalledWith(expect.objectContaining({ title: 'Edit description', required: false }));
      expect(after().description).toBe('');
    });
    it('deletes only after a yes, then goes back', async () => {
      const { onBack } = show();
      h.confirm.mockResolvedValueOnce(false);
      await open(); await click(btn('Delete roadmap'));
      expect(h.remove).not.toHaveBeenCalled();
      await open(); await click(btn('Delete roadmap'));
      expect(h.confirm).toHaveBeenLastCalledWith(expect.objectContaining({ tone: 'danger', message: expect.stringContaining('"My Plan"') }));
      expect(h.remove).toHaveBeenCalledWith('r1');
      expect(onBack).toHaveBeenCalled();
    });
  });

  describe('views', () => {
    it('starts on the timeline with the saved preference', () => {
      show();
      expect(q('[data-testid="timeline"]')).not.toBeNull();
      expect(q('[data-testid="view"]')!.textContent).toBe('timeline');
    });
    it('switches to planner, horizon and table and remembers the choice', async () => {
      show();
      await click(btn('to-planner')); expect(q('[data-testid="planner"]')).not.toBeNull(); expect(q('[data-testid="timeline"]')).toBeNull();
      await click(btn('to-horizon')); expect(q('[data-testid="horizon"]')).not.toBeNull();
      await click(btn('to-table')); expect(q('[data-testid="table"]')).not.toBeNull();
      cleanup();
      show();
      expect(q('[data-testid="table"]')).not.toBeNull();
    });
    it('copes with broken saved preferences', () => {
      localStorage.setItem('lira_roadmap_prefs', '{not json');
      show();
      expect(q('[data-testid="timeline"]')).not.toBeNull();
    });
    it('narrows the items by the filter', async () => {
      show();
      expect(q('[data-testid="shown"]')!.textContent).toBe('2');
      await click(btn('filter-none'));
      expect(q('[data-testid="shown"]')!.textContent).toBe('0');
    });
    it('collapses and expands a lane', async () => {
      show();
      await click(btn('toggle-lane')); expect(q('[data-testid="collapsed"]')!.textContent).toBe('Core');
      await click(btn('toggle-lane')); expect(q('[data-testid="collapsed"]')!.textContent).toBe('');
    });
    it('scrolls to today when asked', async () => {
      show();
      await click(btn('today'));
      expect(q('[data-testid="todaykey"]')!.textContent).toBe('1');
    });
    it('shows the summary', () => {
      show();
      expect(q('[data-testid="summary"]')).not.toBeNull();
    });
  });

  describe('dependency problems', () => {
    it('shows no banner when dates agree', () => {
      show();
      expect(document.body.textContent).not.toContain('dependency problem');
    });
    it('counts an epic that starts before what it depends on has finished, singular and plural', () => {
      show(roadmap({ items: [item(), item({ id: 'i2', start: '2026-11-05', end: '2026-11-12', deps: ['i1'] })] }));
      expect(document.body.textContent).toContain('1 dependency problem:');
      cleanup();
      show(roadmap({ items: [item(), item({ id: 'i2', start: '2026-11-05', end: '2026-11-12', deps: ['i1'] }), item({ id: 'i3', start: '2026-11-06', end: '2026-11-12', deps: ['i1'] })] }));
      expect(document.body.textContent).toContain('2 dependency problems:');
    });
  });

  describe('editing items', () => {
    it('opens an existing epic for editing and a missing one does nothing', async () => {
      show();
      await click(btn('open-missing'));
      expect(q('[data-testid="item-modal"]')).toBeNull();
      await click(btn('open-item'));
      expect(q('[data-testid="item-title"]')!.textContent).toBe('Epic one');
      expect(q('[data-testid="item-new"]')!.textContent).toBe('false');
    });
    it('starts a new epic from the Add epic button', async () => {
      show();
      await click(btn(/Add epic/));
      expect(q('[data-testid="item-new"]')!.textContent).toBe('true');
      expect(q('[data-testid="item-title"]')!.textContent).toBe('');
    });
    it('closes without saving', async () => {
      show();
      await click(btn('open-item')); await click(btn('close-item'));
      expect(q('[data-testid="item-modal"]')).toBeNull();
      expect(h.update).not.toHaveBeenCalled();
    });
    it('saves dates changed by dragging and pushes them to the epic', async () => {
      show();
      await click(btn('drag'));
      expect(after().items[0].end).toBe('2026-11-30');
      expect(h.svc.syncEpicFromItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', end: '2026-11-30' }));
    });
    it('creates a new epic in the space, adds a new lane, shows a notice and a saved card', async () => {
      show();
      await click(btn('open-item')); await click(btn('save-new-epic'));
      expect(h.svc.createEpicForItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }), SPACES[0], 'My Plan');
      expect(h.svc.syncEpicFromItem).not.toHaveBeenCalled();
      const r = after();
      expect(r.lanes).toEqual(['Core', 'Fresh']);
      expect(r.items.find(i => i.id === 'i1')!.epicKey).toBe('AAA-9');
      expect(document.body.textContent).toContain('Created epic AAA-9 in Alpha. It is in the Backlog.');
      expect(h.saved).toHaveBeenCalledWith('Roadmap item saved');
      expect(q('[data-testid="item-modal"]')).toBeNull();
    });
    it('links an existing epic and tells the epic if the status changed', async () => {
      show();
      await click(btn('open-item')); await click(btn('save-existing'));
      expect(after().items[0].epicKey).toBe('AAA-5');
      expect(h.svc.syncEpicFromItem).toHaveBeenCalledWith(expect.objectContaining({ epicKey: 'AAA-5' }), { status: true });
      expect(document.body.textContent).toContain('Linked epic AAA-5.');
    });
    it('adds a brand-new item to the list', async () => {
      show();
      await click(btn(/Add epic/)); await click(btn('save-keep'));
      expect(after().items).toHaveLength(3);
    });
    it('keeps the checklist on one task under the epic', async () => {
      show(roadmap({ items: [item({ epicKey: 'AAA-1' })] }));
      await click(btn('open-item')); await click(btn('save-with-checklist'));
      expect(h.svc.ensureTaskForItem).toHaveBeenCalled();
      expect(h.svc.syncTaskFromItem).toHaveBeenCalledWith(expect.objectContaining({ taskKey: 'AAA-10' }));
      expect(after().items[0].taskKey).toBe('AAA-10');
    });
    it('keeps an existing task in step when there is no checklist', async () => {
      show();
      await click(btn('open-item')); await click(btn('save-with-task'));
      expect(h.svc.ensureTaskForItem).not.toHaveBeenCalled();
      expect(h.svc.syncTaskFromItem).toHaveBeenCalledWith(expect.objectContaining({ taskKey: 'AAA-2' }));
    });
    it('shows the error and saves nothing when the epic cannot be created', async () => {
      h.svc.createEpicForItem.mockRejectedValueOnce(new Error('No room'));
      show();
      await click(btn('open-item')); await click(btn('save-new-epic'));
      expect(document.body.textContent).toContain('No room');
      expect(h.update).not.toHaveBeenCalled();
      expect(q('[data-testid="item-modal"]')).not.toBeNull();
      await click(q('button[aria-label="Dismiss"]'));
      expect(document.body.textContent).not.toContain('No room');
    });
    it('refuses a new epic when the roadmap has no space', async () => {
      show(roadmap({ spaceKey: undefined }));
      await click(btn('open-item')); await click(btn('save-new-epic'));
      expect(document.body.textContent).toContain('This roadmap has no space to create the epic in.');
      expect(h.svc.createEpicForItem).not.toHaveBeenCalled();
    });
    it('removes an item and every dependency on it', async () => {
      show();
      await click(btn('open-item')); await click(btn('delete-item'));
      const r = after();
      expect(r.items.map(i => i.id)).toEqual(['i2']);
      expect(r.items[0].deps).toEqual([]);
      expect(q('[data-testid="item-modal"]')).toBeNull();
    });
    it('opens the epic ticket after closing the dialog', async () => {
      const seen = vi.fn();
      window.addEventListener('lira-open-issue', seen);
      show();
      await click(btn('open-item')); await click(btn('open-epic'));
      expect(q('[data-testid="item-modal"]')).toBeNull();
      await act(async () => { await wait(5); });
      expect(seen).toHaveBeenCalled();
      expect((seen.mock.calls[0][0] as CustomEvent).detail).toEqual(ISSUES[0]);
      window.removeEventListener('lira-open-issue', seen);
    });
  });

  describe('milestones', () => {
    it('adds one from the Milestone button', async () => {
      show();
      await click(btn(/^\s*Milestone/));
      expect(q('[data-testid="ms-new"]')!.textContent).toBe('true');
    });
    it('opens an existing one and ignores a missing one', async () => {
      show();
      await click(btn('open-ms-missing'));
      expect(q('[data-testid="ms-modal"]')).toBeNull();
      await click(btn('open-ms'));
      expect(q('[data-testid="ms-new"]')!.textContent).toBe('false');
    });
    it('saves a changed milestone, and gives a new one an id', async () => {
      show();
      await click(btn('open-ms')); await click(btn('save-ms'));
      expect(after().milestones).toEqual([expect.objectContaining({ id: 'm1', title: 'Launch' })]);
      expect(h.saved).toHaveBeenCalledWith('Milestone saved');
      await click(btn(/^\s*Milestone/)); await click(btn('save-ms-blank-id'));
      const added = after().milestones.at(-1)!;
      expect(added.title).toBe('Fresh');
      expect(added.id).toMatch(/^ms/);
    });
    it('deletes a milestone', async () => {
      show();
      await click(btn('open-ms')); await click(btn('delete-ms'));
      expect(after().milestones).toEqual([]);
      expect(q('[data-testid="ms-modal"]')).toBeNull();
    });
    it('closes without saving', async () => {
      show();
      await click(btn('open-ms')); await click(btn('close-ms'));
      expect(q('[data-testid="ms-modal"]')).toBeNull();
      expect(h.update).not.toHaveBeenCalled();
    });
  });

  describe('planner actions', () => {
    it('moves a ticket, opens a ticket and adds a ticket to an epic', async () => {
      const seen = vi.fn();
      window.addEventListener('lira-open-issue', seen);
      show();
      await click(btn('to-planner'));
      await click(btn('move-ticket')); expect(h.svc.setTicketDate).toHaveBeenCalledWith({ id: 1 }, '2026-11-12');
      await click(btn('open-issue')); expect(seen).toHaveBeenCalled();
      await click(btn('add-ticket')); expect(h.svc.addTicketToEpic).toHaveBeenCalledWith('AAA-1', 'New thing');
      window.removeEventListener('lira-open-issue', seen);
    });
  });

  describe('export', () => {
    it('downloads a CSV named after the roadmap and the day', async () => {
      const create = vi.fn(() => 'blob:x');
      const revoke = vi.fn();
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
      const names: string[] = [];
      const click_ = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { names.push(this.download); };
      show();
      await click(btn(/Export CSV/));
      HTMLAnchorElement.prototype.click = click_;
      expect(create).toHaveBeenCalledWith(expect.any(Blob));
      expect(names[0]).toMatch(/^my-plan-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(revoke).toHaveBeenCalledWith('blob:x');
    });
  });

  it('has the expected number of buttons in the header', () => {
    show();
    expect(qa('button').filter(b => /All roadmaps|Export CSV|Milestone|Add epic/.test(b.textContent ?? ''))).toHaveLength(4);
  });
});
