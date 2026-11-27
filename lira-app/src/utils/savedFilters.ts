import type { Space } from '../types/space';

export type SortField = 'key' | 'title' | 'status' | 'priority' | 'updatedAt';
const SORTS: readonly SortField[] = ['key', 'title', 'status', 'priority', 'updatedAt'];

/** Everything the Filters page can be set to: the search words, each facet, and how the results are sorted. */
export interface FilterSpec {
  query: string; spaces: number[]; statuses: string[]; priorities: string[]; types: string[]; assignees: string[]; labels: string[];
  team: string; recentOnly: boolean; sort: SortField; ascending: boolean;
}
export interface SavedFilter { id: string; name: string; spec: FilterSpec; createdAt: string }

export const MAX_SAVED = 50;
export const MAX_NAME = 60;

const strings = (v: unknown): string[] | null => (Array.isArray(v) && v.length <= 200 && v.every(x => typeof x === 'string' && x.length <= 200) ? (v as string[]) : null);
const numbers = (v: unknown): number[] | null => (Array.isArray(v) && v.length <= 200 && v.every(x => Number.isInteger(x)) ? (v as number[]) : null);

/** A stored spec that is safe to apply, or null. Anything missing or of the wrong kind makes it unusable rather than half-applied. */
export function readSpec(raw: unknown): FilterSpec | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const spaces = numbers(r.spaces); const statuses = strings(r.statuses); const priorities = strings(r.priorities);
  const types = strings(r.types); const assignees = strings(r.assignees); const labels = strings(r.labels);
  if (!spaces || !statuses || !priorities || !types || !assignees || !labels) return null;
  if (typeof r.query !== 'string' || r.query.length > 500 || typeof r.team !== 'string' || typeof r.recentOnly !== 'boolean' || typeof r.ascending !== 'boolean') return null;
  if (!SORTS.includes(r.sort as SortField)) return null;
  return { query: r.query, spaces, statuses, priorities, types, assignees, labels, team: r.team, recentOnly: r.recentOnly, sort: r.sort as SortField, ascending: r.ascending };
}

/** Whether anything is being filtered at all: only then is there something worth saving. */
export const hasAnyFilter = (s: FilterSpec): boolean =>
  s.query.trim() !== '' || s.spaces.length + s.statuses.length + s.priorities.length + s.types.length + s.assignees.length + s.labels.length > 0 || s.team !== 'all' || s.recentOnly;

const norm = (s: FilterSpec) => JSON.stringify({ ...s, query: s.query.trim(), spaces: [...s.spaces].sort(), statuses: [...s.statuses].sort(), priorities: [...s.priorities].sort(), types: [...s.types].sort(), assignees: [...s.assignees].sort(), labels: [...s.labels].sort() });
/** The same filter, whatever order the choices were made in. */
export const sameSpec = (a: FilterSpec, b: FilterSpec): boolean => norm(a) === norm(b);

/** A short line saying what a filter does, for a tooltip: "Open · Bug · Asha". */
export function describeSpec(s: FilterSpec, spaces: readonly Space[]): string {
  const names = s.spaces.map(id => spaces.find(sp => sp.id === id)?.name ?? `Space ${id}`);
  const parts = [s.query.trim() && `“${s.query.trim()}”`, ...names, ...s.statuses, ...s.priorities, ...s.types, ...s.assignees, ...s.labels, s.team !== 'all' && `Team ${s.team}`, s.recentOnly && 'Recently updated'];
  return parts.filter(Boolean).join(' · ') || 'Everything';
}

type Result = { list: SavedFilter[]; error?: string };
const taken = (list: readonly SavedFilter[], name: string, except?: string) => list.some(f => f.id !== except && f.name.toLowerCase() === name.toLowerCase());

/** Saves the current filter under a name. Refused for an empty filter, a blank or long or repeated name, or when there are already too many. */
export function addSaved(list: readonly SavedFilter[], name: string, spec: FilterSpec, id: string, now: string): Result {
  const clean = name.trim();
  if (!hasAnyFilter(spec)) return { list: [...list], error: 'Choose some filters first.' };
  if (!clean) return { list: [...list], error: 'Give it a name.' };
  if (clean.length > MAX_NAME) return { list: [...list], error: `Use at most ${MAX_NAME} characters.` };
  if (taken(list, clean)) return { list: [...list], error: 'A saved filter with this name exists.' };
  if (list.length >= MAX_SAVED) return { list: [...list], error: `You can keep ${MAX_SAVED} saved filters. Delete one first.` };
  return { list: [...list, { id, name: clean, spec, createdAt: now }] };
}

export const removeSaved = (list: readonly SavedFilter[], id: string): SavedFilter[] => list.filter(f => f.id !== id);

/** Another name for a saved filter, under the same rules. */
export function renameSaved(list: readonly SavedFilter[], id: string, name: string): Result {
  const clean = name.trim();
  if (!clean) return { list: [...list], error: 'Give it a name.' };
  if (clean.length > MAX_NAME) return { list: [...list], error: `Use at most ${MAX_NAME} characters.` };
  if (taken(list, clean, id)) return { list: [...list], error: 'A saved filter with this name exists.' };
  return { list: list.map(f => (f.id === id ? { ...f, name: clean } : f)) };
}
