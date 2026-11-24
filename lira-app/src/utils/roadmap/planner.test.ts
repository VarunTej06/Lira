import { describe, expect, it } from 'vitest';
import { makeIssue } from '../../test/factories';
import { buildPlannerRows, movedDate } from './planner';
import type { RoadmapItem } from './types';

const item = (id: string, lane: string, start: string, end: string, epicKey?: string): RoadmapItem => ({ id, title: id, lane, status: 'planned', start, end, progress: 0, deps: [], children: [], epicKey });
const epic = makeIssue({ id: 1, key: 'E-1', type: 'epic' });
const t1 = makeIssue({ id: 2, key: 'E-3', type: 'task', parentId: 1, dueDate: new Date(2026, 10, 20) });
const t2 = makeIssue({ id: 3, key: 'E-2', type: 'task', parentId: 1, dueDate: new Date(2026, 10, 10) });
const sub = makeIssue({ id: 4, key: 'E-4', type: 'subtask', parentId: 2 });

describe('the rows of the planner', () => {
  it('has a heading for each lane, then each item\'s epic, then that epic\'s tickets by date, with a place and height for each', () => {
    const { rows, height } = buildPlannerRows([item('a', 'Build', '2026-11-01', '2026-11-30', 'E-1')], ['Build'], [epic, t1, t2, sub]);
    expect(rows.map(r => r.kind)).toEqual(['lane', 'epic', 'ticket', 'ticket']);
    expect(rows.filter(r => r.kind === 'ticket').map(r => (r as { issue: { key: string } }).issue.key)).toEqual(['E-2', 'E-3']); // earliest first; a subtask is counted through its parent
    expect(rows.map(r => r.y)).toEqual([0, 34, 76, 108]);
    expect(height).toBe(140);
  });
  it('puts the items of a lane in order of when they start, then end', () => {
    const { rows } = buildPlannerRows([item('late', 'L', '2026-12-01', '2026-12-05'), item('early', 'L', '2026-11-01', '2026-11-09'), item('mid', 'L', '2026-11-01', '2026-11-20')], ['L'], []);
    expect(rows.filter(r => r.kind === 'epic').map(r => (r as { item: RoadmapItem }).item.id)).toEqual(['early', 'mid', 'late']);
  });
  it('hides the tickets of a collapsed epic, and everything under a collapsed lane, but still shows the lane', () => {
    const items = [item('a', 'Build', '2026-11-01', '2026-11-30', 'E-1')];
    expect(buildPlannerRows(items, ['Build'], [epic, t1], [], ['a']).rows.map(r => r.kind)).toEqual(['lane', 'epic']);
    expect(buildPlannerRows(items, ['Build'], [epic, t1], ['Build']).rows.map(r => r.kind)).toEqual(['lane']);
  });
  it('shows a lane that has no items when it was named, and leaves out one that was not named and has none', () => {
    expect(buildPlannerRows([], ['Empty'], []).rows).toEqual([expect.objectContaining({ kind: 'lane', lane: 'Empty', count: 0 })]);
    expect(buildPlannerRows([], [], []).rows).toEqual([]);
  });
  it('adds a lane after the named ones for an item whose lane was not named', () => {
    const { rows } = buildPlannerRows([item('a', 'Other', '2026-11-01', '2026-11-02')], ['Named'], []);
    expect(rows.filter(r => r.kind === 'lane').map(r => (r as { lane: string }).lane)).toEqual(['Named', 'Other']);
  });
  it('shows an item with no epic as an epic row with nothing under it', () => {
    const { rows } = buildPlannerRows([item('a', 'L', '2026-11-01', '2026-11-02')], ['L'], [epic]);
    expect(rows[1]).toMatchObject({ kind: 'epic', epic: undefined, tickets: [] });
  });
});

describe('where a drag lands', () => {
  it('is the date moved by whole days, ignoring the time of day', () => {
    expect(movedDate(new Date(2026, 10, 28, 17, 30), 5)).toEqual(new Date(2026, 11, 3));
    expect(movedDate(new Date(2026, 10, 1), -1)).toEqual(new Date(2026, 9, 31));
  });
});
