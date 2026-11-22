import { useState, type ReactNode } from 'react';
import { TypeIcon } from '../common/Icons';
import { Avatar } from '../common/Avatar';
import type { Issue } from '../../types/issue';
import { CommentBox, CommentIcon } from './QuickComment';

export const FIELD = 'w-full text-sm border border-lira-border rounded-xl px-3 py-2 bg-white text-lira-text focus:outline-none focus:border-lira-blue';
export const LABEL = 'block text-2xs font-semibold text-lira-muted mb-1 uppercase tracking-wide';

/** One ticket line in the agenda. Clicking it opens the ticket; the comment icon (shown on hover) writes a comment without leaving the call. */
export function TicketRow({ issue, note, tone, onOpen }: { issue: Issue; note?: string; tone?: string; onOpen: (issue: Issue) => void }) {
  const [commenting, setCommenting] = useState(false);
  return (
    <div className="border-b border-lira-border last:border-0">
      <div onClick={() => onOpen(issue)} className="group w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors cursor-pointer">
        <TypeIcon type={issue.type} className="w-4 h-4" />
        <span className="font-mono text-2xs text-lira-muted w-20 flex-shrink-0">{issue.key}</span>
        <button type="button" className="flex-1 min-w-0 text-sm text-lira-text truncate text-left cursor-pointer">{issue.title}</button>
        <CommentIcon open={commenting} onToggle={() => setCommenting(o => !o)} />
        {note && <span className={`text-3xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${tone || 'bg-gray-100 text-gray-600'}`}>{note}</span>}
        <Avatar initials={issue.assigneeInitials} size="xs" />
      </div>
      {commenting && <CommentBox issue={issue} onClose={() => setCommenting(false)} />}
    </div>
  );
}

/** One ticket in a person's card: the same hover comment icon as in the agenda. */
export function PersonTicket({ issue, onOpen }: { issue: Issue; onOpen: (issue: Issue) => void }) {
  const [commenting, setCommenting] = useState(false);
  return (
    <>
      <div className="group flex items-center gap-1">
        <button onClick={() => onOpen(issue)} className="flex-1 min-w-0 text-left text-xs text-lira-text truncate hover:text-lira-blue cursor-pointer py-0.5">
          <span className="font-mono text-lira-muted mr-1.5">{issue.key}</span>{issue.title}
        </button>
        <CommentIcon open={commenting} onToggle={() => setCommenting(o => !o)} />
      </div>
      {commenting && <CommentBox issue={issue} onClose={() => setCommenting(false)} />}
    </>
  );
}

/** A titled box of rows, with a line to show when there are none. */
export function Section({ title, icon, count, empty, children }: { title: string; icon: ReactNode; count: number; empty: string; children: ReactNode }) {
  return (
    <section className="border border-lira-border rounded-2xl overflow-hidden bg-white">
      <header className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-lira-border">
        {icon}<h3 className="text-xs font-semibold text-lira-text uppercase tracking-wide">{title}</h3>
        <span className="text-2xs text-lira-muted">{count}</span>
      </header>
      {count === 0 ? <p className="px-3 py-4 text-xs text-lira-muted">{empty}</p> : children}
    </section>
  );
}
