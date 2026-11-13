import { GripVertical, Minus, Plus } from 'lucide-react';
import { issueLink } from '../../utils/links';
import { TypeIcon } from '../common/Icons';
import type { Issue } from '../../types/issue';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';
import type { Space } from '../../types/space';
import { getIssueSprint, sprintName } from '../../utils/sprintUtils';
import { Avatar } from '../common/Avatar';
import { SprintChip } from './sprintParts';
import { statusMeta } from './statusMeta';

interface Props {
  issue: Issue;
  side: 'sprint' | 'backlog';
  space?: Space;
  showSpace: boolean;
  closed: boolean;
  /** Where the − button sends the ticket. */
  outSprint: string;
  onOpen: (issue: Issue) => void;
  onDragStart: (e: React.DragEvent, issue: Issue) => void;
  onMove: (issue: Issue) => void;
}

/** One ticket in the planning lists: drag handle, type, key, title, chips, points, assignee and the + / − button. */
export function PlanningCard({ issue: i, side, space, showSpace, closed, outSprint, onOpen, onDragStart, onMove }: Props) {
  const type = ISSUE_TYPE_CONFIG[i.type] ?? ISSUE_TYPE_CONFIG.task;
  const st = statusMeta(i.status);
  const estimated = typeof i.storyPoints === 'number';
  return (
    <div
      draggable={!closed}
      onDragStart={e => onDragStart(e, i)}
      onClick={() => onOpen(i)} {...issueLink(i)}
      className="group flex items-center gap-2 px-2.5 py-2 border border-lira-border bg-white rounded-lg hover:shadow-sm cursor-pointer"
      data-testid={`plan-${side}-${i.key}`}
    >
      <GripVertical className="w-3.5 h-3.5 text-lira-muted flex-shrink-0 cursor-grab" aria-hidden />
      <span title={type.label} className="flex-shrink-0"><TypeIcon type={i.type} className="w-4 h-4" /></span>
      <span className="text-2xs font-medium text-lira-muted flex-shrink-0">{i.key}</span>
      <span className="flex-1 min-w-0 text-sm text-lira-text truncate">{i.title}</span>
      {showSpace && space && (
        <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 flex-shrink-0">{space.key}</span>
      )}
      {side === 'backlog' && i.status !== 'backlog' && <SprintChip sprint={getIssueSprint(i)} />}
      <span className="text-3xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: st.color, backgroundColor: st.bg }}>{st.label}</span>
      <span
        className={`text-3xs rounded-full px-1.5 py-0.5 flex-shrink-0 ${estimated ? 'bg-gray-100 text-gray-700' : 'bg-amber-50 text-amber-700'}`}
        title={estimated ? 'Story points' : 'Not estimated'}
      >
        {estimated ? i.storyPoints : '?'}
      </span>
      <Avatar initials={i.assigneeInitials} size="xs" />
      {!closed && (
        <button
          onClick={e => { e.stopPropagation(); onMove(i); }}
          className="p-1 rounded-md border border-lira-border bg-white hover:bg-gray-50 cursor-pointer flex-shrink-0"
          aria-label={side === 'backlog' ? `Add ${i.key} to sprint` : `Move ${i.key} out of sprint`}
          title={side === 'backlog' ? 'Add to this sprint' : `Move to ${sprintName(outSprint)}`}
        >
          {side === 'backlog' ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}
