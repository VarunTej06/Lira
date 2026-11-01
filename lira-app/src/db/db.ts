import Dexie, { type Table } from 'dexie';
import type { Issue } from '../types/issue';
import type { Space, Column } from '../types/space';

export class LiraDatabase extends Dexie {
  spaces!: Table<Space, number>;
  issues!: Table<Issue, number>;
  columns!: Table<Column, string>;

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
