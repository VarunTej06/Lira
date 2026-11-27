/** Where a voting round is: voting while the time runs, "timeup" when it ran out but nobody revealed yet, then revealed, then confirmed. */
export type Phase = 'voting' | 'timeup' | 'revealed' | 'confirmed';

export interface RoundTimes { endsAt: Date; revealedAt: Date | null; confirmedAt: Date | null }

export function phaseOf(r: RoundTimes, now: Date): Phase {
  if (r.confirmedAt) return 'confirmed';
  if (r.revealedAt) return 'revealed';
  return now < r.endsAt ? 'voting' : 'timeup';
}

/** The minutes a box gives for voting, as its maker set them: a whole number from 1 to 10. A box made before this existed gets 5. */
export function minutesOf(doc: Record<string, unknown>): number {
  const m = doc.votingMinutes;
  return typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 10 ? m : 5;
}
