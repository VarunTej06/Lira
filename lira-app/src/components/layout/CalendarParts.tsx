import type { ReactNode } from 'react';
import { CheckCircle2, GripVertical } from 'lucide-react';
import { issueLink } from '../../utils/links';
import { TypeIcon } from '../common/Icons';
import type { Issue } from '../../types/issue';
import { chipTone } from './calendarTones';

interface DragHandlers {
  draggingId: number | null | undefined;
  onDragStart: (e: React.DragEvent, issue: Issue) => void;
  onDragEnd: () => void;
}

/** A ticket on a day: type, key (struck through when done), a tick and the title. Click opens it, drag changes the due date. */
export function IssueChip({ issue, drag, onSelect }: { issue: Issue; drag: DragHandlers; onSelect: (issue: Issue) => void }) {
  const isDone = issue.status === 'done';
  return (
    <div
      draggable
      onDragStart={e => drag.onDragStart(e, issue)}
      onDragEnd={drag.onDragEnd}
      onClick={() => onSelect(issue)} {...issueLink(issue)}
      className={`text-2xs px-1.5 py-1 rounded-md border-l-[3px] leading-tight cursor-grab active:cursor-grabbing transition-all hover:shadow-sm hover:-translate-y-px group select-none ${chipTone(issue)} ${drag.draggingId === issue.id ? 'opacity-40 scale-95' : ''} ${isDone ? 'opacity-70' : ''}`}
      title={`${issue.key} · ${issue.title}. Drag to change the due date.`}
    >
      <div className="flex items-center gap-1 min-w-0">
        <TypeIcon type={issue.type} className="w-3 h-3" />
        <span className={`font-mono text-3xs font-semibold text-lira-text ${isDone ? 'line-through' : ''}`}>{issue.key}</span>
        {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto flex-shrink-0" />}
      </div>
      <div className="truncate text-3xs text-lira-muted mt-0.5">{issue.title}</div>
    </div>
  );
}

/** A ticket with no due date, in the tray under the calendar. */
export function UnscheduledChip({ issue, drag, onSelect }: { issue: Issue; drag: DragHandlers; onSelect: (issue: Issue) => void }) {
  return (
    <div
      draggable
      onDragStart={e => drag.onDragStart(e, issue)}
      onDragEnd={drag.onDragEnd}
      onClick={() => onSelect(issue)} {...issueLink(issue)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border rounded-lg text-xs transition-all cursor-grab active:cursor-grabbing select-none group ${drag.draggingId === issue.id ? 'opacity-40 border-dashed border-lira-blue scale-95' : 'border-lira-border hover:border-lira-blue hover:shadow-xs'}`}
      title="Drag onto a day to set the due date, or click to open"
    >
      <GripVertical className="w-3 h-3 text-lira-muted group-hover:text-lira-blue" />
      <TypeIcon type={issue.type} className="w-3.5 h-3.5" />
      <span className="font-mono font-bold text-lira-blue">{issue.key}</span>
      <span className="truncate max-w-[180px] text-lira-text text-2xs font-medium">{issue.title}</span>
    </div>
  );
}

/** The "+N more" / "Show less" link under a busy day. */
export function MoreToggle({ expanded, hidden, onToggle }: { expanded: boolean; hidden: number; onToggle: () => void }): ReactNode {
  return (
    <button onClick={onToggle} className="w-full text-left text-3xs font-semibold text-lira-blue hover:underline px-1 cursor-pointer">
      {expanded ? 'Show less' : `+${hidden} more`}
    </button>
  );
}
