import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Space } from '../types/space';

export function useSpaces() {
  return useLiveQuery(() => db.spaces.orderBy('createdAt').toArray(), [], []);
}

import { createSpaceHosted } from '../services/hostedSync';
import { triggerDiskSync } from '../services/localDiskSync';
import { isHosted } from '../utils/edition';

export async function createSpace(space: Omit<Space, 'id'>): Promise<number> {
  const id = isHosted() ? await createSpaceHosted(space) : await db.spaces.add(space);
  triggerDiskSync();
  return id;
}

export async function updateSpace(id: number, changes: Partial<Space>): Promise<void> {
  await db.spaces.update(id, { ...changes, updatedAt: new Date() });
  triggerDiskSync();
}

export async function deleteSpace(id: number): Promise<void> {
  await db.spaces.delete(id);
  // Also delete all issues in this space
  await db.issues.where('spaceId').equals(id).delete();
  triggerDiskSync();
}
