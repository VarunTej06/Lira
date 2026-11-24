import { useState } from 'react';
import { BULK_PRIORITIES, BULK_STATUSES, UNASSIGNED, assigneesOf, isEmptyChange, type BulkChange } from '../../../utils/bulkEdit';
import { statusLabel } from '../../../utils/status';
import { FIELD } from '../../teams/teamsUi';
import type { Issue } from '../../../types/issue';
import type { BulkSelection } from './useBulkSelection';

/** The bar above the table: appears when tickets are ticked, with the three things that can be set on all of them at once, and says what happened after. */
export function BulkBar({ bulk, issues }: { bulk: BulkSelection; issues: readonly Issue[] }) {
  const [change, setChange] = useState<BulkChange>({});
  const count = bulk.selected.length;
  const pick = (k: keyof BulkChange) => (e: { target: { value: string } }) => setChange(c => ({ ...c, [k]: e.target.value || undefined }));

  return (
    <div className="px-4">
      {count > 0 && (
        <div role="region" aria-label="Change the selected tickets" className="flex flex-wrap items-center gap-2 mb-2 rounded-lg border border-lira-blue bg-lira-blue-light px-3 py-2 text-ui text-lira-text">
          <strong>{count} selected</strong>
          <select aria-label="Set status" value={change.status ?? ''} onChange={pick('status')} className={FIELD}>
            <option value="">Status: no change</option>{BULK_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select aria-label="Set priority" value={change.priority ?? ''} onChange={pick('priority')} className={FIELD}>
            <option value="">Priority: no change</option>{BULK_PRIORITIES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </select>
          <select aria-label="Set assignee" value={change.assignee ?? ''} onChange={pick('assignee')} className={FIELD}>
            <option value="">Assignee: no change</option><option value={UNASSIGNED}>Unassigned</option>{assigneesOf(issues).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button type="button" disabled={isEmptyChange(change) || bulk.busy} onClick={() => { void bulk.apply(change).then(() => setChange({})); }} className="rounded px-3 py-1.5 font-bold bg-lira-blue text-lira-on-blue disabled:opacity-50">{bulk.busy ? 'Applying…' : 'Apply'}</button>
          <button type="button" onClick={bulk.clear} className="rounded px-3 py-1.5 border border-lira-border bg-lira-surface">Clear</button>
        </div>
      )}
      {bulk.result && (
        <p role="status" className="flex flex-wrap items-center gap-3 mb-2 text-ui text-lira-text">
          <span>{bulk.result.message}.</span>
          {bulk.result.undo.length > 0 && <button type="button" onClick={() => { void bulk.undo(); }} className="underline text-lira-blue">Undo</button>}
          <button type="button" onClick={bulk.dismiss} className="underline text-lira-muted">Dismiss</button>
        </p>
      )}
    </div>
  );
}
