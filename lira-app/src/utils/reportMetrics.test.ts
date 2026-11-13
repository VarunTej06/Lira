import { describe, expect, it } from 'vitest';
import type { Issue } from '../types/issue';
import { pct, progressNote, reportMetrics, tally } from './reportMetrics';

const t = (status: string, priority = 'medium', over: Partial<Issue> = {}) => ({ status, priority, ...over }) as unknown as Issue;

describe('pct', () => {
  it('rounds to a whole percent', () => expect(pct(1, 3)).toBe(33));
  it('is 0 with no total', () => expect(pct(5, 0)).toBe(0));
});

describe('tally', () => {
  it('counts each value', () => expect(tally(['a', 'b', 'a'])).toEqual({ a: 2, b: 1 }));
  it('is empty for no values', () => expect(tally([])).toEqual({}));
});

describe('reportMetrics', () => {
  it('is all zeros for no issues', () => {
    expect(reportMetrics([])).toMatchObject({ total: 0, done: 0, inProgress: 0, totalPoints: 0, donePoints: 0, completionRate: 0, inFlightRate: 0, pointsRate: 0, critical: 0 });
  });
  it('counts statuses, rates and points (unestimated tickets count 0 points here)', () => {
    const m = reportMetrics([t('done', 'high', { storyPoints: 3 }), t('inprogress', 'highest', { storyPoints: 2 }), t('todo'), t('backlog')]);
    expect(m).toMatchObject({ total: 4, done: 1, inProgress: 1, completionRate: 25, inFlightRate: 25, totalPoints: 5, donePoints: 3, pointsRate: 60, critical: 2 });
  });
  it('counts blocked as a flag, on top of the status', () => {
    const m = reportMetrics([t('todo', 'medium', { blocked: true } as never), t('todo')]);
    expect(m.byStatus).toMatchObject({ todo: 2, blocked: 1 });
  });
  it('tallies priorities', () => {
    expect(reportMetrics([t('todo', 'low'), t('todo', 'low'), t('todo', 'high')]).byPriority).toEqual({ low: 2, high: 1 });
  });
});

describe('progressNote', () => {
  it('has three levels with the limits at 75 and 40', () => {
    expect(progressNote(75)).toContain('Excellent');
    expect(progressNote(74)).toContain('Steady');
    expect(progressNote(40)).toContain('Steady');
    expect(progressNote(39)).toContain('Early');
  });
});
