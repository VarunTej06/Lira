import type { Issue } from '../../types/issue';
import { getIssueSprint, isDone, sprintIncludesSpace } from '../../utils/sprintUtils';

/** Open tickets that are not in the sprint and whose space takes part, matching the search; real backlog first, then tickets in other sprints. */
export function backlogFor(scoped: Issue[], sprint: string, query: string): Issue[] {
  const q = query.trim().toLowerCase();
  return scoped
    .filter(i => getIssueSprint(i) !== sprint && !isDone(i) && sprintIncludesSpace(sprint, i.spaceId))
    .filter(i => !q || i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))
    .sort((a, b) => Number(b.status === 'backlog') - Number(a.status === 'backlog') || (a.rank ?? 0) - (b.rank ?? 0));
}

/** "1 ticket added to X" / "3 tickets added to X". */
export const movedMessage = (count: number, verb: string, place: string): string => `${count} ticket${count > 1 ? 's' : ''} ${verb} ${place}`;

/** Colour of the capacity bar: red when over, amber from 90 percent, green below. */
export const capacityBarColor = (overBy: number, pct: number): string => (overBy > 0 ? 'bg-red-500' : pct >= 90 ? 'bg-amber-500' : 'bg-green-500');

/** The percent of the capacity used, at most 100; 0 with no capacity. */
export const capacityPercent = (points: number, capacity: number | undefined): number => (capacity ? Math.min(100, Math.round((points / capacity) * 100)) : 0);

/** The capacity typed into the box: empty means none, and it is never below 0. */
export const parseCapacity = (text: string): number | undefined => (text === '' ? undefined : Math.max(0, Number(text)));
