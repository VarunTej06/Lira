import { describe, expect, it } from 'vitest';
import { buildNotifications } from './notifications';
import { makeIssue } from '../test/factories';

const at = (d: number) => new Date(2026, 10, d, 12);
const act = (over: Record<string, unknown>) => ({ id: 'a', author: 'VY', authorInitials: 'VY', description: 'x', createdAt: at(5), ...over }) as never;

describe('Notifications bell', () => {
  it('lists a finished ticket as closed', () => {
    const n = buildNotifications([makeIssue({ id: 1, key: 'T-1', status: 'done', resolvedAt: at(8), activity: [] })]);
    expect(n.some(x => x.category === 'closed' && x.actionText.startsWith('closed ticket'))).toBe(true);
  });

  it('reads activity: created, a move to Done is closed, another status change is edited', () => {
    const issue = makeIssue({ id: 2, key: 'T-2', status: 'todo', activity: [
      act({ type: 'created', createdAt: at(1) }),
      act({ type: 'status_change', description: 'moved to Done', createdAt: at(2) }),
      act({ type: 'status_change', description: 'In Progress', createdAt: at(3) }),
      act({ type: 'comment', description: 'added a note', createdAt: at(4) }),
    ] });
    const n = buildNotifications([issue]);
    expect(n.map(x => x.category)).toEqual(['edited', 'edited', 'closed', 'created']); // newest first
    expect(n[3].actionText).toBe('created this task');
  });

  it('for a ticket with no activity, shows its creation, and an edit when it changed later', () => {
    const quiet = makeIssue({ id: 3, key: 'T-3', activity: [], createdAt: at(1), updatedAt: at(1) });
    const edited = makeIssue({ id: 4, key: 'T-4', activity: [], createdAt: at(1), updatedAt: at(6), priority: 'high' });
    expect(buildNotifications([quiet]).map(x => x.category)).toEqual(['created']);
    expect(buildNotifications([edited]).map(x => x.category)).toEqual(['edited', 'created']);
  });

  it('keeps only the latest 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => makeIssue({ id: i + 1, key: `T-${i + 1}`, activity: [], createdAt: at(1) }));
    expect(buildNotifications(many)).toHaveLength(20);
  });
});
