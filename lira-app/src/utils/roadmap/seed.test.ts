import { describe, expect, it } from 'vitest';
import { blankRoadmap, duplicateRoadmap, LIRA_SCHEDULE_VERSION, migrateLiraSchedule, roadmapSpan, seedLiraRoadmap } from './seed';

describe('the built-in roadmap', () => {
  const rm = seedLiraRoadmap();
  it('is the Lira roadmap, in the current version of its schedule, with lanes, items and milestones', () => {
    expect(rm).toMatchObject({ id: 'rm-lira', scheduleVersion: LIRA_SCHEDULE_VERSION, spaceKey: 'LIRA' });
    expect(rm.lanes.length).toBeGreaterThanOrEqual(5);
    expect(rm.items.length).toBeGreaterThanOrEqual(5);
    expect(rm.milestones.length).toBeGreaterThanOrEqual(5);
  });
  it('puts every item in one of its lanes, inside November, with ids that are all different and dependencies that exist', () => {
    const ids = rm.items.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of rm.items) {
      expect(rm.lanes, i.id).toContain(i.lane);
      expect(i.start <= i.end, i.id).toBe(true);
      expect(i.start.startsWith('2026-11'), i.id).toBe(true);
      expect(i.end.startsWith('2026-11'), i.id).toBe(true);
      for (const d of i.deps) expect(ids, `${i.id} waits for ${d}`).toContain(d);
    }
  });
});

describe('a new roadmap', () => {
  const now = new Date('2026-11-24T10:00:00Z');
  it('has the name trimmed, the space it was made for, the usual lanes when none were given, and nothing planned yet', () => {
    const r = blankRoadmap({ name: '  Plan  ', spaceKey: 'LIRA' }, now);
    expect(r).toMatchObject({ name: 'Plan', description: '', spaceKey: 'LIRA', projectKey: 'LIRA', lanes: ['Product', 'Engineering', 'Design'], items: [], milestones: [] });
    expect(r.createdAt).toBe(now.toISOString());
    expect(r.id).toMatch(/^rm-/);
  });
  it('uses the lanes it was given, and gives each roadmap its own id', () => {
    expect(blankRoadmap({ name: 'x', lanes: ['One'] }, now).lanes).toEqual(['One']);
    expect(blankRoadmap({ name: 'x', lanes: [] }, now).lanes).toHaveLength(3);
    expect(blankRoadmap({ name: 'x' }, now).id).not.toBe(blankRoadmap({ name: 'x' }, now).id);
  });
});

describe('a copy of a roadmap', () => {
  const original = { ...seedLiraRoadmap(), starred: true, archived: true };
  const copy = duplicateRoadmap(original, new Date('2026-11-24T10:00:00Z'));
  it('is named a copy, is neither starred nor archived, and has its own id and dates', () => {
    expect(copy.name).toBe('Copy of Lira Platform Roadmap');
    expect([copy.starred, copy.archived]).toEqual([false, false]);
    expect(copy.id).not.toBe(original.id);
    expect(copy.createdAt).toBe('2026-11-24T10:00:00.000Z');
  });
  it('has new ids for items, milestones and checklist entries, with dependencies pointing at the new items, and no epics or tasks carried over', () => {
    expect(copy.items).toHaveLength(original.items.length);
    const oldIds = new Set(original.items.map(i => i.id));
    const newIds = new Set(copy.items.map(i => i.id));
    expect(copy.items.every(i => !oldIds.has(i.id))).toBe(true);
    for (const i of copy.items) { expect(i.epicKey).toBeUndefined(); expect(i.taskKey).toBeUndefined(); for (const d of i.deps) expect(newIds.has(d)).toBe(true); }
    expect(copy.milestones.every(m => original.milestones.every(o => o.id !== m.id))).toBe(true);
    expect(copy.items.flatMap(i => i.children).every(c => original.items.flatMap(o => o.children).every(o => o.id !== c.id))).toBe(true);
    expect(copy.items.flatMap(i => i.children).length).toBe(original.items.flatMap(i => i.children).length);
  });
  it('leaves the original as it was', () => {
    expect(original.name).toBe('Lira Platform Roadmap');
    expect(original.starred).toBe(true);
  });
});

describe('the dates a roadmap covers', () => {
  it('is the first start and the last end', () => {
    expect(roadmapSpan(seedLiraRoadmap())).toEqual({ start: expect.stringMatching(/^2026-11-/), end: expect.stringMatching(/^2026-11-/) });
    const r = { ...blankRoadmap({ name: 'x' }), items: [{ id: 'a', title: 'a', lane: 'x', status: 'planned' as const, start: '2026-12-05', end: '2026-12-09', progress: 0, deps: [], children: [] }, { id: 'b', title: 'b', lane: 'x', status: 'planned' as const, start: '2026-11-01', end: '2027-01-02', progress: 0, deps: [], children: [] }] };
    expect(roadmapSpan(r)).toEqual({ start: '2026-11-01', end: '2027-01-02' });
  });
  it('is nothing for a roadmap with no items', () => { expect(roadmapSpan(blankRoadmap({ name: 'x' }))).toEqual({}); });
});

describe('moving an old copy of the built-in roadmap to the November plan', () => {
  const fresh = seedLiraRoadmap();
  it('takes the dates of the known items and milestones from the new plan, keeps what the person added, and flags that tickets must follow', () => {
    const old = { ...fresh, scheduleVersion: 1, description: 'old', items: [{ ...fresh.items[0], start: '2026-01-01', end: '2026-01-02' }, { id: 'mine', title: 'Mine', lane: 'Foundation', status: 'planned' as const, start: '2026-02-01', end: '2026-02-02', progress: 0, deps: [], children: [] }], milestones: [{ ...fresh.milestones[0], date: '2026-01-01' }, { id: 'ms-mine', title: 'Mine', date: '2026-02-02', kind: 'milestone' as const }] };
    const up = migrateLiraSchedule(old);
    expect(up.scheduleVersion).toBe(LIRA_SCHEDULE_VERSION);
    expect(up.pendingTicketSync).toBe(true);
    expect(up.description).toBe(fresh.description);
    expect(up.items[0]).toMatchObject({ start: fresh.items[0].start, end: fresh.items[0].end });
    expect(up.items[1]).toEqual(old.items[1]);
    expect(up.milestones.find(m => m.id === fresh.milestones[0].id)!.date).toBe(fresh.milestones[0].date);
    expect(up.milestones.some(m => m.id === 'ms-mine')).toBe(true);
    for (const m of fresh.milestones) expect(up.milestones.some(x => x.id === m.id)).toBe(true); // a milestone added since is brought in
  });
  it('leaves a roadmap that is up to date, and one that is not the built-in one, exactly as it is', () => {
    expect(migrateLiraSchedule(fresh)).toBe(fresh);
    const other = { ...fresh, id: 'rm-other', scheduleVersion: 1 };
    expect(migrateLiraSchedule(other)).toBe(other);
  });
  it('treats a roadmap with no version as the first one', () => {
    const { scheduleVersion: _v, ...noVersion } = fresh;
    expect(migrateLiraSchedule(noVersion as typeof fresh).scheduleVersion).toBe(LIRA_SCHEDULE_VERSION);
  });
});
