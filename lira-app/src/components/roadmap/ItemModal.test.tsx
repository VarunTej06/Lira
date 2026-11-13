import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import type { Roadmap, RoadmapItem } from '../../utils/roadmapUtils';
import { byText, choose, cleanup, click, mount, q, qa, typeInto } from '../../test/render';
import { ItemModal } from './RoadmapModals';

afterEach(cleanup);

const space = { id: 1, key: 'LIRA', name: 'Lira', icon: 'L', color: '#000000', createdAt: new Date(0), updatedAt: new Date(0) } as Space;
const epic = (id: number, key: string, title: string, spaceId = 1) => ({ id, key, title, type: 'epic', spaceId } as Issue);

const item = (over: Partial<RoadmapItem> = {}): RoadmapItem => ({
  id: 'i1', title: 'Board v2', lane: 'Core', status: 'planned', start: '2026-11-01', end: '2026-11-30', progress: 40,
  deps: [], children: [], ...over,
});
const roadmap = (items: RoadmapItem[] = []): Roadmap => ({ id: 'r1', name: 'Plan', lanes: ['Core', 'Growth'], items, milestones: [], spaceKey: 'LIRA' } as unknown as Roadmap);

function open(over: Partial<Parameters<typeof ItemModal>[0]> = {}) {
  const h = { onSave: vi.fn(), onDelete: vi.fn(), onOpenEpic: vi.fn(), onClose: vi.fn() };
  const it = over.item === undefined ? item() : over.item;
  mount(<ItemModal roadmap={roadmap(it ? [it] : [])} item={it} isNew={false} issues={[]} space={space} {...h} {...over} />);
  return h;
}
const save = () => byText('button', /Save changes|Add item/) as HTMLButtonElement;
const field = (labelText: string) => qa('label').find(l => l.textContent?.startsWith(labelText))!.parentElement!;

describe('ItemModal', () => {
  it('renders nothing when there is no item', () => {
    open({ item: null });
    expect(document.body.textContent).not.toContain('roadmap item');
  });

  it('has a title that says whether the item is new', () => {
    open({ isNew: true });
    expect(document.body.textContent).toContain('Add roadmap item (epic)');
    expect(save().textContent).toBe('Add item');
    cleanup();
    open();
    expect(document.body.textContent).toContain('Edit roadmap item');
    expect(save().textContent).toBe('Save changes');
  });

  describe('the epic behind the item', () => {
    it('says which epic the item is when it has one, and can open it', async () => {
      const h = open({ item: item({ epicKey: 'LIRA-9' }) });
      expect(document.body.textContent).toContain('This item is the epic LIRA-9');
      await click(byText('button', /Open epic/));
      expect(h.onOpenEpic).toHaveBeenCalledWith('LIRA-9');
    });

    it('offers to create a new epic in the space, or use an existing one', async () => {
      open({ issues: [epic(7, 'LIRA-7', 'Auth'), epic(8, 'OTHER-1', 'Elsewhere', 2)] });
      expect(document.body.textContent).toContain('Every roadmap item is an epic.');
      expect(document.body.textContent).toContain('Create a new epic');
      await click(qa('input[type="radio"]')[1]);
      const options = qa('select option').map(o => o.textContent);
      expect(options).toContain('LIRA-7 · Auth');
      expect(options).not.toContain('OTHER-1 · Elsewhere'); // another space
    });

    it('does not offer an epic that another item already uses', async () => {
      const other = item({ id: 'i2', title: 'Other', epicKey: 'LIRA-7' });
      mount(<ItemModal roadmap={roadmap([item(), other])} item={item()} isNew={false} issues={[epic(7, 'LIRA-7', 'Auth')]} space={space} onSave={vi.fn()} onDelete={vi.fn()} onOpenEpic={vi.fn()} onClose={vi.fn()} />);
      await click(qa('input[type="radio"]')[1]);
      expect(qa('select option').map(o => o.textContent)).not.toContain('LIRA-7 · Auth');
    });

    it('fills the title from the chosen epic when the title is empty', async () => {
      open({ item: item({ title: '' }), issues: [epic(7, 'LIRA-7', 'Auth')] });
      await click(qa('input[type="radio"]')[1]);
      await choose(q<HTMLSelectElement>('select'), 'LIRA-7');
      expect(q<HTMLInputElement>('input[placeholder="What will be delivered?"]')!.value).toBe('Auth');
    });

    it('warns when the roadmap has no space and a new epic is chosen', () => {
      open({ space: undefined });
      expect(document.body.textContent).toContain('This roadmap has no space.');
      expect(save().disabled).toBe(true);
    });
  });

  describe('when it can be saved', () => {
    it('needs a title', async () => {
      open();
      expect(save().disabled).toBe(false);
      await typeInto(q<HTMLInputElement>('input[placeholder="What will be delivered?"]'), '   ');
      expect(save().disabled).toBe(true);
    });

    it('needs the end on or after the start, and says so', () => {
      open({ item: item({ start: '2026-11-10', end: '2026-11-01' }) });
      expect(document.body.textContent).toContain('End must be on or after the start');
      expect(save().disabled).toBe(true);
    });

    it('needs a name for a new lane', async () => {
      open();
      await choose(field('Lane').querySelector('select'), '__new');
      expect(save().disabled).toBe(true);
      await typeInto(q<HTMLInputElement>('input[placeholder="Lane name"]'), 'Research');
      expect(save().disabled).toBe(false);
    });

    it('needs an epic to be chosen when "use an existing epic" is picked', async () => {
      open({ issues: [epic(7, 'LIRA-7', 'Auth')] });
      await click(qa('input[type="radio"]')[1]);
      expect(save().disabled).toBe(true);
      await choose(q<HTMLSelectElement>('select'), 'LIRA-7');
      expect(save().disabled).toBe(false);
    });
  });

  describe('what is saved', () => {
    it('keeps an existing epic, trims the title, and marks a changed status', async () => {
      const h = open({ item: item({ epicKey: 'LIRA-9', title: 'Board v2' }) });
      await typeInto(q<HTMLInputElement>('input[placeholder="What will be delivered?"]'), '  Board v3  ');
      await choose(field('Status').querySelector('select'), 'done');
      await click(save());
      const [saved, opts] = h.onSave.mock.calls[0];
      expect(saved.title).toBe('Board v3');
      expect(saved.status).toBe('done');
      expect(opts).toMatchObject({ epicMode: 'keep', statusChanged: true, existingKey: undefined, newLane: undefined });
    });

    it('does not count the status as changed on a new item', async () => {
      const h = open({ isNew: true });
      await choose(field('Status').querySelector('select'), 'done');
      await click(save());
      expect(h.onSave.mock.calls[0][1]).toMatchObject({ epicMode: 'new', statusChanged: false });
    });

    it('sends the new lane name and the chosen existing epic', async () => {
      const h = open({ issues: [epic(7, 'LIRA-7', 'Auth')] });
      await choose(field('Lane').querySelector('select'), '__new');
      await typeInto(q<HTMLInputElement>('input[placeholder="Lane name"]'), ' Research ');
      await click(qa('input[type="radio"]')[1]);
      await choose(q<HTMLSelectElement>('select'), 'LIRA-7');
      await click(save());
      const [saved, opts] = h.onSave.mock.calls[0];
      expect(saved.lane).toBe('Research');
      expect(opts).toMatchObject({ newLane: 'Research', epicMode: 'existing', existingKey: 'LIRA-7' });
    });
  });

  describe('checklist', () => {
    it('adds an item with Enter or the plus button, ignoring blanks', async () => {
      const h = open();
      const box = q<HTMLInputElement>('input[placeholder="Add a checklist item"]')!;
      await typeInto(box, '   ');
      await click(q('button[aria-label="Add checklist item"]'));
      expect(document.body.textContent).not.toContain('0/');
      await typeInto(box, 'Write tests');
      await click(q('button[aria-label="Add checklist item"]'));
      expect(document.body.textContent).toContain('Write tests');
      expect(box.value).toBe('');
      await click(save());
      expect(h.onSave.mock.calls[0][0].children).toHaveLength(1);
    });

    it('ticks and removes items, and counts what is done', async () => {
      open({ item: item({ children: [{ id: 'c1', title: 'One', done: false }, { id: 'c2', title: 'Two', done: true }] }) });
      expect(document.body.textContent).toContain('1/2 done');
      await click(qa('input[type="checkbox"]')[0]);
      expect(document.body.textContent).toContain('2/2 done');
      await click(q('button[aria-label^="Remove checklist"]'));
      expect(document.body.textContent).toContain('1/1 done');
    });

    it('locks the progress slider when there is a checklist', () => {
      open({ item: item({ children: [{ id: 'c1', title: 'One', done: false }] }) });
      expect(q<HTMLInputElement>('input[type="range"]')!.disabled).toBe(true);
    });

    it('shows the progress percentage when it can be set by hand', () => {
      open();
      expect(q<HTMLInputElement>('input[type="range"]')!.disabled).toBe(false);
      expect(document.body.textContent).toContain('(40%)');
    });

    it('links to the task that holds the checklist', async () => {
      const h = open({ item: item({ taskKey: 'LIRA-12' }) });
      await click(byText('button', 'LIRA-12'));
      expect(h.onOpenEpic).toHaveBeenCalledWith('LIRA-12');
    });
  });

  describe('dependencies', () => {
    it('says so when there are no other items', () => {
      open();
      expect(document.body.textContent).toContain('No other items yet.');
    });

    it('ticks and unticks the items this one depends on', async () => {
      const a = item(); const b = item({ id: 'i2', title: 'Auth work', end: '2026-10-31' });
      const h = { onSave: vi.fn(), onDelete: vi.fn(), onOpenEpic: vi.fn(), onClose: vi.fn() };
      mount(<ItemModal roadmap={roadmap([a, b])} item={a} isNew={false} issues={[]} space={space} {...h} />);
      expect(document.body.textContent).toContain('ends 2026-10-31');
      const box = qa('label').find(l => l.textContent?.includes('Auth work'))!.querySelector('input')!;
      await click(box);
      await click(save());
      expect(h.onSave.mock.calls[0][0].deps).toEqual(['i2']);
    });
  });

  describe('closing and removing', () => {
    it('cancels', async () => {
      const h = open();
      await click(byText('button', 'Cancel'));
      expect(h.onClose).toHaveBeenCalled();
    });

    it('has no Remove button on a new item', () => {
      open({ isNew: true });
      expect(byText('button', /Remove/)).toBeUndefined();
    });
  });
});
