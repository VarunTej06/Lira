import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Issue } from '../types/issue';
import { sprintKey } from '../utils/sprintUtils';

export function useIssuesBySpace(spaceId: number | undefined) {
  return useLiveQuery<Issue[], Issue[]>(
    async () => {
      if (!spaceId) return [];
      return await db.issues.where('spaceId').equals(spaceId).sortBy('rank');
    },
    [spaceId],
    []
  );
}

export function useAllIssues() {
  return useLiveQuery<Issue[], Issue[]>(
    async () => {
      return await db.issues.toArray();
    },
    [],
    []
  );
}

// Top-level issues only (no parentId) — for the Kanban board
export function useRootIssuesBySpace(spaceId: number | undefined) {
  return useLiveQuery<Issue[], Issue[]>(
    async () => {
      if (!spaceId) return [];
      const all = await db.issues.where('spaceId').equals(spaceId).sortBy('rank');
      return all.filter(i => !i.parentId);
    },
    [spaceId],
    []
  );
}

export function useIssue(id: number | undefined) {
  return useLiveQuery<Issue | undefined>(
    () => id ? db.issues.get(id) : undefined,
    [id]
  );
}

// Get direct children of an issue
export function useChildIssues(parentId: number | undefined) {
  return useLiveQuery<Issue[], Issue[]>(
    async () => {
      if (parentId === undefined) return [];
      return await db.issues.where('parentId').equals(parentId).sortBy('rank');
    },
    [parentId],
    []
  );
}

// Get all issues in an epic (by epicId)
export function useEpicIssues(epicId: number | undefined) {
  return useLiveQuery<Issue[], Issue[]>(
    async () => {
      if (epicId === undefined) return [];
      return await db.issues.where('epicId').equals(epicId).toArray();
    },
    [epicId],
    []
  );
}

import { triggerDiskSync } from '../services/localDiskSync';

export async function updateIssue(id: number, changes: Partial<Issue>): Promise<void> {
  await db.issues.update(id, { ...changes, updatedAt: new Date() });
  triggerDiskSync();
}

export async function createIssue(issue: Omit<Issue, 'id'>): Promise<number> {
  const id = await db.issues.add({ ...issue, sprint: issue.sprint || sprintKey(new Date()) });
  triggerDiskSync();
  return id;
}

export async function deleteIssue(id: number): Promise<void> {
  // Also delete all children recursively
  const children = await db.issues.where('parentId').equals(id).toArray();
  for (const child of children) {
    if (child.id) await deleteIssue(child.id);
  }
  await db.issues.delete(id);
  triggerDiskSync();
}

export async function moveIssue(id: number, newStatus: string, newRank: number): Promise<void> {
  await db.issues.update(id, { status: newStatus, rank: newRank, updatedAt: new Date() });
  triggerDiskSync();
}

export async function getNextIssueKey(spaceKey: string): Promise<string> {
  const all = await db.issues.toArray();
  const spaceIssues = all.filter(i => i.key.startsWith(spaceKey + '-'));
  const numbers = spaceIssues.map(i => {
    const num = parseInt(i.key.split('-')[1]);
    return isNaN(num) ? 0 : num;
  });
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `${spaceKey}-${max + 1}`;
}
