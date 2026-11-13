import type { ReactNode } from 'react';
import type { Issue } from '../../../types/issue';
import { issueLink } from '../../../utils/links';

/** A ticket card inside a capacity column. `tag` is the small label at the top right; `compact` is the tighter spacing. */
export function WorkItemCard({ issue, tag, compact, onOpen }: { issue: Issue; tag: ReactNode; compact?: boolean; onOpen?: (issue: Issue) => void }) {
  return (
    <div
      onClick={() => onOpen?.(issue)} {...issueLink(issue)}
      className={`${compact ? 'p-2.5 hover:bg-lira-blue-light/30 space-y-1' : 'p-3 hover:bg-lira-blue-light/20 space-y-1.5'} rounded-lg border border-lira-border hover:border-lira-blue transition-all cursor-pointer text-xs bg-white group`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-lira-blue group-hover:underline">{issue.key}</span>
        {tag}
      </div>
      <div className="font-medium text-lira-text line-clamp-2 leading-snug">{issue.title}</div>
      <div className="flex items-center justify-between pt-1 text-3xs text-lira-muted border-t border-gray-100">
        <span>{issue.assignee || 'Unassigned'}</span>
        <span className="font-bold text-lira-text">{issue.storyPoints || 1} pts</span>
      </div>
    </div>
  );
}
