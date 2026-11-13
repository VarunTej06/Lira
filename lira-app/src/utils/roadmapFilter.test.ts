import { describe, expect, it } from 'vitest';
import { filterRoadmapItems, type RoadmapFilter } from './roadmapFilter';
import type { Roadmap, RoadmapItem } from './roadmapUtils';

const item = (over: Partial<RoadmapItem>): RoadmapItem => ({
  id: 'i', title: 'Item', lane: 'Platform', owner: 'Sam', start: '2026-11-02', end: '2026-11-20', status: 'planned', deps: [], children: [], ...over,
} as RoadmapItem);
const roadmap = { id: 'r', name: 'R', lanes: ['Platform', 'Apps'], milestones: [], items: [
  item({ id: 'a', title: 'Login rework', lane: 'Platform', owner: 'Sam' }),
  item({ id: 'b', title: 'Dashboards', lane: 'Apps', owner: 'Priya', start: '2027-02-01', end: '2027-03-01' }),
  item({ id: 'c', title: 'Billing', lane: 'Apps', owner: 'Sam', start: '2026-09-01', end: '2026-09-30', description: 'invoices' }),
] } as unknown as Roadmap;
const TODAY = new Date(2026, 10, 9);
const ALL: RoadmapFilter = { search: '', status: 'all', lane: 'all', owner: 'all', period: 'all' };
const ids = (f: Partial<RoadmapFilter>) => filterRoadmapItems(roadmap, [], TODAY, { ...ALL, ...f }).map(i => i.id);

describe('Roadmap filter', () => {
  it('shows everything with no filter', () => expect(ids({})).toEqual(['a', 'b', 'c']));
  it('searches title, description and lane', () => {
    expect(ids({ search: 'login' })).toEqual(['a']);
    expect(ids({ search: 'invoices' })).toEqual(['c']);
    expect(ids({ search: 'apps' })).toEqual(['b', 'c']);
  });
  it('filters by lane and owner', () => {
    expect(ids({ lane: 'Apps' })).toEqual(['b', 'c']);
    expect(ids({ owner: 'Sam' })).toEqual(['a', 'c']);
  });
  it('keeps items that overlap this month or this quarter', () => {
    expect(ids({ period: 'month' })).toEqual(['a']);
    expect(ids({ period: 'quarter' })).toEqual(['a']); // Oct to Dec: September and 2027 are outside
  });
});
