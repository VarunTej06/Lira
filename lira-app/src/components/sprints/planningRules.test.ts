import { describe, expect, it } from 'vitest';
import type { Issue } from '../../types/issue';
import { backlogFor, capacityBarColor, capacityPercent, movedMessage, parseCapacity } from './planningRules';

const t = (over: Partial<Issue>) => ({ id: 1, key: 'A-1', title: 'T', status: 'todo', spaceId: 1, sprint: '2026-10', ...over }) as Issue;

describe('backlogFor', () => {
  it('leaves out the sprint\'s own tickets and finished ones', () => {
    const list = [t({ key: 'A-1', sprint: '2026-11' }), t({ key: 'A-2', status: 'done' }), t({ key: 'A-3' })];
    expect(backlogFor(list, '2026-11', '').map(i => i.key)).toEqual(['A-3']);
  });
  it('matches key and title ignoring case and spaces around the query', () => {
    const list = [t({ key: 'A-1', title: 'Fix login' }), t({ key: 'B-2', title: 'Other' })];
    expect(backlogFor(list, '2026-11', '  LOGIN ').map(i => i.key)).toEqual(['A-1']);
    expect(backlogFor(list, '2026-11', 'b-2').map(i => i.key)).toEqual(['B-2']);
  });
  it('puts backlog status first, then orders by rank', () => {
    const list = [t({ key: 'A-1', rank: 1 }), t({ key: 'A-2', status: 'backlog', rank: 5 }), t({ key: 'A-3', rank: 0 })];
    expect(backlogFor(list, '2026-11', '').map(i => i.key)).toEqual(['A-2', 'A-3', 'A-1']);
  });
});

describe('movedMessage', () => {
  it('is singular for one and plural for more', () => {
    expect(movedMessage(1, 'added to', 'Nov')).toBe('1 ticket added to Nov');
    expect(movedMessage(3, 'moved to', 'Dec')).toBe('3 tickets moved to Dec');
  });
});

describe('capacity', () => {
  it('colours red when over, amber from 90, green below', () => {
    expect(capacityBarColor(1, 100)).toBe('bg-red-500');
    expect(capacityBarColor(0, 90)).toBe('bg-amber-500');
    expect(capacityBarColor(0, 89)).toBe('bg-green-500');
  });
  it('gives the percent, capped at 100, and 0 without capacity', () => {
    expect(capacityPercent(5, 10)).toBe(50);
    expect(capacityPercent(20, 10)).toBe(100);
    expect(capacityPercent(5, undefined)).toBe(0);
    expect(capacityPercent(5, 0)).toBe(0);
  });
  it('reads the typed capacity', () => {
    expect(parseCapacity('')).toBeUndefined();
    expect(parseCapacity('12')).toBe(12);
    expect(parseCapacity('-3')).toBe(0);
  });
});
