import { beforeEach, describe, expect, it } from 'vitest';
import type { Roadmap, RoadmapItem } from '../../utils/roadmapUtils';
import { csvFileName, loadPrefs, savePrefs, toggledLane, uniqueOwners, withItem, withMilestone, withoutItem } from './roadmapDetailRules';

const it_ = (id: string, over: Partial<RoadmapItem> = {}) => ({ id, title: id, lane: 'Core', deps: [], children: [], ...over }) as RoadmapItem;
const rm = (over: Partial<Roadmap> = {}) => ({ id: 'r', name: 'R', lanes: ['Core'], items: [it_('a'), it_('b', { deps: ['a'] })], milestones: [{ id: 'm1', title: 'M', date: '2026-11-01', kind: 'milestone' }], ...over }) as Roadmap;

beforeEach(() => localStorage.clear());

describe('prefs', () => {
  it('has defaults when nothing is saved', () => {
    expect(loadPrefs()).toEqual({ view: 'timeline', zoom: 'months', showDeps: true, collapsed: [] });
  });
  it('remembers what was saved and keeps the defaults for the rest', () => {
    savePrefs({ view: 'table', zoom: 'weeks', showDeps: false, collapsed: ['Core'] });
    expect(loadPrefs()).toMatchObject({ view: 'table', zoom: 'weeks', collapsed: ['Core'] });
    localStorage.setItem('lira_roadmap_prefs', '{"view":"planner"}');
    expect(loadPrefs()).toEqual({ view: 'planner', zoom: 'months', showDeps: true, collapsed: [] });
  });
  it('falls back to the defaults when the saved text is broken', () => {
    localStorage.setItem('lira_roadmap_prefs', '{oops');
    expect(loadPrefs().view).toBe('timeline');
  });
});

describe('toggledLane', () => {
  it('collapses an expanded lane and expands a collapsed one', () => {
    expect(toggledLane([], 'A')).toEqual(['A']);
    expect(toggledLane(['A', 'B'], 'A')).toEqual(['B']);
  });
});

describe('uniqueOwners', () => {
  it('lists each owner once, skipping empty ones', () => {
    expect(uniqueOwners([it_('a', { owner: 'VY' }), it_('b', { owner: 'AB' }), it_('c', { owner: 'VY' }), it_('d')])).toEqual(['VY', 'AB']);
  });
});

describe('withItem', () => {
  it('replaces an item with the same id', () => {
    const r = withItem(rm(), it_('a', { title: 'New' }));
    expect(r.items).toHaveLength(2);
    expect(r.items[0].title).toBe('New');
  });
  it('adds a new item at the end', () => {
    expect(withItem(rm(), it_('z')).items.map(i => i.id)).toEqual(['a', 'b', 'z']);
  });
  it('adds a new lane once', () => {
    expect(withItem(rm(), it_('a'), 'Fresh').lanes).toEqual(['Core', 'Fresh']);
    expect(withItem(rm(), it_('a'), 'Core').lanes).toEqual(['Core']);
  });
});

describe('withoutItem', () => {
  it('removes the item and the dependencies on it, leaving the original alone', () => {
    const base = rm();
    const r = withoutItem(base, 'a');
    expect(r.items.map(i => i.id)).toEqual(['b']);
    expect(r.items[0].deps).toEqual([]);
    expect(base.items[1].deps).toEqual(['a']);
  });
});

describe('withMilestone', () => {
  it('replaces by id', () => {
    expect(withMilestone(rm(), { id: 'm1', title: 'Launch', date: '2026-12-01', kind: 'milestone' }).milestones).toEqual([expect.objectContaining({ title: 'Launch' })]);
  });
  it('adds a new one, giving it an id when it has none', () => {
    const r = withMilestone(rm(), { id: '', title: 'X', date: '2026-12-01', kind: 'release' });
    expect(r.milestones).toHaveLength(2);
    expect(r.milestones[1].id).toMatch(/^ms/);
  });
});

describe('csvFileName', () => {
  it('lower-cases, joins words with dashes and adds the day', () => {
    expect(csvFileName('My  Big Plan', new Date(2026, 10, 10))).toBe('my-big-plan-2026-11-10.csv');
  });
});
