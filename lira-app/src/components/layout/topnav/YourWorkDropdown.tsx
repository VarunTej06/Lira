import { issueLink } from '../../../utils/links';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Issue } from '../../../types/issue';
import type { Space } from '../../../types/space';
import { useClickOutside, relativeTime, useHoverMenu, canHoverDevice } from './shared';
import { isMine } from '../../../utils/currentUser';

type YourWorkTab = 'worked' | 'assigned' | 'starred';

export const YourWorkDropdown: React.FC<{
  issues: Issue[];
  spaces: Space[];
  onSelectIssue?: (issue: Issue) => void;
}> = ({ issues, spaces, onSelectIssue }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<YourWorkTab>('worked');
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const hover = useHoverMenu(setOpen);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const spaceMap = useMemo(() => {
    const map: Record<number, Space> = {};
    spaces.forEach(s => { if (s.id) map[s.id] = s; });
    return map;
  }, [spaces]);

  const workedOn = useMemo(() => {
    return [...issues]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 8);
  }, [issues]);

  const assignedToMe = useMemo(() => {
    return issues.filter(i => isMine(i)).slice(0, 8);
  }, [issues]);

  const starred = useMemo(() => {
    return issues.filter(i => (i as unknown as { isStarred?: boolean }).isStarred).slice(0, 8);
  }, [issues]);

  const currentItems = tab === 'worked' ? workedOn : tab === 'assigned' ? assignedToMe : starred;

  const statusIcon = (status: string) => {
    if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
    if (status === 'inprogress') return <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
    return <AlertCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
  };

  return (
    <div ref={ref} className="relative" {...hover}>
      <button
        onClick={() => setOpen(v => (canHoverDevice() ? true : !v))}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-ui font-medium transition-all duration-200 cursor-pointer ${
          open ? 'bg-white/15 text-white shadow-inner' : 'text-white/80 hover:text-white hover:bg-white/10'
        }`}
      >
        Your work <ChevronDown className={`w-3 h-3 opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-[#1D2939] border border-white/10 rounded-2xl shadow-2xl z-50 animate-scale-in origin-top-left overflow-hidden transition-all duration-150">
          <div className="flex border-b border-white/10 px-2 pt-2 gap-1 bg-white/5">
            {[
              { id: 'worked' as const, label: 'Worked on' },
              { id: 'assigned' as const, label: 'Assigned to me' },
              { id: 'starred' as const, label: 'Starred' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors cursor-pointer ${
                  tab === t.id
                    ? 'bg-[#1D2939] text-white border-t border-x border-white/10'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {currentItems.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-6">
                {tab === 'starred' ? 'Star work items to see them here.' : 'No items found.'}
              </p>
            ) : (
              currentItems.map(issue => (
                <button
                  key={issue.key}
                  onClick={() => { onSelectIssue?.(issue); setOpen(false); }} {...issueLink(issue)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 transition-all duration-150 text-left cursor-pointer"
                >
                  {statusIcon(issue.status)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-3xs font-mono text-white/40 flex-shrink-0">{issue.key}</span>
                      <span className="text-xs text-white/80 truncate">{issue.title}</span>
                    </div>
                    <div className="text-3xs text-white/30">
                      {spaceMap[issue.spaceId]?.name ?? 'Space'} · {relativeTime(issue.updatedAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
