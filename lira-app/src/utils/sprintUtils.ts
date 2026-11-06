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

export interface SprintMeta {
  goal?: string;
  completedAt?: string; // ISO — set when the sprint was formally closed
}

export const isDone = (i: Issue) => i.status?.toLowerCase() === 'done';
/** Epics are long-running containers and live outside sprints (as in Jira). */
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

export function sprintStart(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export function sprintEnd(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999);
}

export function sprintDays(key: string): number {
  return sprintEnd(key).getDate();
}

export function sprintLabel(key: string, short = false): string {
  const d = sprintStart(key);
  const month = d.toLocaleString('en-US', { month: short ? 'short' : 'long' });
  return short ? `${month} '${String(d.getFullYear()).slice(2)}` : `${month} ${d.getFullYear()}`;
}

export function sprintName(key: string): string {
  return `${sprintLabel(key)} Sprint`;
}

export function sprintPhase(key: string): SprintPhase {
  const cur = currentSprintKey();
  if (key === cur) return 'active';
  return key < cur ? 'past' : 'upcoming';
}

/** Days remaining in the active sprint (0 for past, full length for upcoming). */
export function daysLeft(key: string): number {
  const phase = sprintPhase(key);
  if (phase === 'past') return 0;
  if (phase === 'upcoming') return sprintDays(key);
  return Math.max(0, sprintDays(key) - new Date().getDate());
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
  issues.forEach(i => {
    if (!isSprintWork(i)) return;
    const k = getIssueSprint(i);
    if (k < min) min = k;
    if (k > max) max = k;
  });
  const deleted = new Set(getDeletedSprints());
  const used = new Set(issues.filter(isSprintWork).map(getIssueSprint));
  const keys: string[] = [];
  for (let k = min; k <= max; k = nextSprint(k)) {
    // the current and next sprint always exist; a deleted month stays hidden unless a ticket is in it again
    if (deleted.has(k) && !used.has(k) && k !== cur && k !== nextSprint(cur)) continue;
    keys.push(k);
  }
  return keys;
}

export interface SprintStats {
  total: number;
  done: number;
  inprogress: number;
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
  const lastDay = phase === 'active' ? new Date().getDate() : phase === 'past' ? days : 0;
  const doneAt = list.filter(isDone).map(i => new Date(i.resolvedAt || i.updatedAt || i.createdAt));
  const points: { day: number; ideal: number; actual: number | null }[] = [];
  for (let d = 1; d <= days; d++) {
    const dayEnd = new Date(start.getFullYear(), start.getMonth(), d, 23, 59, 59, 999);
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
