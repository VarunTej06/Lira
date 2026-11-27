import { describe, expect, it } from 'vitest';
import { minutesOf, phaseOf } from './rounds';

const at = (s: string) => new Date(`2026-11-24T10:${s}:00Z`);

describe('where a voting round is', () => {
  const base = { endsAt: at('05'), revealedAt: null, confirmedAt: null };
  it('is voting until the time is up, then waiting for the reveal', () => {
    expect(phaseOf(base, at('04'))).toBe('voting');
    expect(phaseOf(base, at('05'))).toBe('timeup');
    expect(phaseOf(base, at('09'))).toBe('timeup');
  });
  it('is revealed once someone revealed it, even before the time was up, and confirmed after that', () => {
    expect(phaseOf({ ...base, revealedAt: at('02') }, at('03'))).toBe('revealed');
    expect(phaseOf({ ...base, revealedAt: at('02'), confirmedAt: at('06') }, at('07'))).toBe('confirmed');
  });
});

describe('the minutes a box allows', () => {
  it('takes a whole number from 1 to 10 and falls back to 5 for anything else', () => {
    expect(minutesOf({ votingMinutes: 1 })).toBe(1);
    expect(minutesOf({ votingMinutes: 10 })).toBe(10);
    for (const bad of [0, 11, 2.5, '3', null, undefined]) expect(minutesOf({ votingMinutes: bad }), String(bad)).toBe(5);
    expect(minutesOf({})).toBe(5);
  });
});
