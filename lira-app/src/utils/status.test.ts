import { describe, expect, it } from 'vitest';
import { STATUS_LIST, isBlocked, statusLabel } from './status';
import { sprintStats } from './sprintUtils';
import { formatDayDateTime } from './dateUtils';
import type { Issue } from '../types/issue';

describe('statuses', () => {
  it('has four workflow statuses; Blocked is a switch, not a status', () => {
    expect(STATUS_LIST.map(s => s.id)).toEqual(['backlog', 'todo', 'inprogress', 'done']);
    expect(statusLabel('inprogress')).toBe('In Progress');
    expect(statusLabel('custom')).toBe('custom');
    expect(isBlocked({ blocked: true })).toBe(true);
    expect(isBlocked({})).toBe(false);
    expect(isBlocked(undefined)).toBe(false);
  });

  it('counts blocked tickets by the switch, whatever their status', () => {
    const mk = (status: string, blocked = false) => ({ status, blocked, storyPoints: 1, sprintHistory: [] }) as unknown as Issue;
    const stats = sprintStats([mk('inprogress', true), mk('todo', true), mk('done'), mk('todo')]);
    expect(stats.blocked).toBe(2);
    expect(stats.inprogress).toBe(1);
    expect(stats.open).toBe(3);
  });
});

describe('comment time', () => {
  it('shows the day, the date and the time', () => {
    expect(formatDayDateTime(new Date(2026, 10, 8, 15, 42))).toBe('Sun, 8 Nov 2026 at 3:42 PM');
    expect(formatDayDateTime(undefined)).toBe('');
  });
});
