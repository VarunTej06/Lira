import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addCustomSprint, allSprintKeys, burndown, canDeleteSprint, daysElapsed, daysLeft, findOverlap, followingSprint,
  getSprintDefs, kindLength, neighbourSprint, sprintDays, sprintEnd, sprintKindLabel, sprintLabel, sprintName, sprintPhase, sprintStart,
} from './sprintUtils';
import type { Issue } from '../types/issue';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 12, 10, 0, 0)); // 12 Nov 2026
});
afterEach(() => vi.useRealTimers());

const day = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe('monthly sprints (unchanged)', () => {
  it('November has 30 days and is active on 12 Nov with 18 days left', () => {
    expect(sprintDays('2026-11')).toBe(30);
    expect(sprintPhase('2026-11')).toBe('active');
    expect(daysLeft('2026-11')).toBe(18);
    expect(daysElapsed('2026-11')).toBe(12);
    expect(sprintKindLabel('2026-11')).toBe('Monthly');
    expect(sprintName('2026-11')).toBe('November 2026 Sprint');
  });
  it('earlier months are past and later ones upcoming', () => {
    expect(sprintPhase('2026-10')).toBe('past');
    expect(sprintPhase('2026-12')).toBe('upcoming');
  });
});

describe('sprint length', () => {
  it('weekly = 7 days, bi-weekly = 14, N days = N (capped to 1..90)', () => {
    expect(kindLength('weekly')).toBe(7);
    expect(kindLength('biweekly')).toBe(14);
    expect(kindLength('days', 10)).toBe(10);
    expect(kindLength('days', 0)).toBe(1);
    expect(kindLength('days', 500)).toBe(90);
  });

  it('a weekly sprint from 9 Nov ends 15 Nov and is active on the 12th', () => {
    expect(addCustomSprint({ start: '2026-11-09', kind: 'weekly' })).toBe('2026-11-09');
    expect(day(sprintStart('2026-11-09'))).toBe('2026-11-9');
    expect(day(sprintEnd('2026-11-09'))).toBe('2026-11-15');
    expect(sprintDays('2026-11-09')).toBe(7);
    expect(sprintPhase('2026-11-09')).toBe('active');
    expect(daysLeft('2026-11-09')).toBe(3);
    expect(daysElapsed('2026-11-09')).toBe(4);
    expect(sprintKindLabel('2026-11-09')).toBe('Weekly');
  });

  it('a bi-weekly sprint crossing a month end is labelled with both months', () => {
    addCustomSprint({ start: '2026-11-23', kind: 'biweekly' });
    expect(day(sprintEnd('2026-11-23'))).toBe('2026-12-6');
    expect(sprintLabel('2026-11-23', true)).toBe('Nov 23 – Dec 6');
    expect(sprintKindLabel('2026-11-23')).toBe('Bi-weekly');
    expect(sprintPhase('2026-11-23')).toBe('upcoming');
    expect(daysLeft('2026-11-23')).toBe(14);
  });

  it('a number-of-days sprint spans exactly that many days, including across a year end', () => {
    addCustomSprint({ start: '2026-12-28', kind: 'days', days: 10 });
    expect(day(sprintEnd('2026-12-28'))).toBe('2027-1-6');
    expect(sprintDays('2026-12-28')).toBe(10);
    expect(sprintKindLabel('2026-12-28')).toBe('10 days');
  });

  it('keeps an optional name', () => {
    addCustomSprint({ start: '2026-11-09', kind: 'weekly', name: '  Hardening  ' });
    expect(sprintName('2026-11-09')).toBe('Hardening');
    expect(getSprintDefs()['2026-11-09'].name).toBe('Hardening');
  });
});

describe('overlap', () => {
  it('rejects a sprint that overlaps another custom sprint, accepts a back-to-back one', () => {
    addCustomSprint({ start: '2026-11-09', kind: 'weekly' }); // 9 – 15 Nov
    expect(findOverlap('2026-11-15', 7)).toBe('2026-11-09');
    expect(addCustomSprint({ start: '2026-11-12', kind: 'weekly' })).toBeNull();
    expect(addCustomSprint({ start: '2026-11-16', kind: 'weekly' })).toBe('2026-11-16');
    expect(Object.keys(getSprintDefs())).toHaveLength(2);
  });
});

describe('listing and navigation', () => {
  it('lists custom sprints in date order among the months', () => {
    addCustomSprint({ start: '2026-11-23', kind: 'weekly' });
    addCustomSprint({ start: '2026-11-09', kind: 'weekly' });
    const keys = allSprintKeys([]);
    expect(keys).toEqual(['2026-11', '2026-11-09', '2026-11-23', '2026-12']);
    expect(neighbourSprint('2026-11-09', keys, 1)).toBe('2026-11-23');
    expect(neighbourSprint('2026-11-09', keys, -1)).toBe('2026-11');
    expect(neighbourSprint('2026-12', keys, 1)).toBe('2026-12'); // stays on the last one
  });

  it('the sprint after a custom sprint is the next one that starts later', () => {
    addCustomSprint({ start: '2026-11-09', kind: 'weekly' });
    addCustomSprint({ start: '2026-11-16', kind: 'weekly' });
    const keys = allSprintKeys([]);
    expect(followingSprint('2026-11-09', keys)).toBe('2026-11-16');
    expect(followingSprint('2026-11-16', keys)).toBe('2026-12'); // falls through to the next month
  });

  it('a ticket in a custom sprint whose definition is gone keeps that sprint visible', () => {
    const t = { id: 1, type: 'task', sprint: '2026-11-02', createdAt: new Date(), updatedAt: new Date() } as unknown as Issue;
    expect(allSprintKeys([t])).toContain('2026-11-02');
  });
});

describe('deleting', () => {
  it('custom sprints can always be deleted; the current month cannot', () => {
    expect(canDeleteSprint('2026-11-09')).toBe(true);
    expect(canDeleteSprint('2026-11')).toBe(false);
  });
});

describe('burndown', () => {
  it('has one point per day of a weekly sprint and stops at today', () => {
    addCustomSprint({ start: '2026-11-09', kind: 'weekly' });
    const mk = (id: number, status: string, resolved?: Date) =>
      ({ id, type: 'task', status, sprint: '2026-11-09', createdAt: new Date(2026, 10, 1), updatedAt: new Date(2026, 10, 1), resolvedAt: resolved }) as unknown as Issue;
    const pts = burndown([mk(1, 'done', new Date(2026, 10, 10, 9)), mk(2, 'todo')], '2026-11-09');
    expect(pts).toHaveLength(7);
    expect(pts[0].actual).toBe(2); // 9 Nov
    expect(pts[1].actual).toBe(1); // 10 Nov: one done
    expect(pts[3].actual).toBe(1); // 12 Nov (today)
    expect(pts[4].actual).toBeNull(); // future
    expect(pts[6].ideal).toBe(0);
  });
});
