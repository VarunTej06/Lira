import type { Issue } from '../types/issue';
import { ticketsInScope, type LocalRound, type StoryBox, type Vote } from './storybox';

/** Where a ticket's voting is: voting while the time runs, "timeup" when it ran out, then revealed, then confirmed (sized). */
export type Phase = 'voting' | 'timeup' | 'revealed' | 'confirmed';

export interface Round { ticketId: number; phase: Phase; endsAt: string; finalPoints: number | null; voted: number }
export interface Person { userId: string; name: string; role: string; voted: boolean; votedAt: string | null }
/** Everything the planning room shows. `offsetMs` is how far the server's clock is ahead of this device's, so every screen counts down to the same moment. */
export interface Room { rounds: Round[]; votes: Vote[]; people: Person[]; activeTicketId: number | null; offsetMs: number }

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 10;
export const DEFAULT_MINUTES = 5;

/** The minutes a box gives for voting; a box made before the setting existed gets 5. */
export const minutesOf = (box: StoryBox): number => {
  const m = box.votingMinutes;
  return Number.isInteger(m) && m! >= MIN_MINUTES && m! <= MAX_MINUTES ? m! : DEFAULT_MINUTES;
};

/** Milliseconds of voting left, never below zero. */
export const msLeft = (endsAt: string, nowMs: number, offsetMs: number): number => Math.max(0, Date.parse(endsAt) - (nowMs + offsetMs));

/** "04:32": the whole seconds left, rounded up so the clock never shows 00:00 while there is still time. */
export function clockText(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** The phase the screen should show now: a round the server still calls voting turns to time-up the moment the clock runs out. */
export const phaseNow = (r: Round, nowMs: number, offsetMs: number): Phase => (r.phase === 'voting' && msLeft(r.endsAt, nowMs, offsetMs) === 0 ? 'timeup' : r.phase);

/** The tickets still to be sized and those already sized, without the one being voted on now, which is on the stage. */
export function lanes(issues: readonly Issue[], box: StoryBox, activeTicketId: number | null): { pending: Issue[]; sized: Issue[] } {
  const rows = ticketsInScope(issues, box.scope).filter(i => i.id !== activeTicketId);
  return { pending: rows.filter(i => i.storyPoints === undefined), sized: rows.filter(i => i.storyPoints !== undefined) };
}

const phaseOfLocal = (r: LocalRound, nowMs: number): Phase => (r.finalPoints !== undefined ? 'confirmed' : r.revealed ? 'revealed' : Date.parse(r.endsAt) > nowMs ? 'voting' : 'timeup');
const isActive = (r: LocalRound): boolean => r.finalPoints === undefined;

/** The room of the local edition, which has one person and keeps its rounds in the box. */
export function localRoom(box: StoryBox, nowMs: number, name: string): Room {
  const rounds: Round[] = Object.entries(box.localRounds ?? {}).map(([id, r]) => ({
    ticketId: Number(id), phase: phaseOfLocal(r, nowMs), endsAt: r.endsAt, finalPoints: r.finalPoints ?? null, voted: box.localVotes?.[id] === undefined ? 0 : 1,
  }));
  const active = rounds.find(r => r.phase !== 'confirmed');
  const votes: Vote[] = Object.entries(box.localVotes ?? {}).map(([ticket, points]) => ({ ticketId: Number(ticket), userId: 'me', name, points, mine: true }));
  const people: Person[] = active ? [{ userId: 'me', name, role: 'owner', voted: box.localVotes?.[String(active.ticketId)] !== undefined, votedAt: null }] : [];
  return { rounds, votes, people, activeTicketId: active?.ticketId ?? null, offsetMs: 0 };
}

const without = <T,>(rec: Record<string, T> | undefined, key: string): Record<string, T> => Object.fromEntries(Object.entries(rec ?? {}).filter(([k]) => k !== key));
const endsIn = (box: StoryBox, nowMs: number): string => new Date(nowMs + minutesOf(box) * 60_000).toISOString();

/** Puts a ticket up for voting, or null when another one is still open. Any points given to it before are cleared. */
export function localStart(box: StoryBox, ticketId: number, nowMs: number): StoryBox | null {
  if (Object.entries(box.localRounds ?? {}).some(([id, r]) => id !== String(ticketId) && isActive(r))) return null;
  return { ...box, localRounds: { ...box.localRounds, [ticketId]: { endsAt: endsIn(box, nowMs), revealed: false } }, localVotes: without(box.localVotes, String(ticketId)) };
}
export const localReveal = (box: StoryBox, ticketId: number): StoryBox => {
  const r = box.localRounds?.[ticketId];
  return r ? { ...box, localRounds: { ...box.localRounds, [ticketId]: { ...r, revealed: true } } } : box;
};
/** Clears the points of a ticket and starts its clock again. */
export const localRevote = (box: StoryBox, ticketId: number, nowMs: number): StoryBox =>
  box.localRounds?.[ticketId] ? { ...box, localRounds: { ...box.localRounds, [ticketId]: { endsAt: endsIn(box, nowMs), revealed: false } }, localVotes: without(box.localVotes, String(ticketId)) } : box;
export const localConfirm = (box: StoryBox, ticketId: number, points: number): StoryBox => {
  const r = box.localRounds?.[ticketId];
  return r?.revealed ? { ...box, localRounds: { ...box.localRounds, [ticketId]: { ...r, finalPoints: points } } } : box;
};
/** The person's own points for the ticket, only while its voting is open. */
export function localVote(box: StoryBox, ticketId: number, points: number | null, nowMs: number): StoryBox {
  const r = box.localRounds?.[ticketId];
  if (!r || phaseOfLocal(r, nowMs) !== 'voting') return box;
  const next = without(box.localVotes, String(ticketId));
  if (points !== null) next[String(ticketId)] = points;
  return { ...box, localVotes: next };
}
