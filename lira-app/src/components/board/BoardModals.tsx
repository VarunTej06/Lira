import React, { useState } from 'react';
import {
  Trash2, Check, Layers, User, Tag, Calendar, Eye
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { db } from '../../db/db';
import { saveToDiskNow } from '../../services/localDiskSync';
import { updateIssue } from '../../hooks/useIssues';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';

// ─── 1. Board Settings Modal ──────────────────────────────────────────────────

export interface BoardSettingsConfig {
  density: 'comfortable' | 'compact';
  showStoryPoints: boolean;
  showEpicBadge: boolean;
  showDueDate: boolean;
  showAssignee: boolean;
  showPriority: boolean;
  estimationType: 'points' | 'count';
}

export const DEFAULT_BOARD_SETTINGS: BoardSettingsConfig = {
  density: 'comfortable',
  showStoryPoints: true,
  showEpicBadge: true,
  showDueDate: true,
  showAssignee: true,
  showPriority: true,
  estimationType: 'points',
};

export const BoardSettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
}> = ({ isOpen, onClose, space }) => {
  const spaceId = space?.id ?? 'global';
  const storageKey = `lira_board_settings_${spaceId}`;

  const [config, setConfig] = useState<BoardSettingsConfig>(() => {
    try {
      const saved = localStorage.getItem(storageKey) || localStorage.getItem('lira_board_settings');
      return saved ? { ...DEFAULT_BOARD_SETTINGS, ...JSON.parse(saved) } : DEFAULT_BOARD_SETTINGS;
    } catch {
      return DEFAULT_BOARD_SETTINGS;
    }
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(config));
    localStorage.setItem('lira_board_settings', JSON.stringify(config));
    window.dispatchEvent(new Event('lira_board_settings_changed'));
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Board Settings · ${space?.name || 'Workspace'}`} size="md">
      <div className="p-6 space-y-5 text-jira-text">
        <p className="text-xs text-jira-muted leading-relaxed">
          Customize card density, badge visibility, and estimation metrics for this board.
        </p>

        {/* Card Density */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-jira-muted uppercase tracking-wider block">
            Card Layout &amp; Density
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, density: 'comfortable' }))}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                config.density === 'comfortable'
                  ? 'border-jira-blue bg-blue-50/50 ring-1 ring-jira-blue'
                  : 'border-jira-border hover:bg-gray-50'
              }`}
            >
              <div className="text-sm font-semibold text-jira-text">Comfortable</div>
              <div className="text-[11px] text-jira-muted mt-0.5">Spacious cards with full metadata &amp; labels</div>
            </button>
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, density: 'compact' }))}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                config.density === 'compact'
                  ? 'border-jira-blue bg-blue-50/50 ring-1 ring-jira-blue'
                  : 'border-jira-border hover:bg-gray-50'
              }`}
            >
              <div className="text-sm font-semibold text-jira-text">Compact</div>
              <div className="text-[11px] text-jira-muted mt-0.5">Dense card view with slim padding</div>
            </button>
          </div>
        </div>

        {/* Card Badges & Metadata Visibility */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-jira-muted uppercase tracking-wider block">
            Card Badges &amp; Details
          </label>
          <div className="divide-y divide-jira-border border border-jira-border rounded-xl overflow-hidden bg-gray-50/50">
            {[
              { key: 'showStoryPoints' as const, label: 'Story points badge', desc: 'Display estimated points on card footer', icon: <Tag className="w-4 h-4 text-purple-500" /> },
              { key: 'showEpicBadge' as const, label: 'Epic badge', desc: 'Show parent epic pill at top of card', icon: <Layers className="w-4 h-4 text-indigo-500" /> },
              { key: 'showDueDate' as const, label: 'Due dates & overdue indicators', desc: 'Alert on approaching or past-due dates', icon: <Calendar className="w-4 h-4 text-amber-500" /> },
              { key: 'showAssignee' as const, label: 'Assignee avatar', desc: 'Show user initials avatar on card', icon: <User className="w-4 h-4 text-blue-500" /> },
              { key: 'showPriority' as const, label: 'Priority badge & chevron', desc: 'Show high / medium / low indicator', icon: <Eye className="w-4 h-4 text-emerald-500" /> },
            ].map(item => (
              <div
                key={item.key}
                onClick={() => setConfig(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className="flex items-center justify-between p-3 hover:bg-white cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <div>
                    <div className="text-xs font-semibold text-jira-text">{item.label}</div>
                    <div className="text-[11px] text-jira-muted">{item.desc}</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config[item.key]}
                  onChange={() => {}}
                  className="w-4 h-4 text-jira-blue rounded border-gray-300 pointer-events-none"
                />
              </div>
            ))}
          </div>
        </div>

        {saved && (
          <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" /> Board settings updated successfully!
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-jira-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-jira-muted hover:text-jira-text rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700 cursor-pointer shadow-xs"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* 2-second green toast */}
      {saved && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>✓ Saved</span>
        </div>
      )}
    </Modal>
  );
};

// ─── 2. WIP Limits Modal ──────────────────────────────────────────────────────

export interface WipLimitsConfig {
  enabled: boolean;
  limits: {
    backlog: number;
    todo: number;
    inprogress: number;
    done: number;
  };
}

export const DEFAULT_WIP_CONFIG: WipLimitsConfig = {
  enabled: false,
  limits: {
    backlog: 0, // 0 = unlimited
    todo: 5,
    inprogress: 3,
    done: 0,
  },
};

export const WIPLimitsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
  onConfigSaved?: (cfg: WipLimitsConfig) => void;
}> = ({ isOpen, onClose, space, onConfigSaved }) => {
  const [config, setConfig] = useState<WipLimitsConfig>(() => {
    try {
      const savedLimits = localStorage.getItem('lira_wip_limits');
      const savedConfig = localStorage.getItem('lira_wip_config');
      if (savedLimits && savedLimits.startsWith('{')) {
        const parsedLimits = JSON.parse(savedLimits);
        const hasLimits = Object.values(parsedLimits).some((v: any) => typeof v === 'number' && v > 0);
        return {
          enabled: hasLimits,
          limits: { ...DEFAULT_WIP_CONFIG.limits, ...parsedLimits }
        };
      }
      return savedConfig ? { ...DEFAULT_WIP_CONFIG, ...JSON.parse(savedConfig) } : DEFAULT_WIP_CONFIG;
    } catch {
      return DEFAULT_WIP_CONFIG;
    }
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('lira_wip_config', JSON.stringify(config));
    if (config.enabled) {
      localStorage.setItem('lira_wip_limits', JSON.stringify(config.limits));
    } else {
      localStorage.setItem('lira_wip_limits', JSON.stringify({}));
    }
    window.dispatchEvent(new Event('lira_wip_limits_changed'));
    onConfigSaved?.(config);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Work in Progress (WIP) Limits · ${space?.name || 'Workspace'}`} size="md">
      <div className="p-6 space-y-5 text-jira-text">
        <p className="text-xs text-jira-muted leading-relaxed">
          WIP limits restrict the maximum number of items in active workflow columns to prevent bottlenecks and enforce focus. Set 0 for unlimited.
        </p>

        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-jira-border">
          <div>
            <h4 className="text-sm font-bold text-jira-text">Enforce Column WIP Limits</h4>
            <p className="text-xs text-jira-muted">Visual warning indicators when a column exceeds its capacity</p>
          </div>
          <button
            type="button"
            onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              config.enabled ? 'bg-jira-blue' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Column limit inputs */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-jira-muted uppercase tracking-wider block">
            Column Capacity Maximums
          </label>

          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'todo' as const, label: 'To Do Limit', defaultVal: 5, desc: 'Ready for dev queue' },
              { key: 'inprogress' as const, label: 'In Progress Limit', defaultVal: 3, desc: 'Active execution cap' },
              { key: 'backlog' as const, label: 'Backlog Limit (0 = ∞)', defaultVal: 0, desc: 'Ideation pool' },
              { key: 'done' as const, label: 'Done Limit (0 = ∞)', defaultVal: 0, desc: 'Completed deliverables' },
            ].map(col => (
              <div key={col.key} className="p-3 bg-white border border-jira-border rounded-xl space-y-1">
                <div className="text-xs font-semibold text-jira-text">{col.label}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={config.limits[col.key]}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setConfig(prev => ({
                        ...prev,
                        limits: { ...prev.limits, [col.key]: val },
                      }));
                    }}
                    className="w-20 px-2 py-1 text-sm border border-jira-border rounded font-bold text-center bg-gray-50 focus:bg-white focus:border-jira-blue"
                  />
                  <span className="text-[11px] text-jira-muted">{col.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {saved && (
          <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" /> WIP limits saved successfully!
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-jira-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-jira-muted hover:text-jira-text rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700 cursor-pointer shadow-xs"
          >
            Save WIP Limits
          </button>
        </div>
      </div>

      {/* 2-second green toast */}
      {saved && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>✓ Saved</span>
        </div>
      )}
    </Modal>
  );
};

// ─── 3. Bulk Actions Modal ────────────────────────────────────────────────────

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
