import { db } from '../db/db';
import { triggerDiskSync } from '../services/localDiskSync';
import type { Issue } from '../types/issue';
import { v4 as uuidv4 } from 'uuid';

/**
 * Sprints are calendar months. A sprint is identified by a "YYYY-MM" key.
 * Every space shares the same calendar, but each space only sees its own tickets
 * in a sprint (sprint membership lives on the ticket: Issue.sprint).
 */
export type SprintPhase = 'past' | 'active' | 'upcoming';

/** What the team learned when the sprint closed. */
export interface Retro {
  wentWell: string[];
  didnt: string[];
  actions: { text: string; done: boolean }[];
  savedAt?: string; // ISO
}

export interface SprintMeta {
  goal?: string;
  completedAt?: string; // ISO — set when the sprint was formally closed
  /** Story points the team can take on in this sprint. Planning warns when the sprint goes over it. */
  capacity?: number;
  retro?: Retro;
  /** Spaces working in this sprint. Missing = every space. Stored under the "all" scope. */
  spaceIds?: number[];
}

export const isDone = (i: Issue) => i.status?.toLowerCase() === 'done';
/** Epics are long-running containers and live outside sprints (they are containers for the work inside them). */
export const isSprintWork = (i: Issue) => i.type !== 'epic';

export function sprintKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentSprintKey(): string {
  return sprintKey(new Date());
}

export function shiftSprint(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  return sprintKey(new Date(y, m - 1 + delta, 1));
}

export const nextSprint = (key: string) => shiftSprint(key, 1);
export const prevSprint = (key: string) => shiftSprint(key, -1);

// ─── Custom-length sprints ───────────────────────────────────────────────────
// A key "YYYY-MM" is a calendar-month sprint. A key "YYYY-MM-DD" is a sprint that starts on that day and lasts
// weekly (7 days), bi-weekly (14 days) or a number of days; its end date is kept in lira_sprint_defs.

export type SprintKind = 'monthly' | 'weekly' | 'biweekly' | 'days';
export interface SprintDef { start: string; end: string; kind: Exclude<SprintKind, 'monthly'>; name?: string }

export const CUSTOM_SPRINT_KEY = /^\d{4}-\d{2}-\d{2}$/;
export const SPRINT_KEY_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/;
export const isCustomSprint = (key: string) => CUSTOM_SPRINT_KEY.test(key);

const DEFS_KEY = 'lira_sprint_defs';
export const MAX_SPRINT_DAYS = 90;

export const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const startOfToday = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
/** Whole days from a to b (b later = positive), ignoring time of day and daylight-saving shifts. */
export const diffDays = (a: Date, b: Date) =>
  Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);

export function getSprintDefs(): Record<string, SprintDef> {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEFS_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, SprintDef> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, SprintDef>)) {
      if (isCustomSprint(k) && v && CUSTOM_SPRINT_KEY.test(v.end)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function setSprintDefs(defs: Record<string, SprintDef>) {
  try { localStorage.setItem(DEFS_KEY, JSON.stringify(defs)); } catch { /* storage unavailable */ }
}

/** How many days a kind lasts. `days` is only used by the "days" kind. */
export function kindLength(kind: SprintKind, days = 14): number {
  if (kind === 'weekly') return 7;
  if (kind === 'biweekly') return 14;
  return Math.min(MAX_SPRINT_DAYS, Math.max(1, Math.floor(days) || 1));
}

/** The existing custom sprint that overlaps [start, start+length), if any. */
export function findOverlap(startDay: string, length: number): string | undefined {
  const a = parseDay(startDay);
  const aEnd = new Date(a.getFullYear(), a.getMonth(), a.getDate() + length - 1);
  return Object.entries(getSprintDefs()).find(([k, d]) => parseDay(k) <= aEnd && parseDay(d.end) >= a)?.[0];
}

/** Creates a weekly / bi-weekly / N-day sprint. Returns its key, or null when it would overlap another custom sprint. */
export function addCustomSprint(opts: { start: string; kind: Exclude<SprintKind, 'monthly'>; days?: number; name?: string }): string | null {
  const length = kindLength(opts.kind, opts.days);
  if (findOverlap(opts.start, length)) return null;
  const s = parseDay(opts.start);
  const end = toDay(new Date(s.getFullYear(), s.getMonth(), s.getDate() + length - 1));
  setSprintDefs({ ...getSprintDefs(), [opts.start]: { start: opts.start, end, kind: opts.kind, ...(opts.name?.trim() ? { name: opts.name.trim() } : {}) } });
  setDeletedSprints(getDeletedSprints().filter(k => k !== opts.start));
  window.dispatchEvent(new Event(SPRINTS_EVENT));
  return opts.start;
}

export function sprintStart(key: string): Date {
  if (isCustomSprint(key)) return parseDay(key);
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export function sprintEnd(key: string): Date {
  if (isCustomSprint(key)) {
    const def = getSprintDefs()[key];
    const s = parseDay(key);
    const e = def ? parseDay(def.end) : new Date(s.getFullYear(), s.getMonth(), s.getDate() + 13);
    return new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999);
  }
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999);
}

/** Length in days. */
export function sprintDays(key: string): number {
  return diffDays(sprintStart(key), sprintEnd(key)) + 1;
}

const shortDay = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric' });

export function sprintLabel(key: string, short = false): string {
  if (isCustomSprint(key)) {
    const a = sprintStart(key), b = sprintEnd(key);
    const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    const range = sameMonth ? `${shortDay(a)}–${b.getDate()}` : `${shortDay(a)} – ${shortDay(b)}`;
    return short ? range : `${range}, ${b.getFullYear()}`;
  }
  const d = sprintStart(key);
  const month = d.toLocaleString('en-US', { month: short ? 'short' : 'long' });
  return short ? `${month} '${String(d.getFullYear()).slice(2)}` : `${month} ${d.getFullYear()}`;
}

export function sprintName(key: string): string {
  if (isCustomSprint(key)) return getSprintDefs()[key]?.name || `Sprint ${sprintLabel(key)}`;
  return `${sprintLabel(key)} Sprint`;
}

/** Human description of the length: "Monthly", "Weekly", "Bi-weekly" or "10 days". */
export function sprintKindLabel(key: string): string {
  if (!isCustomSprint(key)) return 'Monthly';
  const def = getSprintDefs()[key];
  if (def?.kind === 'weekly') return 'Weekly';
  if (def?.kind === 'biweekly') return 'Bi-weekly';
  return `${sprintDays(key)} days`;
}

/** The sprint after `key` in time. A month has a fixed next month; a custom sprint uses the sprints that exist. */
export function followingSprint(key: string, keys: string[]): string {
  if (!isCustomSprint(key)) return nextSprint(key);
  const end = sprintEnd(key).getTime();
  const later = keys.filter(k => sprintStart(k).getTime() > end).sort((a, b) => sprintStart(a).getTime() - sprintStart(b).getTime());
  return later[0] || nextSprint(sprintKey(sprintEnd(key)));
}

/** Previous / next sprint in the list (ordered by start date), for the arrows on the sprint page. */
export function neighbourSprint(key: string, keys: string[], dir: -1 | 1): string {
  const i = keys.indexOf(key);
  return keys[i + dir] ?? key;
}

export function sprintPhase(key: string): SprintPhase {
  const today = startOfToday();
  if (today < sprintStart(key)) return 'upcoming';
  if (today > sprintEnd(key)) return 'past';
  return 'active';
}

/** Days remaining in the active sprint (0 for past, full length for upcoming). */
export function daysLeft(key: string): number {
  const phase = sprintPhase(key);
  if (phase === 'past') return 0;
  if (phase === 'upcoming') return sprintDays(key);
  return Math.max(0, diffDays(startOfToday(), sprintEnd(key)));
}

/** Days of the sprint that have gone by, today included (0 before it starts, full length after it ends). */
export function daysElapsed(key: string): number {
  const phase = sprintPhase(key);
  if (phase === 'past') return sprintDays(key);
  if (phase === 'upcoming') return 0;
  return diffDays(sprintStart(key), startOfToday()) + 1;
}

/** The sprint a ticket belongs to. Legacy tickets (no stamp) fall back to their creation month. */
export function getIssueSprint(issue: Issue): string {
  if (issue.sprint) return issue.sprint;
  return sprintKey(new Date(issue.createdAt || Date.now()));
}

export function issuesInSprint(issues: Issue[], key: string): Issue[] {
  return issues.filter(i => isSprintWork(i) && getIssueSprint(i) === key);
}

const PLANNED_KEY = 'lira_planned_sprints';
export const SPRINTS_EVENT = 'lira-sprints-changed';

/** Sprints the user created ahead of time (months that may not have tickets yet). */
export function getPlannedSprints(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLANNED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((k): k is string => /^\d{4}-\d{2}$/.test(k)) : [];
  } catch {
    return [];
  }
}

export function addPlannedSprint(key: string) {
  const next = Array.from(new Set([...getPlannedSprints(), key])).sort();
  try {
    localStorage.setItem(PLANNED_KEY, JSON.stringify(next));
  } catch { /* storage unavailable */ }
  setDeletedSprints(getDeletedSprints().filter(k => k !== key)); // creating a sprint again brings it back
  window.dispatchEvent(new Event(SPRINTS_EVENT));
}

const DELETED_KEY = 'lira_deleted_sprints';

/** Sprints the user deleted. Months are listed contiguously, so a deleted month in the middle must be remembered to stay hidden. */
export function getDeletedSprints(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((k): k is string => /^\d{4}-\d{2}$/.test(k)) : [];
  } catch {
    return [];
  }
}

function setDeletedSprints(list: string[]) {
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(new Set(list)).sort()));
  } catch { /* storage unavailable */ }
}

/** All sprint keys that exist: every month with tickets, planned months, plus current and next — contiguous. */
export function allSprintKeys(issues: Issue[]): string[] {
  const cur = currentSprintKey();
  let min = cur;
  let max = nextSprint(cur);
  getPlannedSprints().forEach(k => {
    if (k < min) min = k;
    if (k > max) max = k;
  });
  const used = new Set(issues.filter(isSprintWork).map(getIssueSprint));
  used.forEach(k => {
    if (isCustomSprint(k)) return; // custom sprints are listed from their definitions below
    if (k < min) min = k;
    if (k > max) max = k;
  });
  const deleted = new Set(getDeletedSprints());
  const keys: string[] = [];
  for (let k = min; k <= max; k = nextSprint(k)) {
    // the current and next sprint always exist; a deleted month stays hidden unless a ticket is in it again
    if (deleted.has(k) && !used.has(k) && k !== cur && k !== nextSprint(cur)) continue;
    keys.push(k);
  }
  const custom = new Set(Object.keys(getSprintDefs()));
  used.forEach(k => { if (isCustomSprint(k)) custom.add(k); }); // a ticket in a sprint whose definition is gone keeps it visible
  custom.forEach(k => { if (!deleted.has(k) || used.has(k)) keys.push(k); });
  // oldest first; a month sprint comes before a custom sprint that starts the same day
  return keys.sort((a, b) => sprintStart(a).getTime() - sprintStart(b).getTime() || a.length - b.length);
}

export interface SprintStats {
  total: number;
  done: number;
  inprogress: number;
  blocked: number;
  todo: number;
  backlog: number;
  open: number;
  points: number;
  donePoints: number;
  percent: number;
  carriedIn: number;
}

export function sprintStats(list: Issue[]): SprintStats {
  const by = (s: string) => list.filter(i => i.status?.toLowerCase() === s).length;
  const done = list.filter(isDone).length;
  const pts = (i: Issue) => i.storyPoints || 0;
  return {
    total: list.length,
    done,
    inprogress: by('inprogress'),
    blocked: list.filter(i => i.blocked).length,
    todo: by('todo'),
    backlog: by('backlog'),
    open: list.length - done,
    points: list.reduce((a, i) => a + pts(i), 0),
    donePoints: list.filter(isDone).reduce((a, i) => a + pts(i), 0),
    percent: list.length ? Math.round((done / list.length) * 100) : 0,
    carriedIn: list.filter(i => (i.sprintHistory || []).length > 0).length,
  };
}

/** Burndown: tickets still open at the end of each day of the sprint. */
export function burndown(list: Issue[], key: string) {
  const days = sprintDays(key);
  const start = sprintStart(key);
  const total = list.length;
  const phase = sprintPhase(key);
  const lastDay = phase === 'active' ? daysElapsed(key) : phase === 'past' ? days : 0;
  const doneAt = list.filter(isDone).map(i => new Date(i.resolvedAt || i.updatedAt || i.createdAt));
  const points: { day: number; ideal: number; actual: number | null }[] = [];
  for (let d = 1; d <= days; d++) {
    const dayEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d - 1, 23, 59, 59, 999);
    const doneByThen = doneAt.filter(t => t <= dayEnd).length;
    points.push({
      day: d,
      ideal: Math.round((total - (total * d) / days) * 100) / 100,
      actual: d <= lastDay ? Math.max(0, total - doneByThen) : null,
    });
  }
  return points;
}

// ─── Sprint metadata (goal / closed state) ───────────────────────────────────

const META_KEY = 'lira_sprint_meta';
type MetaStore = Record<string, SprintMeta>; // key: `${spaceId|all}:${YYYY-MM}`

function readMeta(): MetaStore {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getSprintMeta(spaceId: number | 'all', key: string): SprintMeta {
  return readMeta()[`${spaceId}:${key}`] || {};
}

export function setSprintMeta(spaceId: number | 'all', key: string, patch: SprintMeta) {
  const store = readMeta();
  store[`${spaceId}:${key}`] = { ...store[`${spaceId}:${key}`], ...patch };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(store));
  } catch { /* storage unavailable */ }
}

/** The spaces taking part in a sprint, or null when every space does. */
export function getSprintSpaces(key: string): number[] | null {
  const ids = getSprintMeta('all', key).spaceIds;
  return Array.isArray(ids) && ids.length ? ids : null;
}

export function sprintIncludesSpace(key: string, spaceId: number): boolean {
  const ids = getSprintSpaces(key);
  return !ids || ids.includes(spaceId);
}

/** Pass null (or every space) to let all spaces take part. */
export function setSprintSpaces(key: string, ids: number[] | null) {
  setSprintMeta('all', key, { spaceIds: ids && ids.length ? Array.from(new Set(ids)).sort((a, b) => a - b) : undefined });
  window.dispatchEvent(new Event(SPRINTS_EVENT));
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Move tickets to a sprint (records history + activity). Skips tickets already there. */
export async function moveIssuesToSprint(issues: Issue[], target: string): Promise<number> {
  let moved = 0;
  await db.transaction('rw', db.issues, async () => {
    for (const issue of issues) {
      if (!issue.id) continue;
      const fresh = await db.issues.get(issue.id);
      if (!fresh) continue;
      const from = getIssueSprint(fresh);
      if (from === target) continue;
      const history = from < target
        ? Array.from(new Set([...(fresh.sprintHistory || []), from]))
        : fresh.sprintHistory || [];
      await db.issues.update(issue.id, {
        sprint: target,
        sprintHistory: history,
        updatedAt: new Date(),
        activity: [
          ...(fresh.activity || []),
          {
            id: uuidv4(),
            type: 'field_change',
            author: 'VY',
            authorInitials: 'VY',
            description: `moved from ${sprintName(from)} to ${sprintName(target)}`,
            oldValue: sprintName(from),
            newValue: sprintName(target),
            createdAt: new Date(),
          },
        ],
      });
      moved++;
    }
  });
  triggerDiskSync();
  return moved;
}

/** Close a sprint: Done tickets stay, everything else (backlog / to do / in progress) rolls into `target`. */
export async function completeSprint(
  scope: Issue[],
  key: string,
  spaceId: number | 'all',
  target: string = nextSprint(key),
): Promise<number> {
  const moved = await moveIssuesToSprint(scope.filter(i => !isDone(i)), target);
  setSprintMeta(spaceId, key, { completedAt: new Date().toISOString() });
  return moved;
}

/** Sprints can be deleted unless they are the current or the next one (those always exist). */
export function canDeleteSprint(key: string): boolean {
  if (isCustomSprint(key)) return true; // weekly / bi-weekly / N-day sprints are always optional
  const cur = currentSprintKey();
  return key !== cur && key !== nextSprint(cur);
}

/** Where a deleted sprint's tickets go: the current sprint (or the next one when the current one is being deleted). */
export const sprintDeleteTarget = (key: string) => (key === currentSprintKey() ? nextSprint(key) : currentSprintKey());

/**
 * Deletes a sprint. Its tickets are not deleted: they move to the current sprint. The goal and closed state of the sprint
 * are removed, and the month is hidden from the sprint list. Returns how many tickets moved.
 */
export async function deleteSprint(key: string, issues: Issue[]): Promise<number> {
  if (!canDeleteSprint(key)) return 0;
  const moved = await moveIssuesToSprint(issuesInSprint(issues, key), sprintDeleteTarget(key));
  setDeletedSprints([...getDeletedSprints(), key]);
  if (isCustomSprint(key)) {
    const defs = getSprintDefs();
    delete defs[key];
    setSprintDefs(defs);
  }
  try {
    const planned = getPlannedSprints().filter(k => k !== key);
    localStorage.setItem(PLANNED_KEY, JSON.stringify(planned));
    const meta = readMeta();
    for (const k of Object.keys(meta)) if (k.endsWith(`:${key}`)) delete meta[k];
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(SPRINTS_EVENT));
  return moved;
}

/** One-time stamp so legacy tickets get a stable explicit sprint. Does not touch updatedAt. */
export async function stampLegacySprints(): Promise<void> {
  const missing = await db.issues.filter(i => !i.sprint).toArray();
  if (missing.length === 0) return;
  await db.transaction('rw', db.issues, async () => {
    for (const i of missing) {
      if (i.id) await db.issues.update(i.id, { sprint: getIssueSprint(i) });
    }
  });
  triggerDiskSync();
}
