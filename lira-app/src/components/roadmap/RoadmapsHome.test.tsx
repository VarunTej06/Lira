import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Space } from '../../types/space';
import type { Roadmap } from '../../utils/roadmapUtils';
import { byText, choose, cleanup, click, mount, q, qa, typeInto } from '../../test/render';

const h = vi.hoisted(() => ({
  list: [] as unknown[], update: vi.fn(), add: vi.fn(), remove: vi.fn(), prompt: vi.fn(), confirm: vi.fn(),
}));
vi.mock('../../hooks/useRoadmaps', () => ({ useRoadmaps: () => ({ roadmaps: h.list, update: h.update, add: h.add, remove: h.remove }) }));
vi.mock('../common/dialogStore', () => ({ promptDialog: h.prompt, confirmDialog: h.confirm }));
vi.mock('./RoadmapModals', () => ({ NewRoadmapModal: ({ onClose, onCreate }: { onClose: () => void; onCreate: (r: unknown) => void }) => <div data-testid="new-modal"><button onClick={() => onCreate({ id: 'fresh' })}>make</button><button onClick={onClose}>close-new</button></div> }));

import { RoadmapsHome } from './RoadmapsHome';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 10, 10, 0, 0));
  vi.clearAllMocks();
  h.confirm.mockResolvedValue(true);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const item = (id: string, status: string, start = '2026-11-01', end = '2026-11-20', over: object = {}) => ({ id, title: id, lane: 'Core', status, start, end, progress: status === 'done' ? 100 : 0, owner: 'VY', deps: [], children: [], ...over });
const rm = (id: string, over: Partial<Roadmap> = {}): Roadmap => ({
  id, name: `Plan ${id}`, description: '', spaceKey: 'AAA', lanes: ['Core', 'Ops'], milestones: [], items: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z', ...over,
}) as unknown as Roadmap;
const SPACES = [{ id: 1, key: 'AAA', name: 'Alpha' }] as unknown as Space[];

function show(list: Roadmap[]) {
  h.list = list;
  const onOpen = vi.fn();
  mount(<RoadmapsHome issues={[]} spaces={SPACES} onOpen={onOpen} />);
  return onOpen;
}
const cards = () => qa('[role="button"][tabindex="0"]');
const names = () => cards().map(c => q('h3', c)!.textContent);
const tab = (t: string) => byText('button', new RegExp(`^${t}`))!;

describe('RoadmapsHome', () => {
  describe('summary tiles', () => {
    it('counts roadmaps, epics, average progress and epics needing attention (archived ones left out)', () => {
      show([
        rm('a', { items: [item('i1', 'done'), item('i2', 'inprogress')] as never }),
        rm('b', { items: [item('i3', 'blocked')] as never }),
        rm('c', { archived: true, items: [item('i4', 'blocked')] as never }),
      ]);
      const text = document.body.textContent!;
      expect(text).toContain('Roadmaps');
      expect(text).toContain('1 archived');
      expect(text).toContain('Epics planned');
      expect(text).toContain('Average progress');
      expect(text).toContain('late or blocked epics');
    });
    it('shows zeros with no roadmaps', () => {
      show([]);
      expect(qa('.text-2xl')).toHaveLength(4);
      expect(document.body.textContent).toContain('0 archived');
    });
  });

  describe('list', () => {
    it('says so when there are no roadmaps and offers to create one', async () => {
      show([]);
      expect(document.body.textContent).toContain('No roadmaps yet');
      await click(qa('button').filter(b => b.textContent!.trim() === 'Create roadmap').at(-1));
      expect(q('[data-testid="new-modal"]')).not.toBeNull();
    });
    it('says "No roadmaps match" when the search finds nothing, without a create button', async () => {
      show([rm('a')]);
      await typeInto(q<HTMLInputElement>('input[placeholder="Search roadmaps"]'), 'zzz');
      expect(document.body.textContent).toContain('No roadmaps match');
      expect(qa('button').filter(b => b.textContent!.trim() === 'Create roadmap')).toHaveLength(1);
    });
    it('searches name, description and space key', async () => {
      show([rm('a', { name: 'Alpha plan' }), rm('b', { name: 'Beta', description: 'launch stuff', spaceKey: 'ZZZ' })]);
      const box = q<HTMLInputElement>('input[placeholder="Search roadmaps"]');
      await typeInto(box, 'LAUNCH');
      expect(names()).toEqual(['Beta']);
      await typeInto(box, 'aaa');
      expect(names()).toEqual(['Alpha plan']);
    });
    it('has Active, Starred and Archived tabs with counts', async () => {
      show([rm('a'), rm('b', { starred: true }), rm('c', { archived: true })]);
      expect(tab('active').textContent).toContain('2');
      expect(tab('starred').textContent).toContain('1');
      expect(tab('archived').textContent).toContain('1');
      await click(tab('starred'));
      expect(names()).toEqual(['Plan b']);
      await click(tab('archived'));
      expect(names()).toEqual(['Plan c']);
      expect(cards()[0].className).toContain('opacity-75');
    });
    it('sorts by recently updated, name or progress', async () => {
      show([
        rm('a', { name: 'Zed', updatedAt: '2026-10-01T00:00:00.000Z', items: [item('i1', 'done')] as never }),
        rm('b', { name: 'Amy', updatedAt: '2026-10-09T00:00:00.000Z', items: [item('i2', 'todo')] as never }),
      ]);
      expect(names()).toEqual(['Amy', 'Zed']);
      const sel = q<HTMLSelectElement>('select[aria-label="Sort roadmaps"]');
      await choose(sel, 'name');
      expect(names()).toEqual(['Amy', 'Zed']);
      await choose(sel, 'progress');
      expect(names()).toEqual(['Zed', 'Amy']);
    });
  });

  describe('card', () => {
    it('shows the space or "No space", the description or a placeholder, lanes and dates', () => {
      show([rm('a', { description: 'About it', items: [item('i1', 'planned', '2026-11-01', '2026-11-20')] as never }), rm('b', { spaceKey: undefined })]);
      const text = document.body.textContent!;
      expect(text).toContain('Alpha');
      expect(text).toContain('No space');
      expect(text).toContain('About it');
      expect(text).toContain('No description');
      expect(text).toContain('2 lanes');
      expect(text).toContain('No dates');
      expect(text).toContain('→');
    });
    it('shows epics done, status chips, and "Empty roadmap" with no epics', () => {
      show([rm('a', { items: [item('i1', 'done'), item('i2', 'inprogress')] as never }), rm('b')]);
      expect(document.body.textContent).toMatch(/of \d+ epics done/);
      expect(document.body.textContent).toContain('Empty roadmap');
    });
    it('shows the next milestone with the days to it', () => {
      show([rm('a', { milestones: [{ id: 'm', title: 'Launch', date: '2026-11-15', kind: 'milestone' }] as never })]);
      expect(document.body.textContent).toContain('5d: Launch');
    });
    it('opens on click and on Enter', async () => {
      const onOpen = show([rm('a')]);
      await click(cards()[0]);
      expect(onOpen).toHaveBeenCalledWith('a');
    });
    it('stars and unstars without opening', async () => {
      const onOpen = show([rm('a')]);
      await click(q('button[aria-label="Star roadmap"]'));
      expect(h.update).toHaveBeenCalledWith('a', expect.any(Function));
      expect(h.update.mock.calls[0][1](rm('a')).starred).toBe(true);
      expect(onOpen).not.toHaveBeenCalled();
    });
  });

  describe('card menu', () => {
    const open = async () => { await click(q('button[aria-label="Roadmap actions"]')); };
    it('opens from the ... button without opening the roadmap, and closes on a click elsewhere', async () => {
      const onOpen = show([rm('a')]);
      await open();
      expect(byText('button', 'Rename')).toBeDefined();
      expect(onOpen).not.toHaveBeenCalled();
      await click(q('h1'));
      expect(byText('button', 'Rename')).toBeUndefined();
    });
    it('renames, ignoring an empty answer', async () => {
      show([rm('a')]);
      h.prompt.mockResolvedValueOnce('New');
      await open(); await click(byText('button', 'Rename'));
      expect(h.update.mock.calls[0][1](rm('a')).name).toBe('New');
      h.update.mockClear();
      h.prompt.mockResolvedValueOnce(null);
      await open(); await click(byText('button', 'Rename'));
      expect(h.update).not.toHaveBeenCalled();
    });
    it('duplicates', async () => {
      show([rm('a')]);
      await open(); await click(byText('button', 'Duplicate'));
      expect(h.add).toHaveBeenCalledWith(expect.objectContaining({ name: expect.stringContaining('Plan a') }));
    });
    it('archives, and unarchives an archived one', async () => {
      show([rm('a')]);
      await open(); await click(byText('button', 'Archive'));
      expect(h.update.mock.calls[0][1](rm('a')).archived).toBe(true);
      cleanup();
      show([rm('a', { archived: true })]);
      await click(tab('archived'));
      await open();
      expect(byText('button', 'Unarchive')).toBeDefined();
    });
    it('deletes only after a yes', async () => {
      show([rm('a')]);
      h.confirm.mockResolvedValueOnce(false);
      await open(); await click(byText('button', 'Delete'));
      expect(h.remove).not.toHaveBeenCalled();
      await open(); await click(byText('button', 'Delete'));
      expect(h.confirm).toHaveBeenLastCalledWith(expect.objectContaining({ tone: 'danger', message: expect.stringContaining('"Plan a"') }));
      expect(h.remove).toHaveBeenCalledWith('a');
    });
  });

  describe('create', () => {
    it('creates a roadmap, saves it and opens it', async () => {
      const onOpen = show([rm('a')]);
      await click(byText('button', /Create roadmap/));
      await click(byText('button', 'make'));
      expect(h.add).toHaveBeenCalledWith({ id: 'fresh' });
      expect(onOpen).toHaveBeenCalledWith('fresh');
      expect(q('[data-testid="new-modal"]')).toBeNull();
    });
    it('closes the dialog without creating', async () => {
      show([rm('a')]);
      await click(byText('button', /Create roadmap/));
      await click(byText('button', 'close-new'));
      expect(q('[data-testid="new-modal"]')).toBeNull();
      expect(h.add).not.toHaveBeenCalled();
    });
  });
});
