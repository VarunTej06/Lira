import { db, restoringIssuesExactly } from '../../db/db';
import { triggerDiskSync } from '../localDiskSync';
import type { Issue } from '../../types/issue';

/**
 * Undo for Viva's writes. Before an action runs, every ticket is copied; afterwards the differences are kept.
 * Undoing puts changed tickets back, removes tickets the action created and restores tickets it deleted.
 */
interface UndoRecord {
  id: string;
  label: string;
  restore: Issue[];
  remove: number[];
  at: number;
}

const journal = new Map<string, UndoRecord>();
const MAX = 20;

const same = (a: Issue, b: Issue) => JSON.stringify(a) === JSON.stringify(b);

/** Runs `action`, and records how to take back whatever it changed. */
export async function runWithUndo<T>(label: string, action: () => Promise<T>): Promise<{ result: T; undoId?: string; changed: number }> {
  const before = await db.issues.toArray();
  const result = await action();
  const after = await db.issues.toArray();
  const was = new Map(before.map(i => [i.id!, i]));
  const now = new Map(after.map(i => [i.id!, i]));
  const restore: Issue[] = [];
  const remove: number[] = [];
  for (const [id, i] of now) {
    const old = was.get(id);
    if (!old) remove.push(id);
    else if (!same(old, i)) restore.push(old);
  }
  for (const [id, old] of was) if (!now.has(id)) restore.push(old);
  const changed = restore.length + remove.length;
  if (!changed) return { result, changed };
  const undoId = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  journal.set(undoId, { id: undoId, label, restore, remove, at: Date.now() });
  while (journal.size > MAX) journal.delete(journal.keys().next().value as string);
  return { result, undoId, changed };
}

/** Takes an action back. Returns how many tickets were put back or removed, or null when it is no longer known. */
export async function undoAction(undoId: string): Promise<number | null> {
  const rec = journal.get(undoId);
  if (!rec) return null;
  await restoringIssuesExactly(() => db.transaction('rw', db.issues, async () => {
    if (rec.remove.length) await db.issues.bulkDelete(rec.remove);
    if (rec.restore.length) await db.issues.bulkPut(rec.restore);
  }));
  journal.delete(undoId);
  triggerDiskSync();
  return rec.restore.length + rec.remove.length;
}

