import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import type { Issue, IssueType } from '../../types/issue';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';
import { PRIORITY_CONFIG } from '../../utils/priorityUtils';
import { Avatar } from '../common/Avatar';
import { updateIssue } from '../../hooks/useIssues';

interface ChildIssuesProps {
  parentIssue: Issue;
  childIssues: Issue[];
  onIssueClick: (issue: Issue) => void;
  onCreateChild: (title: string, type: IssueType) => Promise<void>;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  backlog:    { label: 'Backlog',     color: '#6B778C', bg: '#F4F5F7' },
  todo:       { label: 'To Do',       color: '#172B4D', bg: '#DFE1E6' },
  inprogress: { label: 'In Progress', color: '#0052CC', bg: '#DEEBFF' },
  done:       { label: 'Done',        color: '#006644', bg: '#E3FCEF' },
};

function getAvailableChildTypes(parentType: IssueType): IssueType[] {
  if (parentType === 'epic') return ['task', 'bug'];
  if (parentType === 'task') return ['subtask', 'bug'];
  if (parentType === 'bug') return ['subtask'];
  return ['subtask'];
}

export const ChildIssues: React.FC<ChildIssuesProps> = ({
  parentIssue,
  childIssues,
  onIssueClick,
  onCreateChild,
}) => {
  const [addingTitle, setAddingTitle] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const availableTypes = getAvailableChildTypes(parentIssue.type);
  const [selectedChildType, setSelectedChildType] = useState<IssueType>(availableTypes[0]);

  // Keep child type in sync with parent type
  useEffect(() => {
    setSelectedChildType(getAvailableChildTypes(parentIssue.type)[0]);
  }, [parentIssue.type]);

  const handleCreate = async () => {
    if (!addingTitle.trim()) return;
    setCreating(true);
    try {
      await onCreateChild(addingTitle.trim(), selectedChildType);
      setAddingTitle('');
      setShowAdd(false);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (issue: Issue, status: string) => {
    if (!issue.id) return;
    await updateIssue(issue.id, { status });
  };

  return (
    <div className="space-y-1">
      {childIssues.length > 0 && (
        <div className="border border-jira-border rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-jira-border text-[11px] font-semibold text-jira-muted uppercase tracking-wide">
            <span>Work</span>
            <span className="w-16 text-center">Priority</span>
            <span className="w-8 text-center">User</span>
            <span className="w-24 text-right">Status</span>
          </div>

          {/* Rows */}
          {childIssues.map(child => {
            const cfg = ISSUE_TYPE_CONFIG[child.type] ?? ISSUE_TYPE_CONFIG.task;
            const pCfg = PRIORITY_CONFIG[child.priority] ?? PRIORITY_CONFIG.medium;
            const sBadge = STATUS_BADGE[child.status] ?? STATUS_BADGE.todo;

            return (
              <div
                key={child.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2 border-b border-jira-border last:border-0 hover:bg-gray-50 transition-colors group"
              >
                {/* Work column */}
                <button
                  onClick={() => onIssueClick(child)}
                  className="flex items-center gap-2 text-left min-w-0"
                >
                  <span className="flex-shrink-0 text-sm" style={{ color: cfg.color }}>{cfg.symbol}</span>
                  <span className="text-xs font-mono text-jira-muted flex-shrink-0">{child.key}</span>
                  <span className="text-sm text-jira-text group-hover:text-jira-blue transition-colors truncate">
                    {child.title}
                  </span>
                </button>

                {/* Priority */}
                <div className="w-16 text-center text-sm" title={pCfg.label}>
                  {pCfg.icon}
                </div>

                {/* Assignee */}
                <div className="w-8 flex justify-center">
                  {child.assigneeInitials
                    ? <Avatar initials={child.assigneeInitials} size="xs" />
                    : <div className="w-5 h-5 rounded-full border-2 border-dashed border-jira-border" />
                  }
                </div>

                {/* Status */}
                <div className="w-24 flex justify-end">
                  <select
                    value={child.status}
                    onChange={e => handleStatusChange(child, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className="text-xs font-semibold rounded-full px-2 py-0.5 border-none outline-none cursor-pointer"
                    style={{ color: sBadge.color, backgroundColor: sBadge.bg }}
                  >
                    <option value="backlog">Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="inprogress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add child input */}
      {showAdd ? (
        <div className="flex items-center gap-2 mt-2">
          {availableTypes.length > 1 ? (
            <select
              value={selectedChildType}
              onChange={e => setSelectedChildType(e.target.value as IssueType)}
              className="text-xs border border-jira-border rounded-md px-1.5 py-1.5 bg-white text-jira-text font-medium outline-none focus:border-jira-blue cursor-pointer"
            >
              {availableTypes.map(t => (
                <option key={t} value={t}>
                  {ISSUE_TYPE_CONFIG[t].symbol} {ISSUE_TYPE_CONFIG[t].label}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm flex-shrink-0" style={{ color: ISSUE_TYPE_CONFIG[selectedChildType]?.color }}>
              {ISSUE_TYPE_CONFIG[selectedChildType]?.symbol}
            </span>
          )}
          <input
            autoFocus
            value={addingTitle}
            onChange={e => setAddingTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setShowAdd(false); setAddingTitle(''); }
            }}
            placeholder={`${ISSUE_TYPE_CONFIG[selectedChildType]?.label || 'Child issue'} title…`}
            disabled={creating}
            className="flex-1 text-sm border border-jira-border rounded-md px-3 py-1.5 focus:outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !addingTitle.trim()}
            className="px-3 py-1.5 text-xs bg-jira-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {creating ? '…' : 'Add'}
          </button>
          <button onClick={() => { setShowAdd(false); setAddingTitle(''); }} className="text-xs text-jira-muted hover:text-jira-text px-2">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs text-jira-muted hover:text-jira-blue mt-1 py-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Create child issue
        </button>
      )}
    </div>
  );
};
