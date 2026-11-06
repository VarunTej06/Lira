import React, { useEffect, useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import type { Issue, Priority } from '../../types/issue';
import { suggestForTicket } from '../../services/ai/suggest';

interface TicketSuggestionsProps {
  title: string;
  description: string;
  type: string;
  spaceId?: number;
  existing: Issue[];
  /** What is already filled in, so chips for those are hidden. */
  labels: string;
  priority: Priority;
  parentId?: number;
  onAddLabel: (label: string) => void;
  onPriority: (p: Priority) => void;
  onEpic: (id: number) => void;
  onOpenIssue?: (issue: Issue) => void;
}

/** Hints while writing a ticket: possible duplicates, labels, priority and the likely epic. Nothing is applied until you click. */
export const TicketSuggestions: React.FC<TicketSuggestionsProps> = ({
  title, description, type, spaceId, existing, labels, priority, parentId, onAddLabel, onPriority, onEpic, onOpenIssue,
}) => {
  // wait a moment after typing stops so the hints do not flicker
  const [settled, setSettled] = useState({ title, description });
  useEffect(() => {
    const t = window.setTimeout(() => setSettled({ title, description }), 350);
    return () => window.clearTimeout(t);
  }, [title, description]);

  const s = useMemo(
    () => (settled.title.trim().length >= 4 ? suggestForTicket(settled.title, settled.description, type, existing, spaceId) : null),
    [settled, type, existing, spaceId],
  );
  if (!s) return null;
  const have = new Set(labels.split(',').map(l => l.trim().toLowerCase()).filter(Boolean));
  const labelChips = s.labels.filter(l => !have.has(l.toLowerCase()));
  const showPriority = s.priority && s.priority !== priority;
  const showEpic = type !== 'epic' && type !== 'subtask' && s.epic && s.epic.id !== parentId;
  if (!s.duplicates.length && !labelChips.length && !showPriority && !showEpic) return null;

  const chip = 'px-2 py-0.5 rounded-full border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 text-[11px] font-medium cursor-pointer';
  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50/60 px-3 py-2.5 space-y-2" data-testid="ticket-suggestions" aria-live="polite">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-purple-700"><Lightbulb className="w-3.5 h-3.5" aria-hidden /> Viva suggests</div>
      {s.duplicates.length > 0 && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5" role="alert">
          <strong>Possible duplicate{s.duplicates.length > 1 ? 's' : ''}:</strong>
          <ul className="mt-0.5">
            {s.duplicates.map(d => (
              <li key={d.issue.id}>
                <button type="button" onClick={() => onOpenIssue?.(d.issue)} className="hover:underline text-left cursor-pointer">
                  {d.issue.key} {d.issue.title}
                </button>{' '}
                <span className="opacity-70">({Math.round(d.score * 100)}% similar · {d.issue.status})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {labelChips.map(l => <button key={l} type="button" className={chip} onClick={() => onAddLabel(l)}>+ {l}</button>)}
        {showPriority && <button type="button" className={chip} onClick={() => onPriority(s.priority!)} title={s.priorityReason}>Priority: {s.priority} ({s.priorityReason})</button>}
        {showEpic && <button type="button" className={chip} onClick={() => onEpic(s.epic!.id!)}>Epic: {s.epic!.key} {s.epic!.title}</button>}
      </div>
    </div>
  );
};
