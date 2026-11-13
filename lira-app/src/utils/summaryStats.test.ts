import { describe, expect, it } from 'vitest';
import { summaryStats } from './summaryStats';
import { makeIssue } from '../test/factories';

const NOW = new Date(2026, 10, 9, 12);

describe('Space summary numbers', () => {
  it('counts by status, with Blocked as a flag and not a status', () => {
    const s = summaryStats([
      makeIssue({ id: 1, status: 'done' }),
      makeIssue({ id: 2, status: 'inprogress', blocked: true }),
      makeIssue({ id: 3, status: 'todo' }),
      makeIssue({ id: 4, status: 'backlog' }),
    ], NOW);
    expect([s.total, s.done, s.inProgress, s.todo, s.backlog, s.blocked]).toEqual([4, 1, 1, 1, 1, 1]);
    expect(s.completionRate).toBe(25);
  });

  it('an empty space has zeros, not NaN', () => {
    const s = summaryStats([], NOW);
    expect([s.total, s.completionRate, s.overdue]).toEqual([0, 0, 0]);
  });

  it('overdue means past due and not done', () => {
    const s = summaryStats([
      makeIssue({ id: 1, dueDate: new Date('2026-11-01'), status: 'todo' }),
      makeIssue({ id: 2, dueDate: new Date('2026-11-01'), status: 'done' }),
      makeIssue({ id: 3, dueDate: new Date('2026-12-01'), status: 'todo' }),
      makeIssue({ id: 4, status: 'todo' }),
    ], NOW);
    expect(s.overdue).toBe(1);
  });

  it('lists open high priority tickets, newest changes first, and the commonest labels', () => {
    const s = summaryStats([
      makeIssue({ id: 1, priority: 'highest', status: 'todo', labels: ['api', 'ui'], updatedAt: new Date('2026-11-01T00:00:00Z') }),
      makeIssue({ id: 2, priority: 'high', status: 'done', labels: ['api'], updatedAt: new Date('2026-11-05T00:00:00Z') }),
      makeIssue({ id: 3, priority: 'low', status: 'todo', updatedAt: new Date('2026-11-03T00:00:00Z') }),
    ], NOW);
    expect(s.highPriorityIssues.map(i => i.id)).toEqual([1]);
    expect(s.recentlyUpdated.map(i => i.id)).toEqual([2, 3, 1]);
    expect(s.topLabels[0]).toEqual(['api', 2]);
    expect(s.priorityCounts).toEqual({ highest: 1, high: 1, low: 1 });
  });

  it('an epic is as done as its children; with none it follows its own status', () => {
    const s = summaryStats([
      makeIssue({ id: 10, type: 'epic', status: 'inprogress' }),
      makeIssue({ id: 11, parentId: 10, status: 'done' }),
      makeIssue({ id: 12, epicId: 10, status: 'todo' }),
      makeIssue({ id: 20, type: 'epic', status: 'done' }),
    ], NOW);
    expect(s.epicProgress.map(e => [e.epic.id, e.progress])).toEqual([[10, 50], [20, 100]]);
  });
});
