import type { Issue } from '../../types/issue';
import { BLOCKED_META, STATUS_META } from '../../utils/status';
import { matchesStatusFilter } from '../../utils/spaceFilters';
import type { SprintFilterValue } from './sprintFilterDefaults';

const STATUS_ORDER = ['inprogress', 'todo', 'backlog', 'done'];
const META = STATUS_META as Record<string, { label: string; color: string }>;
const statusMeta = (status: string) => (status === 'blocked' ? BLOCKED_META : META[status]);

/** The tickets the Status and Space filters let through. */
export const visibleTickets = (list: Issue[], filter: SprintFilterValue): Issue[] =>
  list.filter(i => matchesStatusFilter(i, filter.statuses.map(s => s.toLowerCase())) && (!filter.spaceIds.length || filter.spaceIds.includes(i.spaceId)));

/** In progress first, then To Do, Backlog, Done. Anything else sorts before them. */
export const byStatusOrder = (list: Issue[]): Issue[] =>
  [...list].sort((x, y) => STATUS_ORDER.indexOf(x.status?.toLowerCase()) - STATUS_ORDER.indexOf(y.status?.toLowerCase()));

/** "All tickets", or the chosen statuses joined with " + ". */
export const boxTitle = (statuses: string[]): string =>
  statuses.length === 0 ? 'All tickets' : statuses.map(s => statusMeta(s)?.label ?? s).join(' + ');

/** The heading takes the colour of the status only when exactly one is chosen. */
export const boxColor = (statuses: string[]): string | undefined => (statuses.length === 1 ? statusMeta(statuses[0])?.color : undefined);

/** Adds or removes the given ids: all of them are removed when `remove` is set, otherwise all are added. */
export function withIds(set: Set<number>, ids: number[], remove: boolean): Set<number> {
  const next = new Set(set);
  ids.forEach(id => (remove ? next.delete(id) : next.add(id)));
  return next;
}

/** Ticks a ticket that is not ticked, and unticks one that is. */
export function toggledId(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}
