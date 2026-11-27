import { describe, expect, it } from 'vitest';
import { makeIssue } from '../../test/factories';
import { effectiveStatus, epicFor, epicStatusFor, epicTickets, horizonOf, itemChecklist, itemProgress, resolveItem, statusFromEpic, ticketDate } from './progress';
import type { RoadmapItem } from './types';

const item = (over: Partial<RoadmapItem> = {}): RoadmapItem => ({ id: 'a', title: 'A', lane: 'L', status: 'planned', start: '2026-11-10', end: '2026-11-20', progress: 0, deps: [], children: [], ...over });
const epic = makeIssue({ id: 1, key: 'E-1', type: 'epic', status: 'todo' });
const task = (id: number, status: string, over: object = {}) => makeIssue({ id, key: `E-${id}`, type: 'task', status, parentId: 1, ...over });
const TODAY = new Date(2026, 10, 15);

describe('status and board status', () => {
  it('maps the status of an epic on the board to a roadmap status, Backlog and To do both being planned', () => {
    expect(statusFromEpic('done')).toBe('done');
    expect(statusFromEpic('DONE')).toBe('done');
    expect(statusFromEpic('inprogress')).toBe('inprogress');
    expect(statusFromEpic('todo')).toBe('planned');
    expect(statusFromEpic('backlog')).toBe('planned');
    expect(statusFromEpic(undefined)).toBe('planned');
  });
  it('gives a new epic the board status that matches the roadmap status: Backlog unless the work is running or finished', () => {
    expect(epicStatusFor('done')).toBe('done');
    expect(epicStatusFor('inprogress')).toBe('inprogress');
    for (const s of ['planned', 'atrisk', 'blocked'] as const) expect(epicStatusFor(s)).toBe('backlog');
  });
});

describe('finding the epic and its tickets', () => {
  it('finds the epic by key, and only an epic', () => {
    expect(epicFor(item({ epicKey: 'E-1' }), [epic])).toBe(epic);
    expect(epicFor(item({ epicKey: 'E-1' }), [{ ...epic, type: 'task' }])).toBeUndefined();
    expect(epicFor(item(), [epic])).toBeUndefined();
  });
  it('lists the tasks and bugs under an epic by parent or by epic, and leaves out subtasks and other epics', () => {
    const viaEpicId = makeIssue({ id: 9, key: 'E-9', type: 'bug', epicId: 1 });
    const sub = makeIssue({ id: 8, key: 'E-8', type: 'subtask', parentId: 2 });
    const other = makeIssue({ id: 7, key: 'X-7', type: 'task', parentId: 99 });
    expect(epicTickets(epic, [epic, task(2, 'todo'), viaEpicId, sub, other]).map(i => i.key)).toEqual(['E-2', 'E-9']);
    expect(epicTickets(undefined, [task(2, 'todo')])).toEqual([]);
  });
});

describe('the checklist of an item', () => {
  it('is the subtasks of the linked task, so ticking one on the ticket shows here, else the list saved with the item', () => {
    const carrier = task(2, 'todo', { subtasks: [{ id: 's1', title: 'One', completed: true, createdAt: new Date() }, { id: 's2', title: 'Two', completed: false, createdAt: new Date() }] });
    expect(itemChecklist(item({ taskKey: 'E-2' }), [carrier])).toEqual([{ id: 's1', title: 'One', done: true }, { id: 's2', title: 'Two', done: false }]);
    const saved = [{ id: 'c1', title: 'Saved', done: false }];
    expect(itemChecklist(item({ children: saved }), [carrier])).toBe(saved);
    expect(itemChecklist(item({ taskKey: 'E-404', children: saved }), [carrier])).toBe(saved);
  });
});

describe('how far along an item is', () => {
  it('counts each ticket under the epic as done or not, as a share', () => {
    const all = [epic, task(2, 'done'), task(3, 'todo'), task(4, 'done'), task(5, 'inprogress')];
    expect(itemProgress(item({ epicKey: 'E-1' }), all)).toBe(50);
  });
  it('counts the checklist task as the share of its subtasks that are ticked', () => {
    const carrier = task(2, 'todo', { subtasks: [{ id: 's1', title: 'a', completed: true, createdAt: new Date() }, { id: 's2', title: 'b', completed: false, createdAt: new Date() }, { id: 's3', title: 'c', completed: true, createdAt: new Date() }, { id: 's4', title: 'd', completed: true, createdAt: new Date() }] });
    expect(itemProgress(item({ epicKey: 'E-1', taskKey: 'E-2' }), [epic, carrier, task(3, 'done')])).toBe(88); // (0.75 + 1) / 2
  });
  it('is 100 for a finished epic with no tickets, then the saved checklist, then the number typed by hand within 0 to 100', () => {
    expect(itemProgress(item({ epicKey: 'E-1' }), [{ ...epic, status: 'done' }])).toBe(100);
    expect(itemProgress(item({ children: [{ id: 'c1', title: 'a', done: true }, { id: 'c2', title: 'b', done: false }] }))).toBe(50);
    expect(itemProgress(item({ progress: 40 }))).toBe(40);
    expect(itemProgress(item({ progress: 400 }))).toBe(100);
    expect(itemProgress(item({ progress: -5 }))).toBe(0);
  });
});

describe('the status to show', () => {
  it('is Done when finished, by status or by progress', () => {
    expect(effectiveStatus(item({ status: 'done' }), 0, TODAY)).toBe('done');
    expect(effectiveStatus(item(), 100, TODAY)).toBe('done');
  });
  it('is At risk when the end has passed and the work is not finished, and not on the last day itself', () => {
    expect(effectiveStatus(item({ end: '2026-11-14' }), 20, TODAY)).toBe('atrisk');
    expect(effectiveStatus(item({ end: '2026-11-15' }), 20, TODAY)).toBe('planned');
  });
  it('keeps a Blocked or At risk flag that was set by hand, over the status of the epic', () => {
    expect(effectiveStatus(item({ status: 'blocked' }), 10, TODAY, 'inprogress')).toBe('blocked');
    expect(effectiveStatus(item({ status: 'atrisk' }), 10, TODAY, 'inprogress')).toBe('atrisk');
  });
  it('follows the epic\'s board status when there is one and nothing was flagged by hand', () => {
    expect(effectiveStatus(item(), 10, TODAY, 'inprogress')).toBe('inprogress');
    expect(effectiveStatus(item({ status: 'inprogress' }), 10, TODAY, 'todo')).toBe('planned');
  });
  it('resolves an item as its epic, its progress and its status together, and shows an epic switched to Blocked as Blocked unless it is done', () => {
    const r = resolveItem(item({ epicKey: 'E-1' }), [epic, task(2, 'done'), task(3, 'todo')], TODAY);
    expect(r).toMatchObject({ progress: 50, status: 'planned' });
    expect(r.epic).toBe(epic);
    expect(resolveItem(item({ epicKey: 'E-1' }), [{ ...epic, blocked: true }, task(2, 'todo')], TODAY).status).toBe('blocked');
    expect(resolveItem(item({ epicKey: 'E-1' }), [{ ...epic, blocked: true, status: 'done' }], TODAY).status).toBe('done');
  });
});

describe('which column an item belongs in', () => {
  it('puts finished work in Done, work that has started or starts this week in Now, then Next up to about two months out, then Later', () => {
    expect(horizonOf(item(), 'done', TODAY)).toBe('done');
    expect(horizonOf(item({ start: '2026-11-01' }), 'inprogress', TODAY)).toBe('now');
    expect(horizonOf(item({ start: '2026-11-22' }), 'planned', TODAY)).toBe('now');
    expect(horizonOf(item({ start: '2026-11-23' }), 'planned', TODAY)).toBe('next');
    expect(horizonOf(item({ start: '2027-01-16' }), 'planned', TODAY)).toBe('next');
    expect(horizonOf(item({ start: '2027-01-17' }), 'planned', TODAY)).toBe('later');
  });
});

describe('where a ticket sits on a calendar', () => {
  it('is its due date, scheduled', () => {
    expect(ticketDate(makeIssue({ dueDate: new Date(2026, 10, 9, 18) }))).toEqual({ date: new Date(2026, 10, 9), scheduled: true });
  });
  it('is the first of its sprint month when it has no due date, not scheduled', () => {
    expect(ticketDate(makeIssue({ dueDate: undefined, sprint: '2026-12' }))).toEqual({ date: new Date(2026, 11, 1), scheduled: false });
  });
  it('is the first of the month it was made when it has neither', () => {
    expect(ticketDate(makeIssue({ dueDate: undefined, sprint: undefined, createdAt: new Date(2026, 8, 17) }))).toEqual({ date: new Date(2026, 8, 1), scheduled: false });
  });
});
