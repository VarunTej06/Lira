import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../types/issue';
import { sprintVelocity } from './sprintVelocity';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 9, 10, 0, 0)); });
afterEach(() => vi.useRealTimers());

let n = 0;
const t = (sprint: string, status: string) => ({ id: ++n, key: `A-${n}`, status, sprint, type: 'task', spaceId: 1, createdAt: new Date(2026, 0, 1) }) as unknown as Issue;

describe('sprintVelocity', () => {
  it('has no rows and a max of 1 when there are no sprints', () => {
    expect(sprintVelocity([], [])).toEqual({ rows: [], max: 1, avg: 0 });
  });
  it('leaves out sprints that have not started', () => {
    expect(sprintVelocity(['2026-12', '2027-01'], []).rows).toEqual([]);
  });
  it('keeps only the last six that have started', () => {
    const keys = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
    expect(sprintVelocity(keys, []).rows.map(r => r.key)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  });
  it('averages the done tickets of ended sprints that had tickets, ignoring the current one', () => {
    const issues = [t('2026-09', 'done'), t('2026-09', 'done'), t('2026-09', 'todo'), t('2026-10', 'done'), t('2026-11', 'done')];
    const v = sprintVelocity(['2026-08', '2026-09', '2026-10', '2026-11'], issues);
    expect(v.avg).toBe(2); // (2 done in Sep + 1 in Oct) / 2 = 1.5, rounded
    expect(v.max).toBe(3);
  });
});
