import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentTime, currentTimeMs } from './clock';

afterEach(() => vi.useRealTimers());

describe('clock', () => {
  it('reads the real time', () => {
    const before = Date.now();
    const ms = currentTimeMs();
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(Date.now());
    expect(currentTime()).toBeInstanceOf(Date);
  });

  it('follows a faked clock, so a test can pin "today"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
    expect(currentTime().toISOString()).toBe('2026-11-09T10:00:00.000Z');
    expect(currentTimeMs()).toBe(Date.parse('2026-11-09T10:00:00Z'));
  });

  it('returns a new Date each time, so callers cannot change each other\'s value', () => {
    expect(currentTime()).not.toBe(currentTime());
  });
});
