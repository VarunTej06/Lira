import { describe, expect, it } from 'vitest';
import type { Issue } from '../../types/issue';
import type { RoadmapItem } from '../../utils/roadmapUtils';
import { dragTip, dropAction, liveItem, type Drag } from './plannerDrag';

const item: RoadmapItem = { id: 'i1', title: 'Board', lane: 'Core', status: 'planned', start: '2026-11-10', end: '2026-11-20', progress: 0, deps: [], children: [] };
const ticket = { id: 7, key: 'LIRA-7', dueDate: new Date(2026, 10, 12), createdAt: new Date(2026, 10, 1) } as Issue;

const drag = (over: Partial<Drag> = {}): Drag => ({ kind: 'epic', id: 'i1', mode: 'move', originX: 0, originScroll: 0, delta: 0, moved: false, x: 0, y: 0, ...over });

describe('liveItem', () => {
  it('is the item itself when nothing is being dragged, or something else is', () => {
    expect(liveItem(item, null)).toBe(item);
    expect(liveItem(item, drag({ id: 'other', delta: 3 }))).toBe(item);
    expect(liveItem(item, drag({ kind: 'ticket', id: 'i1', delta: 3 }))).toBe(item);
    expect(liveItem(item, drag({ delta: 0 }))).toBe(item);
  });

  it('moves both dates when the bar is dragged', () => {
    expect(liveItem(item, drag({ delta: 3 }))).toMatchObject({ start: '2026-11-13', end: '2026-11-23' });
    expect(liveItem(item, drag({ delta: -2 }))).toMatchObject({ start: '2026-11-08', end: '2026-11-18' });
  });

  it('moves only the start or only the end when an edge is dragged', () => {
    expect(liveItem(item, drag({ mode: 'start', delta: 2 }))).toMatchObject({ start: '2026-11-12', end: '2026-11-20' });
    expect(liveItem(item, drag({ mode: 'end', delta: 2 }))).toMatchObject({ start: '2026-11-10', end: '2026-11-22' });
  });
});

describe('dragTip', () => {
  it('shows nothing until the pointer has moved', () => {
    expect(dragTip(null, [item], [ticket])).toBeNull();
    expect(dragTip(drag({ moved: false }), [item], [ticket])).toBeNull();
  });

  it('shows the new dates of an epic', () => {
    expect(dragTip(drag({ moved: true, delta: 3 }), [item], [ticket])).toMatch(/→/);
  });

  it('shows the new date of a ticket', () => {
    expect(dragTip(drag({ kind: 'ticket', id: 7, moved: true, delta: 2 }), [item], [ticket])).toMatch(/Sat, Nov 14|Nov 14/);
  });

  it('shows nothing when what is dragged cannot be found', () => {
    expect(dragTip(drag({ moved: true, delta: 1, id: 'gone' }), [item], [ticket])).toBeNull();
    expect(dragTip(drag({ kind: 'ticket', id: 99, moved: true, delta: 1 }), [item], [ticket])).toBeNull();
  });
});

describe('dropAction', () => {
  it('a press and release without moving opens the epic or the ticket', () => {
    expect(dropAction(drag(), [item], [ticket])).toEqual({ type: 'openItem', id: 'i1' });
    expect(dropAction(drag({ kind: 'ticket', id: 7 }), [item], [ticket])).toEqual({ type: 'openIssue', issue: ticket });
  });

  it('moving and coming back to the start counts as a click', () => {
    expect(dropAction(drag({ moved: true, delta: 0 }), [item], [ticket])).toEqual({ type: 'openItem', id: 'i1' });
  });

  it('a real move changes the epic', () => {
    const action = dropAction(drag({ moved: true, delta: 4 }), [item], [ticket]);
    expect(action).toMatchObject({ type: 'changeItem', item: { start: '2026-11-14', end: '2026-11-24' } });
  });

  it('a real edge drag resizes the epic', () => {
    expect(dropAction(drag({ moved: true, mode: 'end', delta: -3 }), [item], [ticket])).toMatchObject({ type: 'changeItem', item: { start: '2026-11-10', end: '2026-11-17' } });
  });

  it('a real move gives the ticket a new due date', () => {
    const action = dropAction(drag({ kind: 'ticket', id: 7, moved: true, delta: 5 }), [item], [ticket]);
    expect(action).toMatchObject({ type: 'moveTicket', issue: ticket });
    expect((action as { date: Date }).date.getDate()).toBe(17);
  });

  it('does nothing when what was dragged no longer exists', () => {
    expect(dropAction(drag({ id: 'gone', moved: true, delta: 2 }), [item], [ticket])).toBeNull();
    expect(dropAction(drag({ kind: 'ticket', id: 99 }), [item], [ticket])).toBeNull();
  });
});
