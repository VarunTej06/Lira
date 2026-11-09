import { describe, expect, it } from 'vitest';
import type { Issue } from '../types/issue';
import { sprintCounts } from './sprintCounts';

const t = (status: string, sprint: string, type = 'task') => ({ id: Math.random(), key: 'A-1', status, sprint, type, spaceId: 1, createdAt: new Date(2026, 10, 1) }) as unknown as Issue;

describe('sprintCounts', () => {
  it('counts done and all tickets of each sprint', () => {
    const issues = [t('done', '2026-11'), t('todo', '2026-11'), t('done', '2026-12')];
    expect(sprintCounts(issues, ['2026-11', '2026-12'])).toEqual({ '2026-11': { done: 1, total: 2 }, '2026-12': { done: 1, total: 1 } });
  });
  it('gives zeros for a sprint with no tickets', () => {
    expect(sprintCounts([], ['2027-01'])).toEqual({ '2027-01': { done: 0, total: 0 } });
  });
  it('leaves epics out of the count, as the rest of the sprint code does', () => {
    expect(sprintCounts([t('todo', '2026-11', 'epic')], ['2026-11'])['2026-11'].total).toBe(0);
  });
  it('has nothing for keys that were not asked for', () => {
    expect(Object.keys(sprintCounts([t('todo', '2026-11')], []))).toEqual([]);
  });
});
