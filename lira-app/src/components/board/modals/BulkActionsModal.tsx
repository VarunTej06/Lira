import { statusLabel } from '../../../utils/status';
import { confirmDialog } from '../../common/dialogStore';
import React, { useState } from 'react';
import { Trash2, Check } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { db } from '../../../db/db';
import { saveToDiskNow } from '../../../services/localDiskSync';
import { updateIssue } from '../../../hooks/useIssues';
import type { Issue } from '../../../types/issue';
import type { Space } from '../../../types/space';

const STATUSES = [['backlog', 'Backlog'], ['todo', 'To Do'], ['inprogress', 'In Progress'], ['done', 'Done']];
const PRIORITIES = [['highest', 'Highest'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['lowest', 'Lowest']];
const ASSIGNEES = [['Varun Tej', 'Varun Tej (VY)'], ['Unassigned', 'Unassigned']];

/** A labelled choice and its Apply button. */
function ApplyRow({ label, value, onChange, options, disabled, onApply }: {
  label: string; value: string; onChange: (v: string) => void; options: string[][]; disabled: boolean; onApply: () => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-3xs font-bold text-lira-muted uppercase">{label}</label>
      <div className="flex gap-1.5">
        <select value={value} onChange={e => onChange(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-lira-border rounded-lg bg-white">
          {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
        </select>
        <button type="button" onClick={onApply} disabled={disabled} className="px-2.5 py-1.5 text-xs font-semibold bg-lira-blue text-lira-on-blue rounded-lg hover:bg-lira-blue-hover disabled:opacity-40 cursor-pointer whitespace-nowrap">Apply</button>
      </div>
    </div>
  );
}

/** Change the status, priority or assignee of, or delete, many tickets of a space at once. */
export const BulkActionsModal: React.FC<{ isOpen: boolean; onClose: () => void; space: Space | undefined; issues: Issue[] }> = ({ isOpen, onClose, space, issues }) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchStatus, setBatchStatus] = useState('inprogress');
  const [batchPriority, setBatchPriority] = useState('high');
  const [batchAssignee, setBatchAssignee] = useState('Varun Tej');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const count = selectedIds.size;
  const allSelected = issues.length > 0 && count === issues.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(issues.map(i => i.id!).filter(Boolean)));
  const toggleSelect = (id: number) => setSelectedIds(prev => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; });

  /** Runs one change for every selected ticket, shows the result (or the error), and closes after a moment. */
  const run = async (apply: (id: number) => Promise<unknown>, success: string, opts: { toast: boolean; closeAfter: number }) => {
    if (count === 0) return;
    setIsProcessing(true);
    try {
      for (const id of selectedIds) await apply(id);
      setFeedback(`✓ ${success}`);
      if (opts.toast) setSavedToast(true);
      setTimeout(() => { setSavedToast(false); setFeedback(null); onClose(); }, opts.closeAfter);
      return true;
    } catch (err) {
      setFeedback(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };
  const apply = (change: Partial<Issue>, success: string) => run(id => updateIssue(id, change), success, { toast: true, closeAfter: 2000 });

  const handleBulkDelete = async () => {
    if (count === 0) return;
    if (!(await confirmDialog({ title: 'Delete work items', message: `Permanently delete ${count} selected work item${count === 1 ? '' : 's'}? This cannot be undone.`, confirmLabel: 'Delete', tone: 'danger' }))) return;
    const done = await run(async id => { await db.issues.delete(id); }, `Deleted ${count} issues.`, { toast: false, closeAfter: 1200 });
    if (done) { await saveToDiskNow(); setSelectedIds(new Set()); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Bulk Actions · ${space?.name || 'Workspace'}`} size="lg">
      <div className="p-6 space-y-4 text-lira-text">
        <p className="text-xs text-lira-muted">Select multiple work items to update statuses, reassign owners, or batch update priorities in bulk.</p>

        <div className="bg-gray-50 border border-lira-border rounded-xl p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-lira-border pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-lira-text">Selected: <span className="text-lira-blue">{count}</span> of {issues.length}</span>
              <button type="button" onClick={toggleSelectAll} className="text-xs text-lira-blue font-semibold hover:underline cursor-pointer ml-2">{allSelected ? 'Deselect all' : 'Select all'}</button>
            </div>
            {count > 0 && (
              <button type="button" onClick={handleBulkDelete} disabled={isProcessing} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />Delete Selected ({count})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ApplyRow label="Change Status" value={batchStatus} onChange={setBatchStatus} options={STATUSES} disabled={count === 0 || isProcessing}
              onApply={() => apply({ status: batchStatus as Issue['status'] }, `Moved ${count} issues to "${batchStatus}".`)} />
            <ApplyRow label="Set Priority" value={batchPriority} onChange={setBatchPriority} options={PRIORITIES} disabled={count === 0 || isProcessing}
              onApply={() => apply({ priority: batchPriority as Issue['priority'] }, `Updated priority of ${count} issues to "${batchPriority}".`)} />
            <ApplyRow label="Reassign To" value={batchAssignee} onChange={setBatchAssignee} options={ASSIGNEES} disabled={count === 0 || isProcessing}
              onApply={() => apply({ assignee: batchAssignee, assigneeInitials: batchAssignee === 'Varun Tej' ? 'VY' : 'UN' }, `Assigned ${count} issues to "${batchAssignee}".`)} />
          </div>
        </div>

        {feedback && <div className="p-2.5 bg-lira-blue-light text-lira-text text-xs rounded-lg border border-lira-border font-semibold">{feedback}</div>}

        <div className="max-h-64 overflow-y-auto border border-lira-border rounded-xl divide-y divide-lira-border">
          {issues.map(issue => {
            const checked = selectedIds.has(issue.id!);
            return (
              <div key={issue.id} onClick={() => toggleSelect(issue.id!)} className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${checked ? 'bg-lira-blue-light/70' : 'hover:bg-gray-50'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  <input type="checkbox" checked={checked} onChange={() => {}} className="w-4 h-4 text-lira-blue rounded border-gray-300 pointer-events-none" />
                  <span className="font-mono font-bold text-lira-blue flex-shrink-0">{issue.key}</span>
                  <span className="truncate text-lira-text font-medium">{issue.title}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-3xs uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-lira-muted">{statusLabel(issue.status)}</span>
                  <span className="text-3xs uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-lira-muted">{issue.priority}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end border-t border-lira-border pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-lira-blue text-lira-on-blue rounded-lg hover:bg-lira-blue-hover cursor-pointer shadow-xs">Done</button>
        </div>
      </div>

      {savedToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" /><span>✓ Saved</span>
        </div>
      )}
    </Modal>
  );
};
