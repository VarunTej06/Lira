import { describe, expect, it } from 'vitest';
import type { Issue } from '../../types/issue';
import { chipTone, dayNumberTone, dayTone } from './calendarTones';

const t = (over: Partial<Issue>) => ({ status: 'todo', priority: 'medium', ...over }) as Issue;

describe('chipTone', () => {
  it('goes by done first, then blocked, in progress, high priority, and the rest', () => {
    expect(chipTone(t({ status: 'done', blocked: true } as never))).toContain('emerald');
    expect(chipTone(t({ blocked: true } as never))).toContain('red-600');
    expect(chipTone(t({ status: 'inprogress', priority: 'high' }))).toContain('blue-500');
    expect(chipTone(t({ priority: 'highest' }))).toContain('red-500');
    expect(chipTone(t({ priority: 'high' }))).toContain('red-500');
    expect(chipTone(t({}))).toContain('slate-400');
  });
});

describe('dayTone', () => {
  const base = { dragOver: false, today: false, inMonth: true, weekend: false };
  it('puts a drop highlight above everything', () => expect(dayTone({ ...base, dragOver: true, today: true })).toContain('ring-2'));
  it('marks today above other months', () => expect(dayTone({ ...base, today: true, inMonth: false })).toBe('bg-lira-blue-light/50'));
  it('dims other months above weekends', () => expect(dayTone({ ...base, inMonth: false, weekend: true })).toBe('bg-gray-50/70'));
  it('tints weekends and leaves weekdays white', () => {
    expect(dayTone({ ...base, weekend: true })).toBe('bg-gray-50/40');
    expect(dayTone(base)).toBe('bg-white');
  });
});

describe('dayNumberTone', () => {
  it('fills today, darkens this month, dims the rest', () => {
    expect(dayNumberTone(true, true)).toContain('bg-lira-blue');
    expect(dayNumberTone(false, true)).toContain('text-lira-text');
    expect(dayNumberTone(false, false)).toBe('text-lira-muted');
  });
});
