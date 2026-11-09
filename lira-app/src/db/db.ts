import Dexie, { type Table } from 'dexie';
import type { Issue } from '../types/issue';
import type { Space, Column } from '../types/space';
import type { ProjectRow, SprintRow, TeamRow, StandupRow } from '../types/structured';
import { celebrate } from '../utils/celebrate';

let restoringIssues = false;
/** Runs a restore (such as Undo) without the Done / status-log bookkeeping, so the old copies come back exactly as they were. */
export async function restoringIssuesExactly<T>(fn: () => Promise<T>): Promise<T> {
  restoringIssues = true;
  try { return await fn(); } finally { restoringIssues = false; }
}

class LiraDatabase extends Dexie {
  spaces!: Table<Space, number>;
  issues!: Table<Issue, number>;
  columns!: Table<Column, string>;
  projects!: Table<ProjectRow, string>;
  sprints!: Table<SprintRow, string>;
  teams!: Table<TeamRow, string>;
  standups!: Table<StandupRow, string>;

  constructor() {
    super('LiraDB');

    this.version(1).stores({
      spaces: '++id, name, key, createdAt',
      issues: '++id, spaceId, key, status, priority, assignee, dueDate, rank, createdAt, updatedAt, [spaceId+status]',
      columns: 'id, spaceId, order',
    });

    // Version 2: add parentId & epicId indexes for hierarchy
    this.version(2).stores({
      spaces: '++id, name, key, createdAt',
      issues: '++id, spaceId, key, status, priority, assignee, dueDate, rank, createdAt, updatedAt, [spaceId+status], parentId, epicId',
      columns: 'id, spaceId, order',
    });

    // Version 3: queryable copies of projects, sprint goals, teams and standups (see services/structuredStore.ts)
    this.version(3).stores({
      projects: 'id, key, name',
      sprints: 'id, spaceId, sprint, planned',
      teams: 'id, kind, owner',
      standups: 'id, scopeId',
    });

    // Stamp resolvedAt whenever a ticket reaches Done (and clear it when it is reopened), wherever the change comes from:
    // the board, the ticket popup, bulk moves, Viva AI. Reports (burndown, cycle time) rely on it.
    const isDoneStatus = (s: unknown) => typeof s === 'string' && s.toLowerCase() === 'done';
    this.issues.hook('creating', (_pk, obj) => {
      if (isDoneStatus(obj.status) && !obj.resolvedAt) obj.resolvedAt = new Date();
    });
    this.issues.hook('updating', (mods, _pk, obj) => {
      if (restoringIssues) return undefined;
      const m = mods as Partial<Issue>;
      if (!('status' in m) || m.status === obj.status) return undefined;
      const now = new Date();
      const extra: Partial<Issue> = { statusLog: [...(obj.statusLog || []), { from: obj.status, to: m.status as string, at: now }] };
      const wasDone = isDoneStatus(obj.status);
      const nowDone = isDoneStatus(m.status);
      if (!('resolvedAt' in m)) {
        if (nowDone && !wasDone) extra.resolvedAt = now;
        if (!nowDone && wasDone) extra.resolvedAt = undefined;
      }
      if (nowDone && !wasDone) celebrate('done'); // also when the caller (Viva) supplied resolvedAt itself
      return extra;
    });
  }
}

export const db = new LiraDatabase();

// Request durable storage on initialization
export async function requestDurableStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      return await navigator.storage.persist();
    }
    return true;
  }
  return false;
}
