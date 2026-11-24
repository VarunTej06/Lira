import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CELEBRATE_EVENT, celebrate } from './celebrate';

describe('a small burst of confetti', () => {
  let heard: CustomEvent[];
  const listen = (e: Event) => heard.push(e as CustomEvent);
  let minute = 0; // the helper remembers when it last burst, so each test starts a minute after the one before
  beforeEach(() => { heard = []; window.addEventListener(CELEBRATE_EVENT, listen); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 24, 10, ++minute, 0)); });
  afterEach(() => { window.removeEventListener(CELEBRATE_EVENT, listen); vi.useRealTimers(); });

  it('tells the page which kind of good news it is, and a ticket is the default', () => {
    vi.advanceTimersByTime(10_000);
    celebrate();
    celebrate('sprint');
    expect(heard.map(e => e.detail.kind)).toEqual(['done', 'sprint']);
  });
  it('gives one burst, not ten, when several tickets are finished at once, but a burst again a moment later', () => {
    vi.advanceTimersByTime(10_000);
    for (let i = 0; i < 10; i++) celebrate('done');
    expect(heard).toHaveLength(1);
    vi.advanceTimersByTime(600);
    celebrate('done');
    expect(heard).toHaveLength(2);
  });
  it('does not hold back a closed sprint because a ticket was just finished', () => {
    vi.advanceTimersByTime(10_000);
    celebrate('done');
    celebrate('sprint');
    expect(heard.map(e => e.detail.kind)).toEqual(['done', 'sprint']);
  });
});
