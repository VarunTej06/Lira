import { describe, expect, it } from 'vitest';
import { buildHeader, computeRange, fitPpd, layoutRows, PX_PER_DAY, xOf } from './timeline';
import type { Roadmap, RoadmapItem } from './types';

const item = (id: string, lane: string, start: string, end: string): RoadmapItem => ({ id, title: id, lane, status: 'planned', start, end, progress: 0, deps: [], children: [] });
const rm = (items: RoadmapItem[], milestones: Roadmap['milestones'] = []): Roadmap => ({ id: 'r', name: 'R', lanes: ['A', 'B'], items, milestones, createdAt: '2026-11-01T00:00:00Z' });
const TODAY = new Date(2026, 10, 15);

describe('the room each zoom gives a day', () => {
  it('is more for weeks than months than quarters', () => {
    expect(PX_PER_DAY.weeks).toBeGreaterThan(PX_PER_DAY.months);
    expect(PX_PER_DAY.months).toBeGreaterThan(PX_PER_DAY.quarters);
  });
  it('widens a short roadmap to fill the room, and never squeezes a long one tighter than the scale', () => {
    expect(fitPpd('months', 30, 1500)).toBe(50);
    expect(fitPpd('months', 1000, 1500)).toBe(PX_PER_DAY.months);
    expect(fitPpd('weeks', 0, 1500)).toBe(PX_PER_DAY.weeks);
    expect(fitPpd('weeks', 30, 0)).toBe(PX_PER_DAY.weeks);
  });
});

describe('the calendar that is shown', () => {
  it('covers every item, milestone and today, with four days of room either side', () => {
    const r = computeRange(rm([item('a', 'A', '2026-11-10', '2026-11-20')], [{ id: 'm', title: 'M', date: '2026-12-05', kind: 'milestone' }]), TODAY);
    expect(r.start).toEqual(new Date(2026, 10, 6));
    expect(r.end).toEqual(new Date(2026, 11, 9));
    expect(r.days).toBe(34);
  });
  it('reaches today when everything is in the past or the future, and takes extra dates', () => {
    expect(computeRange(rm([item('a', 'A', '2026-09-01', '2026-09-10')]), TODAY).end).toEqual(new Date(2026, 10, 19));
    expect(computeRange(rm([]), TODAY, [new Date(2026, 0, 1)]).start).toEqual(new Date(2025, 11, 28));
  });
  it('puts a day at its distance from the start, times the room a day takes', () => {
    const r = computeRange(rm([item('a', 'A', '2026-11-10', '2026-11-20')]), TODAY);
    expect(xOf(r, r.start, 10)).toBe(0);
    expect(xOf(r, new Date(2026, 10, 16), 10)).toBe(100);
  });
});

describe('the rows of the timeline', () => {
  it('has a heading for each lane then its items by start and end, with where each item is', () => {
    const { rows, height, yOf } = layoutRows([item('x', 'B', '2026-11-02', '2026-11-03'), item('b', 'A', '2026-11-05', '2026-11-06'), item('a', 'A', '2026-11-01', '2026-11-09')], ['A', 'B']);
    expect(rows.map(r => r.kind === 'lane' ? `lane ${r.lane}` : `item ${r.item.id}`)).toEqual(['lane A', 'item a', 'item b', 'lane B', 'item x']);
    expect(rows.map(r => r.y)).toEqual([0, 34, 74, 114, 148]);
    expect(height).toBe(188);
    expect(yOf.get('b')).toBe(74);
  });
  it('hides the items of a collapsed lane, shows a lane named with nothing in it, and a lane that was not named after the others', () => {
    const items = [item('a', 'A', '2026-11-01', '2026-11-02'), item('o', 'Other', '2026-11-01', '2026-11-02')];
    expect(layoutRows(items, ['A', 'B'], ['A']).rows.map(r => r.kind)).toEqual(['lane', 'lane', 'lane', 'item']);
    const names = layoutRows(items, ['A', 'B']).rows.filter(r => r.kind === 'lane').map(r => (r as { lane: string }).lane);
    expect(names).toEqual(['A', 'B', 'Other']);
    expect(layoutRows([], [], []).rows).toEqual([]);
  });
});

describe('the heading of the timeline', () => {
  const range = { start: new Date(2026, 10, 25), end: new Date(2027, 0, 20), days: 57 };
  it('for months has years on top and month names below, each as wide as its days, cut to the range', () => {
    const h = buildHeader(range, 'months', 10);
    expect(h.top.map(c => c.label)).toEqual(['2026', '2027']);
    expect(h.bottom.map(c => c.label)).toEqual(['Nov', 'Dec', 'Jan']);
    expect(h.bottom[0]).toMatchObject({ x: 0, width: 60 }); // 25 to 30 November
    expect(h.bottom[1].width).toBe(310);
  });
  it('for weeks has months on top and the date of each Monday below', () => {
    const h = buildHeader(range, 'weeks', 22);
    expect(h.top[0].label).toBe('November 2026');
    expect(h.bottom[0].label).toBe('30'); // the first Monday on or after the 25th
  });
  it('for quarters has years on top and Q1 to Q4 below', () => {
    const h = buildHeader(range, 'quarters', 3);
    expect(h.bottom.map(c => c.label)).toEqual(['Q4', 'Q1']);
  });
});
