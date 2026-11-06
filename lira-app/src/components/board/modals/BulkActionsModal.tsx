import React, { useState } from 'react';
import { Trash2, Check } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { db } from '../../../db/db';
import { saveToDiskNow } from '../../../services/localDiskSync';
import { updateIssue } from '../../../hooks/useIssues';
import type { Issue } from '../../../types/issue';
import type { Space } from '../../../types/space';

/** Bulk Actions Modal */

export const BulkActionsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
  issues: Issue[];
}> = ({ isOpen, onClose, space, issues }) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchStatus, setBatchStatus] = useState<string>('inprogress');
  const [batchPriority, setBatchPriority] = useState<string>('high');
  const [batchAssignee, setBatchAssignee] = useState<string>('Varun Tej');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Toggle select all
  const allSelected = issues.length > 0 && selectedIds.size === issues.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(issues.map(i => i.id!).filter(Boolean)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Perform bulk status update
  const handleBulkStatus = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        await updateIssue(id, { status: batchStatus as Issue['status'] });
      }
      setFeedback(`✓ Moved ${selectedIds.size} issues to "${batchStatus}".`);
      setSavedToast(true);
      setTimeout(() => { setSavedToast(false); setFeedback(null); onClose(); }, 2000);
    } catch (err) {
      setFeedback(`❌ Error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Perform bulk priority update
  const handleBulkPriority = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        await updateIssue(id, { priority: batchPriority as Issue['priority'] });
      }
      setFeedback(`✓ Updated priority of ${selectedIds.size} issues to "${batchPriority}".`);
      setSavedToast(true);
      setTimeout(() => { setSavedToast(false); setFeedback(null); onClose(); }, 2000);
    } catch (err) {
      setFeedback(`❌ Error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Perform bulk assignee update
  const handleBulkAssignee = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      const initials = batchAssignee === 'Varun Tej' ? 'VY' : 'UN';
      for (const id of selectedIds) {
        await updateIssue(id, {
          assignee: batchAssignee,
          assigneeInitials: initials,
        });
      }
      setFeedback(`✓ Assigned ${selectedIds.size} issues to "${batchAssignee}".`);
      setSavedToast(true);
      setTimeout(() => { setSavedToast(false); setFeedback(null); onClose(); }, 2000);
    } catch (err) {
      setFeedback(`❌ Error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Perform bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Permanently delete ${selectedIds.size} selected work items? This cannot be undone.`)) {
      return;
    }
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        await db.issues.delete(id);
      }
      await saveToDiskNow();
      setFeedback(`✓ Deleted ${selectedIds.size} issues.`);
      setSelectedIds(new Set());
      setTimeout(() => { setFeedback(null); onClose(); }, 1200);
    } catch (err) {
      setFeedback(`❌ Error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Bulk Actions · ${space?.name || 'Workspace'}`} size="lg">
      <div className="p-6 space-y-4 text-jira-text">
        <p className="text-xs text-jira-muted">
          Select multiple work items to update statuses, reassign owners, or batch update priorities in bulk.
        </p>

        {/* Action Controls Header */}
        <div className="bg-gray-50 border border-jira-border rounded-xl p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jira-border pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-jira-text">
                Selected: <span className="text-jira-blue">{selectedIds.size}</span> of {issues.length}
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-jira-blue font-semibold hover:underline cursor-pointer ml-2"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({selectedIds.size})
              </button>
            )}
          </div>

          {/* Quick Action Rows */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Status */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-jira-muted uppercase">Change Status</label>
              <div className="flex gap-1.5">
                <select
                  value={batchStatus}
                  onChange={e => setBatchStatus(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs border border-jira-border rounded-lg bg-white"
                >
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="inprogress">In Progress</option>
                  <option value="done">Done</option>
                </select>
                <button
                  type="button"
                  onClick={handleBulkStatus}
                  disabled={selectedIds.size === 0 || isProcessing}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* 2. Priority */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-jira-muted uppercase">Set Priority</label>
              <div className="flex gap-1.5">
                <select
                  value={batchPriority}
                  onChange={e => setBatchPriority(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs border border-jira-border rounded-lg bg-white"
                >
                  <option value="highest">Highest</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="lowest">Lowest</option>
                </select>
                <button
                  type="button"
                  onClick={handleBulkPriority}
                  disabled={selectedIds.size === 0 || isProcessing}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* 3. Assignee */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-jira-muted uppercase">Reassign To</label>
              <div className="flex gap-1.5">
                <select
                  value={batchAssignee}
                  onChange={e => setBatchAssignee(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs border border-jira-border rounded-lg bg-white"
                >
                  <option value="Varun Tej">Varun Tej (VY)</option>
                  <option value="Unassigned">Unassigned</option>
                </select>
                <button
                  type="button"
                  onClick={handleBulkAssignee}
                  disabled={selectedIds.size === 0 || isProcessing}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        {feedback && (
          <div className="p-2.5 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-200 font-semibold">
            {feedback}
          </div>
        )}

        {/* Scrollable Issues List */}
        <div className="max-h-64 overflow-y-auto border border-jira-border rounded-xl divide-y divide-jira-border">
          {issues.map(issue => {
            const isChecked = selectedIds.has(issue.id!);
            return (
              <div
                key={issue.id}
                onClick={() => toggleSelect(issue.id!)}
                className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                  isChecked ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 text-jira-blue rounded border-gray-300 pointer-events-none"
                  />
                  <span className="font-mono font-bold text-jira-blue flex-shrink-0">{issue.key}</span>
                  <span className="truncate text-jira-text font-medium">{issue.title}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-jira-muted">
                    {issue.status}
                  </span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-jira-muted">
                    {issue.priority}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end border-t border-jira-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700 cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>

      {/* 2-second green toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>✓ Saved</span>
        </div>
      )}
    </Modal>
  );
};
