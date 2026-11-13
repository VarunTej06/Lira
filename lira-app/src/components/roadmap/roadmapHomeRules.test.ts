import { describe, expect, it } from 'vitest';
import { homeTotals, visibleCards, type HomeCard } from './roadmapHomeRules';

const card = (id: string, o: { name?: string; archived?: boolean; starred?: boolean; updated?: string; percent?: number; total?: number; overdue?: number; blocked?: number; description?: string; spaceKey?: string } = {}): HomeCard => ({
  rm: { id, name: o.name ?? id, archived: o.archived, starred: o.starred, description: o.description, spaceKey: o.spaceKey, createdAt: '2026-01-01', updatedAt: o.updated } as never,
  summary: { percent: o.percent ?? 0, total: o.total ?? 0, overdue: o.overdue ?? 0, byStatus: { blocked: o.blocked ?? 0 } } as never,
  span: {},
});
const ids = (l: HomeCard[]) => l.map(c => c.rm.id);

describe('visibleCards', () => {
  const list = [card('a', { name: 'Zed', updated: '2026-02-01', percent: 10 }), card('b', { name: 'Amy', starred: true, updated: '2026-03-01', percent: 90 }), card('c', { archived: true, starred: true })];
  it('active shows unarchived ones, starred only the starred unarchived, archived the archived', () => {
    expect(ids(visibleCards(list, 'active', 'name', ''))).toEqual(['b', 'a']);
    expect(ids(visibleCards(list, 'starred', 'name', ''))).toEqual(['b']);
    expect(ids(visibleCards(list, 'archived', 'name', ''))).toEqual(['c']);
  });
  it('sorts by recent update, name or progress', () => {
    expect(ids(visibleCards(list, 'active', 'updated', ''))).toEqual(['b', 'a']);
    expect(ids(visibleCards(list, 'active', 'name', ''))).toEqual(['b', 'a']);
    expect(ids(visibleCards(list, 'active', 'progress', ''))).toEqual(['b', 'a']);
  });
  it('uses the creation date when never updated', () => {
    const l = [card('x', { updated: undefined }), card('y', { updated: '2026-06-01' })];
    expect(ids(visibleCards(l, 'active', 'updated', ''))).toEqual(['y', 'x']);
  });
  it('searches name, description and space key, ignoring case and outer spaces', () => {
    const l = [card('a', { name: 'Alpha' }), card('b', { name: 'Beta', description: 'Launch plan' }), card('c', { name: 'Gamma', spaceKey: 'OPS' })];
    expect(ids(visibleCards(l, 'active', 'name', ' LAUNCH '))).toEqual(['b']);
    expect(ids(visibleCards(l, 'active', 'name', 'ops'))).toEqual(['c']);
    expect(ids(visibleCards(l, 'active', 'name', 'zzz'))).toEqual([]);
  });
  it('does not change the list it is given', () => {
    const copy = [...list];
    visibleCards(list, 'active', 'name', '');
    expect(list).toEqual(copy);
  });
});

describe('homeTotals', () => {
  it('is all zeros for nothing', () => {
    expect(homeTotals([])).toEqual({ roadmaps: 0, items: 0, percent: 0, attention: 0, counts: { active: 0, starred: 0, archived: 0 } });
  });
  it('counts only unarchived roadmaps, averages progress and adds late and blocked epics', () => {
    const t = homeTotals([card('a', { total: 2, percent: 50, overdue: 1 }), card('b', { total: 3, percent: 100, blocked: 2, starred: true }), card('c', { archived: true, total: 9, percent: 0, blocked: 9 })]);
    expect(t).toMatchObject({ roadmaps: 2, items: 5, percent: 75, attention: 3, counts: { active: 2, starred: 1, archived: 1 } });
  });
});
