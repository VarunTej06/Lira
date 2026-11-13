import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Trash2, Edit3, Link as LinkIcon } from 'lucide-react';
import type { Issue } from '../../types/issue';
import { STATUS_LIST, statusLabel } from '../../utils/status';
import { deleteIssue, updateIssue } from '../../hooks/useIssues';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { parentFields } from './parentFields';

interface Props {
  issue: Issue;
  /** True when the ticket already has a parent (the "Link to parent" choice is then hidden). */
  hasParent: boolean;
  eligibleParents: Issue[];
  onOpen: (issue: Issue) => void;
}

/** The "..." menu on a card: open, link to a parent, set the status, delete. */
export function CardActions({ issue, hasParent, eligibleParents, onOpen }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const link = useRef<HTMLDivElement>(null);

  // A click outside closes whichever of the two menus is open
  useEffect(() => {
    if (!menuOpen && !linkOpen) return;
    const away = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menu.current && !menu.current.contains(target)) setMenuOpen(false);
      if (link.current && !link.current.contains(target)) setLinkOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [menuOpen, linkOpen]);

  const setStatus = async (e: React.MouseEvent, status: string) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (issue.id) await updateIssue(issue.id, { status });
  };

  return (
    <div ref={menu} className="relative" onClick={e => e.stopPropagation()}>
      <button onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 text-lira-muted hover:text-lira-text transition-all" title="Card actions">
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 bottom-6 z-30 bg-white border border-lira-border rounded-lg shadow-dropdown py-1 min-w-[160px] animate-scale-in">
          <button onClick={() => { setMenuOpen(false); onOpen(issue); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-lira-text">
            <Edit3 className="w-3.5 h-3.5 text-lira-muted" /> Open
          </button>
          {!hasParent && eligibleParents.length > 0 && (
            <button onClick={() => { setMenuOpen(false); setLinkOpen(true); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 text-lira-text">
              <LinkIcon className="w-3.5 h-3.5 text-lira-muted" /> Link to parent...
            </button>
          )}
          <div className="px-3 pt-1.5 pb-0.5 text-3xs font-semibold text-lira-muted uppercase tracking-wide">Set status</div>
          {STATUS_LIST.map(m => m.id as string).map(s => (
            <button key={s} onClick={e => setStatus(e, s)} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-lira-text ${issue.status === s ? 'font-semibold text-lira-blue' : ''}`}>
              {statusLabel(s)}
            </button>
          ))}
          <div className="border-t border-lira-border my-1" />
          <button onClick={e => { e.stopPropagation(); setMenuOpen(false); setConfirmDelete(true); }} className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}

      {linkOpen && (
        <div ref={link} className="absolute right-0 bottom-6 z-40 bg-white border border-lira-border rounded-lg shadow-dropdown py-1 min-w-[200px] max-w-[260px] max-h-56 overflow-y-auto animate-scale-in">
          <div className="px-3 py-1 text-3xs font-semibold text-lira-muted uppercase tracking-wide border-b border-gray-100">Select Parent</div>
          {eligibleParents.map(p => (
            <button
              key={p.id}
              onClick={async () => { setLinkOpen(false); if (issue.id && p.id) await updateIssue(issue.id, parentFields(p)); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1.5 truncate text-lira-text"
            >
              <span className="text-3xs font-mono text-lira-muted flex-shrink-0">{p.key}</span>
              <span className="truncate">{p.title}</span>
            </button>
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { if (issue.id) await deleteIssue(issue.id); setConfirmDelete(false); }}
        issueKey={issue.key}
        issueTitle={issue.title}
        isEpic={issue.type === 'epic'}
      />
    </div>
  );
}
