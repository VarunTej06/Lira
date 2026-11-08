import { db } from '../db/db';
import type { Space } from '../types/space';
import type { Issue } from '../types/issue';
import { seedDatabase } from '../db/seedData';

type SyncStatus = 'synced' | 'saving' | 'offline' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSaved: Date | null;
  filePath: string;
}

const syncListeners = new Set<(state: SyncState) => void>();

let currentSyncState: SyncState = {
  status: 'synced',
  lastSaved: null,
  filePath: 'data/spaces/*.json',
};

function notifyListeners() {
  syncListeners.forEach(listener => listener({ ...currentSyncState }));
}

export function subscribeToSyncStatus(listener: (state: SyncState) => void): () => void {
  syncListeners.add(listener);
  listener({ ...currentSyncState });
  return () => {
    syncListeners.delete(listener);
  };
}

let syncTimeout: number | undefined;

// Set while ticket changes are not yet on disk. If the page closes in that window, the browser copy is the
// newer one, so on the next load it is pushed to disk instead of being overwritten by the older files.
const ISSUES_DIRTY_KEY = 'lira__issues_dirty';
let saveVersion = 0;

/**
 * Initializes database from local disk file (d:/MLOps_LLMOps/Lira/data/lira-workspace.json).
 * If disk file has data, it hydrates IndexedDB with persistent disk data.
 * If disk file doesn't exist yet, it seeds default data and writes it to disk.
 */
export async function initLocalDiskSync(): Promise<void> {
  try {
    const unsaved = localStorage.getItem(ISSUES_DIRTY_KEY) !== null && (await db.issues.count()) > 0;
    if (unsaved) {
      console.info('[LocalDiskSync] Unsaved browser changes found, saving them to disk instead of reloading from disk.');
      await saveToDiskNow();
      return;
    }
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('API request failed');
    const diskData = await res.json();

    if (diskData && diskData.spaces && Array.isArray(diskData.spaces) && diskData.spaces.length > 0) {
      // Hydrate IndexedDB with disk file data
      await db.transaction('rw', db.spaces, db.issues, async () => {
        await db.spaces.clear();
        await db.issues.clear();

        const parsedSpaces: Space[] = diskData.spaces.map((s: Space) => ({
          ...s,
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
        }));

        const parsedIssues: Issue[] = (diskData.issues || []).map((i: Issue) => ({
          ...i,
          dueDate: i.dueDate ? new Date(i.dueDate) : undefined,
          startDate: i.startDate ? new Date(i.startDate) : undefined,
          createdAt: i.createdAt ? new Date(i.createdAt) : new Date(),
          updatedAt: i.updatedAt ? new Date(i.updatedAt) : new Date(),
          subtasks: (i.subtasks || []).map(st => ({
            ...st,
            createdAt: st.createdAt ? new Date(st.createdAt) : new Date(),
          })),
          activity: (i.activity || []).map(act => ({
            ...act,
            createdAt: act.createdAt ? new Date(act.createdAt) : new Date(),
          })),
        }));

        await db.spaces.bulkAdd(parsedSpaces);
        await db.issues.bulkAdd(parsedIssues);
      });

      currentSyncState = {
        status: 'synced',
        lastSaved: diskData.savedAt ? new Date(diskData.savedAt) : new Date(),
        filePath: diskData.filePath || 'data/spaces/*.json',
      };
      notifyListeners();
      return;
    }
  } catch (err) {
    console.warn('[LocalDiskSync] Could not read from /api/data, falling back to local DB/seed:', err);
  }

  // If no disk file yet, run seed and then write to disk
  await seedDatabase();
  await saveToDiskNow();
}

/**
 * Immediately saves all current spaces and issues to local disk file on PC
 */
export async function saveToDiskNow(): Promise<boolean> {
  currentSyncState.status = 'saving';
  notifyListeners();
  const sentVersion = saveVersion;

  try {
    const spaces = await db.spaces.toArray();
    const issues = await db.issues.toArray();

    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spaces, issues }),
    });

    if (!res.ok) throw new Error('Failed to save to disk');
    const result = await res.json();
    if (sentVersion === saveVersion) {
      try { localStorage.removeItem(ISSUES_DIRTY_KEY); } catch { /* storage unavailable */ }
    }

    currentSyncState = {
      status: 'synced',
      lastSaved: new Date(result.savedAt || Date.now()),
      filePath: result.filePath || 'data/spaces/*.json',
    };
    notifyListeners();
    return true;
  } catch (err) {
    console.error('[LocalDiskSync] Failed to save to local PC disk:', err);
    currentSyncState.status = 'error';
    notifyListeners();
    return false;
  }
}

/**
 * Writes any change that is still waiting for its (400 ms) turn to disk now. Called before a page is opened in a new tab,
 * so the new tab always starts from the latest data.
 */
export function flushDiskSync(): void {
  if (syncTimeout) {
    window.clearTimeout(syncTimeout);
    syncTimeout = undefined;
    void saveToDiskNow();
  }
}

/**
 * Triggers a debounced sync to local PC disk (called on any create/update/delete)
 */
export function triggerDiskSync(): void {
  saveVersion++;
  try { localStorage.setItem(ISSUES_DIRTY_KEY, String(Date.now())); } catch { /* storage unavailable */ }
  currentSyncState.status = 'saving';
  notifyListeners();

  if (syncTimeout) {
    window.clearTimeout(syncTimeout);
  }

  syncTimeout = window.setTimeout(() => {
    saveToDiskNow();
  }, 400);
}
