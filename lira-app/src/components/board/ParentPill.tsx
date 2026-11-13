import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Link2 } from 'lucide-react';
import type { Issue } from '../../types/issue';
import { updateIssue } from '../../hooks/useIssues';
import { parentFields } from './parentFields';


interface Props {
  issue: Issue;
  parent: Issue;
  /** Tickets this one may be moved under. */
  eligibleParents: Issue[];
  onOpen: (issue: Issue) => void;
}

const MENU_HEIGHT = 240;

/** The pill showing a ticket's parent. Its menu opens the parent, moves the ticket under another one, or unlinks it. */
export function ParentPill({ issue, parent, eligibleParents, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // The menu is drawn on the page itself (a portal), so a click inside it must not count as outside
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (menu.current && !menu.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) return setOpen(false);
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const fitsBelow = window.innerHeight - rect.bottom >= MENU_HEIGHT || rect.top <= MENU_HEIGHT;
    setCoords({
      top: fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - MENU_HEIGHT - 4),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 290)),
      width: Math.max(rect.width, 260),
    });
    setOpen(true);
  };

  const change = async (fields: Partial<Issue>) => {
    setOpen(false);
    if (issue.id) await updateIssue(issue.id, fields);
  };

  return (
    <div className="relative mb-2.5" onClick={e => e.stopPropagation()}>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-2.5 py-1 text-xs border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 rounded-md text-lira-text font-normal transition-colors text-left group/parent shadow-2xs"
        title={`Parent: ${parent.key} — ${parent.title}`}
      >
        <span className="truncate text-xs text-lira-text font-normal pr-1">{parent.title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 group-hover/parent:text-lira-blue transition-transform duration-150 ${open ? 'rotate-180 text-lira-blue' : ''}`} />
      </button>

      {open && coords && createPortal(
        <div
          ref={menu}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 9999 }}
          onClick={e => e.stopPropagation()}
          className="bg-white border border-lira-border rounded-xl shadow-2xl py-1 max-h-60 overflow-y-auto animate-scale-in"
        >
          <div className="px-3 py-1.5 text-3xs font-semibold text-lira-muted uppercase tracking-wider border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <span>Linked Parent</span>
            <span className="font-mono text-4xs bg-gray-200/80 px-1.5 py-0.5 rounded text-lira-text font-semibold">{parent.key}</span>
          </div>

          <button type="button" onClick={() => { setOpen(false); onOpen(parent); }} className="w-full text-left px-3 py-2 text-xs text-lira-blue hover:bg-lira-blue-light font-medium flex items-center gap-2 border-b border-gray-100 transition-colors">
            <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Open {parent.key} ({parent.title})</span>
          </button>

          {eligibleParents.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-3xs text-lira-muted font-medium bg-gray-50/80">Change parent to:</div>
              {eligibleParents.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => p.id && change({ ...parentFields(p), epicLink: p.title })}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1.5 truncate transition-colors ${p.id === parent.id ? 'bg-lira-blue-light text-lira-blue font-semibold' : 'text-lira-text'}`}
                >
                  <span className="text-3xs font-mono text-lira-muted flex-shrink-0">{p.key}</span>
                  <span className="truncate">{p.title}</span>
                </button>
              ))}
            </>
          )}

          <button type="button" onClick={() => change({ parentId: undefined, epicId: undefined, epicLink: undefined })} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 border-t border-gray-100 font-medium transition-colors">
            Unlink parent
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
