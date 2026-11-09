import { issueLink } from '../../utils/links';
import { TypeIcon, PriorityIcon } from '../common/Icons';
import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Calendar, Ban } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { formatDueDate, isDueSoon, isOverdue } from '../../utils/dateUtils';
import { canBeParent } from '../../utils/hierarchy';
import { getPriorityConfig } from '../../utils/priorityUtils';
import { Avatar } from '../common/Avatar';
import { ParentPill } from './ParentPill';
import { CardActions } from './CardActions';

interface IssueCardProps {
  issue: Issue;
  index: number;
  space?: Space;
  allIssues?: Issue[];
  onClick: (issue: Issue) => void;
}

const STATUS_ACCENT: Record<string, string> = { inprogress: '#FFAB00', done: '#36B37E' };

function dueDateColor(issue: Issue): string {
  if (!issue.dueDate || issue.status === 'done') return 'text-lira-muted';
  if (isOverdue(issue.dueDate)) return 'text-red-500';
  return isDueSoon(issue.dueDate) ? 'text-amber-500' : 'text-lira-muted';
}

export const IssueCard: React.FC<IssueCardProps> = ({ issue, index, allIssues = [], onClick }) => {
  const priority = getPriorityConfig(issue.priority);
  const accentColor = issue.blocked ? '#DE350B' : STATUS_ACCENT[issue.status];
  const blockers = (issue.blockedByIds ?? []).map(id => allIssues.find(i => i.id === id)).filter((i): i is Issue => !!i);
  const subtasks = Array.isArray(issue.subtasks) ? issue.subtasks : [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const labels = Array.isArray(issue.labels) ? issue.labels : [];

  const parentIssue = allIssues.find(
    i => (issue.parentId && i.id === issue.parentId) || (issue.epicId && i.id === issue.epicId) || (issue.epicLink && (i.title === issue.epicLink || i.key === issue.epicLink)),
  );
  const eligibleParents = allIssues.filter(i => canBeParent(issue, i));

  return (
    <Draggable draggableId={String(issue.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg shadow-card border border-lira-border cursor-pointer group hover:shadow-card-hover overflow-hidden ${snapshot.isDragging ? 'shadow-modal rotate-1 opacity-90 scale-[1.02]' : ''}`}
        >
          {accentColor && <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />}

          <div className="p-3" onClick={() => onClick(issue)} {...issueLink(issue)}>
            <p className="text-sm font-medium text-lira-text leading-snug mb-2 line-clamp-3 group-hover:text-lira-blue transition-colors">{issue.title}</p>

            {parentIssue && <ParentPill issue={issue} parent={parentIssue} eligibleParents={eligibleParents} onOpen={onClick} />}

            {issue.blocked && (
              <span data-testid="blocked-badge" className="inline-flex items-center gap-1 mb-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-red-100 text-red-700" title="This ticket is blocked">
                <Ban className="w-3 h-3" /> Blocked{blockers.length ? ` by ${blockers[0].key}${blockers.length > 1 ? ` +${blockers.length - 1}` : ''}` : ''}
              </span>
            )}

            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {labels.slice(0, 3).map(label => <span key={label} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600">{label}</span>)}
                {labels.length > 3 && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-lira-muted">+{labels.length - 3}</span>}
              </div>
            )}

            {subtasks.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] text-lira-muted mb-0.5">
                  <span>{completedSubtasks}/{subtasks.length} tasks</span>
                  <span>{Math.round((completedSubtasks / subtasks.length) * 100)}%</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(completedSubtasks / subtasks.length) * 100}%`, backgroundColor: accentColor ?? '#0052CC' }} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-1 mt-2.5 pt-2 border-t border-gray-50">
              <div className="flex items-center gap-1.5 min-w-0">
                <TypeIcon type={issue.type} className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold text-lira-muted font-mono">{issue.key}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {issue.dueDate && (
                  <div className={`flex items-center gap-1 text-[10px] font-medium ${dueDateColor(issue)}`}>
                    <Calendar className="w-2.5 h-2.5" />{formatDueDate(issue.dueDate)}
                  </div>
                )}
                <span title={priority.label}><PriorityIcon priority={issue.priority} className="w-4 h-4" /></span>
                {issue.assigneeInitials && <Avatar initials={issue.assigneeInitials} size="xs" color="#0052CC" />}
                <CardActions issue={issue} hasParent={!!parentIssue} eligibleParents={eligibleParents} onOpen={onClick} />
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
