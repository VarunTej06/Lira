import { useMemo, useState } from 'react';
import { updateIssue } from '../../../hooks/useIssues';
import type { Issue } from '../../../types/issue';
import type { Space } from '../../../types/space';
import { beforeOf, isEmptyChange, patchOf, summary, type BulkChange } from '../../../utils/bulkEdit';
import { splitByAccess } from '../../../utils/spaceAccess';

export interface BulkResult { message: string; failed: number; undo: { id: number; before: Partial<Issue> }[] }

/**
 * The tickets ticked in the results table. Only tickets the person may change can be ticked, and a ticket that leaves the results
 * (the filter changed) leaves the selection too, so the bar never acts on something that is not on the screen.
 */
export function useBulkSelection(shown: readonly Issue[], spaces: readonly Space[]) {
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const { editable, locked } = useMemo(() => splitByAccess(shown, spaces), [shown, spaces]);
  const lockedIds = useMemo(() => new Set(locked.map(i => i.id!)), [locked]);
  const selected = useMemo(() => editable.filter(i => picked.has(i.id!)), [editable, picked]);
  const allPicked = editable.length > 0 && selected.length === editable.length;

  const toggle = (id: number) => { if (!lockedIds.has(id)) setPicked(p => { const n = new Set(p); if (!n.delete(id)) n.add(id); return n; }); };
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(editable.map(i => i.id!)));
  const clear = () => setPicked(new Set());

  async function apply(change: BulkChange) {
    if (isEmptyChange(change) || selected.length === 0 || busy) return;
    const patch = patchOf(change);
    setBusy(true); setResult(null);
    const undo: BulkResult['undo'] = []; let failed = 0;
    for (const issue of selected) {
      try { await updateIssue(issue.id!, patch); undo.push({ id: issue.id!, before: beforeOf(issue, patch) }); } catch { failed += 1; }
    }
    setBusy(false); setResult({ message: summary(undo.length, failed), failed, undo });
    if (failed === 0) clear();
  }
  async function undo() {
    if (!result) return;
    for (const { id, before } of result.undo) await updateIssue(id, before);
    setResult({ message: `Put ${result.undo.length} ticket${result.undo.length === 1 ? '' : 's'} back`, failed: 0, undo: [] });
  }

  return { selected, picked, lockedIds, allPicked, hasEditable: editable.length > 0, toggle, toggleAll, clear, apply, undo, busy, result, dismiss: () => setResult(null) };
}
export type BulkSelection = ReturnType<typeof useBulkSelection>;
