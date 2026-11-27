import type { Issue } from '../types/issue';
import type { Space } from '../types/space';

/** What a story box estimates: the tickets of one space, or the tickets of one sprint in every space. */
export type BoxScope = { type: 'space'; spaceId: number } | { type: 'sprint'; sprintKey: string };

export interface StoryBox {
  id: string; name: string; scope: BoxScope; status: 'open' | 'closed'; scale: number[];
  createdAt: string; createdBy: string; closedAt?: string;
  /** How long each ticket is open for voting, in minutes (1 to 10). Asked every time a box is made; a box made before this existed counts as 5. */
  votingMinutes?: number;
  /** The local edition has no server, so its voting rounds are kept in the box: by ticket, when voting ends, whether the points were revealed, and the points once confirmed. */
  localRounds?: Record<string, LocalRound>;
  /** The local edition has one person, so their own points are kept in the box itself. In the hosted edition votes are on the server. */
  localVotes?: Record<string, number>;
}
export interface LocalRound { endsAt: string; revealed: boolean; finalPoints?: number }
/** `mine` marks the signed-in person's own points, so the screen can show their card without knowing their id. */
export interface Vote { ticketId: number; userId: string; name: string; points: number; mine?: boolean }
export interface VoteStats { count: number; average: number | null; median: number | null; min: number | null; max: number | null }

/** The usual Fibonacci-like scale of story points. */
export const DEFAULT_SCALE: readonly number[] = [0, 1, 2, 3, 5, 8, 13, 21];

/** The tickets a box is about. Epics hold other tickets and are not estimated themselves. */
export function ticketsInScope(issues: readonly Issue[], scope: BoxScope): Issue[] {
  return issues.filter(i => i.type !== 'epic' && (scope.type === 'space' ? i.spaceId === scope.spaceId : i.sprint === scope.sprintKey));
}

export const sprintsOf = (issues: readonly Issue[]): string[] => [...new Set(issues.map(i => i.sprint).filter((s): s is string => !!s))].sort().reverse();

export function statsOf(votes: readonly Vote[]): VoteStats {
  if (votes.length === 0) return { count: 0, average: null, median: null, min: null, max: null };
  const sorted = votes.map(v => v.points).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    count: sorted.length, average: Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 10) / 10,
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2, min: sorted[0], max: sorted[sorted.length - 1],
  };
}

/** The value on the scale nearest to the median of the votes; halfway goes up. Null when nobody has voted. */
export function suggestedPoints(votes: readonly Vote[], scale: readonly number[]): number | null {
  const { median } = statsOf(votes);
  if (median === null || scale.length === 0) return null;
  return [...scale].sort((a, b) => a - b).reduce((best, v) => (Math.abs(v - median) < Math.abs(best - median) || (Math.abs(v - median) === Math.abs(best - median) && v > best) ? v : best));
}

export const votesFor = (votes: readonly Vote[], ticketId: number): Vote[] => votes.filter(v => v.ticketId === ticketId);

export function scopeLabel(scope: BoxScope, spaces: readonly Space[]): string {
  if (scope.type === 'sprint') return `Sprint ${scope.sprintKey}, all spaces`;
  const space = spaces.find(s => s.id === scope.spaceId);
  return space ? `Space ${space.name}` : 'A space that no longer exists';
}

/** A box that was just made: open, with the default scale. */
export const newBox = (id: string, name: string, scope: BoxScope, now: string, createdBy: string, votingMinutes: number): StoryBox =>
  ({ id, name: name.trim().slice(0, 100) || 'Story box', scope, status: 'open', scale: [...DEFAULT_SCALE], createdAt: now, createdBy, votingMinutes });

/** Open boxes first, newest first; then the closed ones as the history, newest closed first. */
export function groupBoxes(boxes: readonly StoryBox[]): { open: StoryBox[]; history: StoryBox[] } {
  const byNew = (a: string, b: string) => b.localeCompare(a);
  return {
    open: boxes.filter(b => b.status === 'open').sort((a, b) => byNew(a.createdAt, b.createdAt)),
    history: boxes.filter(b => b.status === 'closed').sort((a, b) => byNew(a.closedAt ?? a.createdAt, b.closedAt ?? b.createdAt)),
  };
}

/** The local edition's own points as votes, so the board shows them the same way. */
export const localVotesOf = (box: StoryBox): Vote[] =>
  Object.entries(box.localVotes ?? {}).map(([ticket, points]) => ({ ticketId: Number(ticket), userId: 'me', name: 'You', points }));
