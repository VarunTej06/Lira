import React, { useEffect, useRef, useState } from 'react';
import { Filter } from 'lucide-react';
import { AnimatePresence, motion, menuPop } from '../common/motion';
import type { Space } from '../../types/space';

export interface SprintFilterValue { statuses: string[]; spaceIds: number[] }
export const EMPTY_FILTER: SprintFilterValue = { statuses: [], spaceIds: [] };
const STATUSES = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
];

interface SprintFilterProps {
  spaces: Space[];
  value: SprintFilterValue;
  onChange: (v: SprintFilterValue) => void;
}

/** Dropdown that narrows the ticket list of a sprint by status and by space. Nothing ticked = no filter. */
export const SprintFilter: React.FC<SprintFilterProps> = ({ spaces, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = value.statuses.length + value.spaceIds.length;

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const flip = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter(v => v !== x) : [...xs, x]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border cursor-pointer ${count ? 'border-jira-blue bg-jira-blue-light text-jira-blue' : 'border-jira-border bg-white text-jira-text hover:bg-gray-50'}`}
      >
        <Filter className="w-3.5 h-3.5" aria-hidden /> Filter{count > 0 && <span className="text-[11px] font-semibold">({count})</span>}
      </button>
      <AnimatePresence>
      {open && (
        <motion.div {...menuPop} style={{ transformOrigin: 'top left' }} className="absolute z-30 mt-1 left-0 w-72 bg-white border border-jira-border rounded-xl shadow-xl p-3 space-y-3" role="dialog" aria-label="Filter tickets">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-jira-muted mb-1">Status</div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <label key={s.id} className={`text-xs rounded-full border px-2.5 py-1 cursor-pointer ${value.statuses.includes(s.id) ? 'border-jira-blue bg-jira-blue text-white' : 'border-jira-border bg-white text-jira-text'}`}>
                  <input type="checkbox" className="sr-only" checked={value.statuses.includes(s.id)} onChange={() => onChange({ ...value, statuses: flip(value.statuses, s.id) })} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-jira-muted mb-1">Space</div>
            <div className="max-h-44 overflow-y-auto space-y-0.5">
              {spaces.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-jira-text rounded px-1.5 py-1 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={value.spaceIds.includes(s.id!)} onChange={() => onChange({ ...value, spaceIds: flip(value.spaceIds, s.id!) })} />
                  <span className="truncate">{s.icon} {s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={() => onChange(EMPTY_FILTER)} disabled={!count} className="text-xs text-jira-blue hover:underline disabled:opacity-40 cursor-pointer">Clear filter</button>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};
