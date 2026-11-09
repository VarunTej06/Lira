import { describe, expect, it } from 'vitest';
import { canBeParent } from './hierarchy';

const t = (id: number, type: 'epic' | 'task' | 'bug' | 'subtask') => ({ id, type });

describe('Ticket hierarchy', () => {
  it('a subtask goes under a task or bug', () => {
    expect(canBeParent(t(1, 'subtask'), t(2, 'task'))).toBe(true);
    expect(canBeParent(t(1, 'subtask'), t(2, 'bug'))).toBe(true);
    expect(canBeParent(t(1, 'subtask'), t(2, 'epic'))).toBe(false);
  });
  it('a task goes under an epic only', () => {
    expect(canBeParent(t(1, 'task'), t(2, 'epic'))).toBe(true);
    expect(canBeParent(t(1, 'task'), t(2, 'task'))).toBe(false);
  });
  it('a bug goes under an epic or a task', () => {
    expect(canBeParent(t(1, 'bug'), t(2, 'epic'))).toBe(true);
    expect(canBeParent(t(1, 'bug'), t(2, 'task'))).toBe(true);
    expect(canBeParent(t(1, 'bug'), t(2, 'subtask'))).toBe(false);
  });
  it('an epic has no parent, and nothing is its own parent', () => {
    expect(canBeParent(t(1, 'epic'), t(2, 'epic'))).toBe(false);
    expect(canBeParent(t(1, 'task'), t(1, 'epic'))).toBe(false);
  });
});
