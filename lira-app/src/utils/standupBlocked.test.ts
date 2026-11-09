import { describe, expect, it } from 'vitest';
import { buildAgenda } from './standupUtils';
import { makeIssue } from '../test/factories';

const NOW = new Date(2026, 10, 9, 12).getTime();

describe('Standup: blocked tickets', () => {
  it('lists a ticket switched to Blocked, with the tickets it waits on', () => {
    const blocker = makeIssue({ id: 10, key: 'T-10', status: 'inprogress' });
    const waiting = makeIssue({ id: 11, key: 'T-11', status: 'todo', blocked: true, blockedByIds: [10] });
    const fine = makeIssue({ id: 12, key: 'T-12' });
    const a = buildAgenda([blocker, waiting, fine], [blocker, waiting, fine], NOW);
    expect(a.blocked).toHaveLength(1);
    expect(a.blocked[0].issue.key).toBe('T-11');
    expect(a.blocked[0].blockedBy.map(b => b.key)).toEqual(['T-10']);
  });

  it('lists several blockers, and leaves out one that is already done', () => {
    const b1 = makeIssue({ id: 20, key: 'T-20', status: 'inprogress' });
    const b2 = makeIssue({ id: 21, key: 'T-21', status: 'done' });
    const waiting = makeIssue({ id: 22, key: 'T-22', blocked: true, blockedByIds: [20, 21] });
    const a = buildAgenda([waiting, b1, b2], [waiting, b1, b2], NOW);
    expect(a.blocked[0].blockedBy.map(b => b.key)).toEqual(['T-20']);
  });

  it('still lists a ticket marked Blocked when no blocking ticket is known', () => {
    const waiting = makeIssue({ id: 30, key: 'T-30', blocked: true });
    const a = buildAgenda([waiting], [waiting], NOW);
    expect(a.blocked).toHaveLength(1);
    expect(a.blocked[0].blockedBy).toEqual([]);
  });

  it('finished work is never listed as blocked', () => {
    const done = makeIssue({ id: 40, key: 'T-40', status: 'done', blocked: true });
    expect(buildAgenda([done], [done], NOW).blocked).toEqual([]);
  });

  it('the old "blocked by" links on a ticket still count', () => {
    const blocker = makeIssue({ id: 50, key: 'T-50' });
    const waiting = makeIssue({ id: 51, key: 'T-51', linkedIssues: [{ id: 'l1', issueId: 50, linkType: 'blocked_by' }] });
    const a = buildAgenda([blocker, waiting], [blocker, waiting], NOW);
    expect(a.blocked.map(b => b.issue.key)).toEqual(['T-51']);
  });
});
