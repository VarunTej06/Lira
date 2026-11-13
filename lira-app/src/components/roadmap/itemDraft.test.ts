import { describe, expect, it } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import type { Roadmap, RoadmapItem } from '../../utils/roadmapUtils';
import { NEW_LANE, buildItemSave, checkItemDraft, type ItemDraftInput } from './itemDraft';

const space = { id: 1, key: 'LIRA' } as Space;
const epic = (id: number, key: string, spaceId = 1) => ({ id, key, title: key, type: 'epic', spaceId } as Issue);
const item = (over: Partial<RoadmapItem> = {}): RoadmapItem => ({
  id: 'i1', title: 'Board', lane: 'Core', status: 'planned', start: '2026-11-01', end: '2026-11-30', progress: 0, deps: [], children: [], ...over,
});
const roadmap = (items: RoadmapItem[] = []) => ({ id: 'r', name: 'R', lanes: ['Core'], items, milestones: [] } as unknown as Roadmap);
const input = (over: Partial<ItemDraftInput> = {}): ItemDraftInput => ({ draft: item(), roadmap: roadmap(), issues: [], space, newLane: '', epicMode: 'new', existingKey: '', ...over });

describe('checkItemDraft', () => {
  it('accepts a complete item', () => expect(checkItemDraft(input()).valid).toBe(true));

  it('needs a title that is not blank', () => {
    expect(checkItemDraft(input({ draft: item({ title: '   ' }) })).valid).toBe(false);
  });

  it('needs the end on or after the start (the same day is fine)', () => {
    expect(checkItemDraft(input({ draft: item({ start: '2026-11-05', end: '2026-11-05' }) })).datesOk).toBe(true);
    const bad = checkItemDraft(input({ draft: item({ start: '2026-11-06', end: '2026-11-05' }) }));
    expect(bad.datesOk).toBe(false);
    expect(bad.valid).toBe(false);
  });

  it('uses the typed name for a new lane and needs it filled in', () => {
    const empty = checkItemDraft(input({ draft: item({ lane: NEW_LANE }), newLane: '  ' }));
    expect(empty.laneValue).toBe('');
    expect(empty.valid).toBe(false);
    const named = checkItemDraft(input({ draft: item({ lane: NEW_LANE }), newLane: ' Research ' }));
    expect(named.laneValue).toBe('Research');
    expect(named.valid).toBe(true);
  });

  it('with an epic of its own, needs nothing more and never asks to link one', () => {
    const c = checkItemDraft(input({ draft: item({ epicKey: 'LIRA-1' }), space: undefined, epicMode: 'existing', existingKey: '' }));
    expect(c.hasEpic).toBe(true);
    expect(c.needsExisting).toBe(false);
    expect(c.valid).toBe(true);
  });

  it('a new epic needs a space; linking an existing one needs a choice instead', () => {
    expect(checkItemDraft(input({ space: undefined, epicMode: 'new' })).valid).toBe(false);
    expect(checkItemDraft(input({ space: undefined, epicMode: 'existing', existingKey: '' })).valid).toBe(false);
    expect(checkItemDraft(input({ space: undefined, epicMode: 'existing', existingKey: 'LIRA-2' })).valid).toBe(true);
  });

  it('lists the epics of the roadmap space that no other item uses', () => {
    const issues = [epic(1, 'LIRA-1'), epic(2, 'LIRA-2'), epic(3, 'OTHER-1', 2), { id: 4, key: 'LIRA-4', type: 'task', spaceId: 1 } as Issue];
    const used = item({ id: 'i2', epicKey: 'LIRA-2' });
    const c = checkItemDraft(input({ issues, roadmap: roadmap([item(), used]) }));
    expect(c.linkable.map(i => i.key)).toEqual(['LIRA-1']);
  });

  it('without a space, offers epics from every space', () => {
    const issues = [epic(1, 'LIRA-1'), epic(3, 'OTHER-1', 2)];
    expect(checkItemDraft(input({ issues, space: undefined })).linkable).toHaveLength(2);
  });

  it('an epic the item itself already uses is still offered', () => {
    const own = item({ epicKey: 'LIRA-1' });
    const c = checkItemDraft(input({ draft: own, issues: [epic(1, 'LIRA-1')], roadmap: roadmap([own]) }));
    expect(c.linkable.map(i => i.key)).toEqual(['LIRA-1']);
  });

  it('lists the other items and says whether there is a checklist', () => {
    const other = item({ id: 'i2' });
    const c = checkItemDraft(input({ roadmap: roadmap([item(), other]), draft: item({ children: [{ id: 'c', title: 'x', done: false }] }) }));
    expect(c.others).toEqual([other]);
    expect(c.hasChildren).toBe(true);
  });
});

describe('buildItemSave', () => {
  const run = (over: Partial<ItemDraftInput>, original: RoadmapItem | null = item(), isNew = false) => {
    const i = input(over);
    return buildItemSave(i, checkItemDraft(i), original, isNew);
  };

  it('trims the title and writes the final lane', () => {
    const [saved] = run({ draft: item({ title: '  Board  ', lane: NEW_LANE }), newLane: ' Research ' });
    expect(saved.title).toBe('Board');
    expect(saved.lane).toBe('Research');
  });

  it('keeps the epic it has, and otherwise follows the chosen mode', () => {
    expect(run({ draft: item({ epicKey: 'LIRA-1' }), epicMode: 'existing' })[1].epicMode).toBe('keep');
    expect(run({ epicMode: 'new' })[1].epicMode).toBe('new');
    expect(run({ epicMode: 'existing', existingKey: 'LIRA-2' })[1]).toMatchObject({ epicMode: 'existing', existingKey: 'LIRA-2' });
  });

  it('only passes the existing epic along when one is being linked', () => {
    expect(run({ epicMode: 'new', existingKey: 'LIRA-2' })[1].existingKey).toBeUndefined();
  });

  it('reports a new lane name only when a new lane was typed', () => {
    expect(run({})[1].newLane).toBeUndefined();
    expect(run({ draft: item({ lane: NEW_LANE }), newLane: 'Research' })[1].newLane).toBe('Research');
  });

  it('counts a status change only on an existing item', () => {
    const changed = item({ status: 'done' });
    expect(run({ draft: changed }, item({ status: 'planned' }), false)[1].statusChanged).toBe(true);
    expect(run({ draft: changed }, item({ status: 'done' }), false)[1].statusChanged).toBe(false);
    expect(run({ draft: changed }, item({ status: 'planned' }), true)[1].statusChanged).toBe(false);
    expect(run({ draft: changed }, null, false)[1].statusChanged).toBe(false);
  });
});
