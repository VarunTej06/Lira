import { describe, expect, it } from 'vitest';
import { makeIssue } from '../../test/factories';
import { summarize, toCsv } from './summary';
import type { Roadmap, RoadmapItem } from './types';

const item = (id: string, over: Partial<RoadmapItem> = {}): RoadmapItem => ({ id, title: id, lane: 'Build', status: 'planned', start: '2026-11-10', end: '2026-11-19', progress: 0, deps: [], children: [], ...over });
const roadmap = (items: RoadmapItem[], over: Partial<Roadmap> = {}): Roadmap => ({ id: 'rm', name: 'Plan', lanes: ['Build', 'Run'], items, milestones: [], createdAt: '2026-11-01T00:00:00Z', ...over });
const TODAY = new Date(2026, 10, 15);

describe('the numbers of a roadmap', () => {
  it('counts the items and each status, with At risk counted as overdue', () => {
    const rm = roadmap([item('a', { status: 'done' }), item('b', { end: '2026-11-12' }), item('c'), item('d', { status: 'inprogress' }), item('e', { status: 'blocked' })]);
    const s = summarize(rm, [], TODAY);
    expect(s.total).toBe(5);
    expect(s.byStatus).toEqual({ planned: 1, inprogress: 1, done: 1, atrisk: 1, blocked: 1 });
    expect(s.overdue).toBe(1);
  });
  it('averages progress weighted by how long each item is, with a finished item counting for 100', () => {
    const rm = roadmap([item('long', { start: '2026-11-01', end: '2026-11-09', status: 'done' }), item('short', { start: '2026-11-20', end: '2026-11-20', progress: 0 })]);
    expect(summarize(rm, [], TODAY).percent).toBe(90); // 9 days at 100 and 1 day at 0
  });
  it('is zero for an empty roadmap', () => {
    expect(summarize(roadmap([]), [], TODAY)).toMatchObject({ total: 0, percent: 0, overdue: 0, nextMilestone: undefined, daysToNextMilestone: undefined });
  });
  it('names the next milestone that is today or later, with the days to it, and none that has gone by', () => {
    const rm = roadmap([], { milestones: [{ id: 'm1', title: 'Past', date: '2026-11-10', kind: 'milestone' }, { id: 'm3', title: 'Far', date: '2026-12-25', kind: 'release' }, { id: 'm2', title: 'Soon', date: '2026-11-18', kind: 'milestone' }, { id: 'm0', title: 'Today', date: '2026-11-15', kind: 'milestone' }] });
    expect(summarize(rm, [], TODAY)).toMatchObject({ nextMilestone: { id: 'm0' }, daysToNextMilestone: 0 });
    expect(summarize({ ...rm, milestones: rm.milestones.filter(m => m.id !== 'm0') }, [], TODAY)).toMatchObject({ nextMilestone: { id: 'm2' }, daysToNextMilestone: 3 });
    expect(summarize({ ...rm, milestones: [rm.milestones[0]] }, [], TODAY).nextMilestone).toBeUndefined();
  });
  it('takes progress and status from the tickets when the items have epics', () => {
    const epic = makeIssue({ id: 1, key: 'E-1', type: 'epic', status: 'inprogress' });
    const rm = roadmap([item('a', { epicKey: 'E-1' })]);
    const issues = [epic, makeIssue({ id: 2, key: 'E-2', type: 'task', parentId: 1, status: 'done' }), makeIssue({ id: 3, key: 'E-3', type: 'task', parentId: 1, status: 'todo' })];
    const s = summarize(rm, issues, TODAY);
    expect(s.percent).toBe(50);
    expect(s.byStatus.inprogress).toBe(1);
  });
});

describe('the roadmap as a table to download', () => {
  it('has a heading line and a line for each item, in the order of the lanes and then by start', () => {
    const rm = roadmap([item('late', { lane: 'Run', start: '2026-11-01' }), item('b', { start: '2026-11-12' }), item('a', { start: '2026-11-10' })]);
    const lines = toCsv(rm, [], TODAY).split('\n');
    expect(lines[0]).toBe('Lane,Title,Status,Start,End,Progress %,Owner,Depends on,Epic');
    expect(lines.slice(1).map(l => l.split(',')[1])).toEqual(['a', 'b', 'late']);
  });
  it('writes the status as its name, the owner, the titles of what it depends on, and the epic', () => {
    const rm = roadmap([item('a', { title: 'First' }), item('b', { title: 'Second', owner: 'VY', deps: ['a', 'zzz'], epicKey: 'E-1', status: 'inprogress' })]);
    const line = toCsv(rm, [], TODAY).split('\n')[2];
    expect(line).toBe('Build,Second,In progress,2026-11-10,2026-11-19,0,VY,First; zzz,E-1');
  });
  it('wraps a cell in quotes when it has a comma, a quote or a line break, doubling quotes', () => {
    const rm = roadmap([item('a', { title: 'Plan, then "ship"\nit' })]);
    expect(toCsv(rm, [], TODAY)).toContain('"Plan, then ""ship""\nit"');
  });
});
