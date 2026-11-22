import { useState } from 'react';
import type { Issue } from '../../types/issue';
import { updateIssue } from '../../hooks/useIssues';
import { newComment, plainToCommentHtml } from '../issue/commentUtils';

/** Shown only while the row is hovered or focused (a touch screen has no hover, so there it is always shown). */
const SHOW_ON_HOVER = 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100';

/** The comment icon of a ticket row. */
export function CommentIcon({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-label="Add a comment" aria-expanded={open} title="Add a comment"
      onClick={e => { e.stopPropagation(); onToggle(); }}
      className={`flex-shrink-0 p-1 rounded-md text-lira-muted hover:text-lira-blue hover:bg-gray-100 cursor-pointer ${open ? 'opacity-100 text-lira-blue' : SHOW_ON_HOVER}`}>
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}

/** Writes a comment on the ticket without leaving the call. Ctrl+Enter posts, Escape closes. */
export function CommentBox({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const [text, setText] = useState('');
  const post = async () => {
    if (!text.trim() || !issue.id) return;
    await updateIssue(issue.id, { comments: [...(issue.comments ?? []), newComment({ html: plainToCommentHtml(text), files: [] })] });
    onClose();
  };
  return (
    <div className="px-3 pb-2 pt-1 flex flex-col gap-1.5 bg-gray-50 border-b border-lira-border last:border-0" onClick={e => e.stopPropagation()}>
      <textarea autoFocus rows={2} value={text} aria-label={`Comment on ${issue.key}`} placeholder="Write a comment"
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void post(); }}
        className="w-full text-xs border border-lira-border rounded-lg px-2 py-1.5 bg-white text-lira-text focus:outline-none focus:border-lira-blue" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="text-2xs px-2.5 py-1 rounded-lg text-lira-muted hover:text-lira-text cursor-pointer">Cancel</button>
        <button type="button" disabled={!text.trim()} onClick={() => void post()}
          className="text-2xs px-2.5 py-1 rounded-lg bg-lira-blue text-lira-on-blue disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">Post</button>
      </div>
    </div>
  );
}
