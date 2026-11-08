import React from 'react';
import { Zap, SquareCheckBig, Bug, CornerDownRight, ChevronsUp, ChevronUp, Equal, ChevronDown, ChevronsDown, type LucideIcon } from 'lucide-react';
import type { IssueType, Priority } from '../../types/issue';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';
import { PRIORITY_CONFIG } from '../../utils/priorityUtils';

/** The small picture for a work item type (Epic, Task, Bug, Subtask), in the type's own colour. */
export const TypeIcon: React.FC<{ type: IssueType | string; className?: string; colored?: boolean }> = ({ type, className = 'w-3.5 h-3.5', colored = true }) => {
  const color = colored ? (ISSUE_TYPE_CONFIG[type as IssueType]?.color ?? '#6B778C') : undefined;
  const props = { className: `${className} flex-shrink-0`, style: color ? { color } : undefined, 'aria-hidden': true };
  switch (type) {
    case 'epic': return <Zap {...props} />;
    case 'bug': return <Bug {...props} />;
    case 'subtask': return <CornerDownRight {...props} />;
    default: return <SquareCheckBig {...props} />;
  }
};

const PRIORITY_ICONS: Record<Priority, LucideIcon> = {
  highest: ChevronsUp,
  high: ChevronUp,
  medium: Equal,
  low: ChevronDown,
  lowest: ChevronsDown,
};

/** The small picture for a priority, in the priority's own colour. */
export const PriorityIcon: React.FC<{ priority: Priority | string; className?: string }> = ({ priority, className = 'w-3.5 h-3.5' }) => {
  const key = (priority in PRIORITY_ICONS ? priority : 'medium') as Priority;
  const Icon = PRIORITY_ICONS[key];
  return <Icon className={`${className} flex-shrink-0`} style={{ color: PRIORITY_CONFIG[key].color }} aria-hidden />;
};

/** Priority picture and its name, side by side. */
export const PriorityLabel: React.FC<{ priority: Priority | string; className?: string }> = ({ priority, className = '' }) => {
  const key = (priority in PRIORITY_ICONS ? priority : 'medium') as Priority;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${className}`} style={{ color: PRIORITY_CONFIG[key].color }}>
      <PriorityIcon priority={key} />
      {PRIORITY_CONFIG[key].label}
    </span>
  );
};

/** A small coloured disc, used where a priority or status is shown as a coloured dot. */
export const ColorDot: React.FC<{ color: string; className?: string }> = ({ color, className = 'w-2.5 h-2.5' }) => (
  <span className={`inline-block rounded-full flex-shrink-0 ${className}`} style={{ backgroundColor: color }} aria-hidden />
);

/** Type picture and its name. */
export const TypeLabel: React.FC<{ type: IssueType | string; className?: string }> = ({ type, className = '' }) => (
  <span className={`inline-flex items-center gap-1 ${className}`}>
    <TypeIcon type={type} />
    {ISSUE_TYPE_CONFIG[type as IssueType]?.label ?? type}
  </span>
);
