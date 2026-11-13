import { issueLink } from '../../utils/links';
import { STATUS_META } from '../../utils/status';
import { TypeIcon, PriorityIcon } from '../common/Icons';
import React from 'react';
import type { Issue } from '../../types/issue';
import { PRIORITY_CONFIG } from '../../utils/priorityUtils';
import { Avatar } from '../common/Avatar';
import { updateIssue } from '../../hooks/useIssues';

interface ChildIssuesProps {
  childIssues: Issue[];
  onIssueClick: (issue: Issue) => void;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = STATUS_META;

/** The tickets one level below this one, each with its priority, assignee and a status that can be changed in place. */
export const ChildIssues: React.FC<ChildIssuesProps> = ({ childIssues, onIssueClick }) => {
  if (childIssues.length === 0) return <p className="text-xs text-lira-muted py-1" data-testid="no-children">No tickets linked.</p>;
  return (
    <div className="border border-lira-border rounded-lg overflow-hidden" data-testid="child-issues">
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-lira-border text-2xs font-semibold text-lira-muted uppercase tracking-wide">
        <span>Work</span>
        <span className="w-16 text-center">Priority</span>
        <span className="w-8 text-center">User</span>
        <span className="w-24 text-right">Status</span>
      </div>
      {childIssues.map(child => {
        const pCfg = PRIORITY_CONFIG[child.priority] ?? PRIORITY_CONFIG.medium;
        const sBadge = STATUS_BADGE[child.status] ?? STATUS_BADGE.todo;
        return (
          <div key={child.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2 border-b border-lira-border last:border-0 hover:bg-gray-50 transition-colors group">
            <button onClick={() => onIssueClick(child)} {...issueLink(child)} className="flex items-center gap-2 text-left min-w-0">
              <TypeIcon type={child.type} className="w-4 h-4" />
              <span className="text-xs font-mono text-lira-muted flex-shrink-0">{child.key}</span>
              <span className="text-sm text-lira-text group-hover:text-lira-blue transition-colors truncate">{child.title}</span>
            </button>
            <div className="w-16 text-center text-sm" title={pCfg.label}>
              <span className="inline-flex justify-center"><PriorityIcon priority={child.priority} className="w-4 h-4" /></span>
            </div>
            <div className="w-8 flex justify-center">
              {child.assigneeInitials ? <Avatar initials={child.assigneeInitials} size="xs" /> : <div className="w-5 h-5 rounded-full border-2 border-dashed border-lira-border" />}
            </div>
            <div className="w-24 flex justify-end">
              <select
                value={child.status}
                onChange={e => { if (child.id) void updateIssue(child.id, { status: e.target.value }); }}
                onClick={e => e.stopPropagation()}
                aria-label={`Status of ${child.key}`}
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
  );
};
