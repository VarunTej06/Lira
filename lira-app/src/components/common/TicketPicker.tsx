import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, X } from 'lucide-react';
import type { Issue, IssueType } from '../../types/issue';
import { TypeIcon } from './Icons';
import { AnimatePresence, motion, dialogBackdrop, dialogPanel } from './motionPresets';
import { useResetWhen } from '../../hooks/useResetWhen';
import { statusLabel } from '../../utils/status';

export interface PickedTicket { issue: Issue; relation?: string }

export interface TicketPickerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  hint: string;
  /** The round icon beside the title. */
  icon: React.ReactNode;
  tone?: 'default' | 'danger';
  /** The tickets that may be chosen. The caller decides which; the picker searches, filters by type and sorts them. */
  candidates: Issue[];
  /** Tickets of this space are listed first. */
  homeSpaceId?: number;
  /** Show the All / Epics / Tasks / Bugs / Subtasks filter (leave out when every candidate has the same type). */
  typeFilter?: boolean;
  /** When given, each chosen ticket gets a dropdown to say how it relates; the first is chosen to begin with. */
  relations?: readonly { value: string; label: string }[];
  /** When given, a box above the list creates a new ticket from a name instead of choosing one. */
  create?: { label: string; placeholder: string; onCreate: (name: string) => void };
  confirmLabel: string;
  emptyText: string;
  /** Prefix of the test ids: `<testId>-picker`, `<testId>-<KEY>`, `<testId>-confirm`. */
  testId: string;
  onPick: (picked: PickedTicket[]) => void;
}

const TYPES: { id: IssueType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'epic', label: 'Epics' }, { id: 'task', label: 'Tasks' }, { id: 'bug', label: 'Bugs' }, { id: 'subtask', label: 'Subtasks' },
];
const TONE = {
  default: { icon: 'bg-lira-blue-light text-lira-blue', confirm: 'bg-lira-blue hover:bg-lira-blue-hover text-lira-on-blue' },
  danger: { icon: 'bg-red-100 text-red-600', confirm: 'bg-red-600 hover:bg-red-700 text-white' },
};
const INPUT = 'w-full text-sm border border-lira-border rounded-lg py-2 focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue bg-white text-lira-text';

const Tick = () => <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.2 2.2L9.5 3.5" /></svg>;

/** The box that makes a new ticket from a name. Enter creates it. */
function CreateRow({ create }: { create: NonNullable<TicketPickerProps['create']> }) {
  const [name, setName] = useState('');
  const submit = () => { if (name.trim()) { create.onCreate(name.trim()); setName(''); } };
  return (
    <div className="flex items-center gap-2">
      <input
        value={name} onChange={e => setName(e.target.value)} placeholder={create.placeholder} aria-label={create.label}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        className={`${INPUT} px-3`}
      />
      <button type="button" onClick={submit} disabled={!name.trim()} data-testid="picker-create"
        className="flex items-center gap-1 px-3 py-2 text-sm font-semibold rounded-lg border border-lira-blue text-lira-blue hover:bg-lira-blue-light disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap">
        <Plus className="w-3.5 h-3.5" /> {create.label}
      </button>
    </div>
  );
}

/** A dialog to choose one or several tickets: search, filter by type, tick. Used for blockers, links and child tickets. */
export const TicketPicker: React.FC<TicketPickerProps> = (p) => {
  const { open, onClose, candidates, homeSpaceId, relations, testId } = p;
  const [query, setQuery] = useState('');
  const [type, setType] = useState<IssueType | 'all'>('all');
  const [chosen, setChosen] = useState<Record<number, string>>({}); // ticket id -> relation ('' when there are no relations)
  const tone = TONE[p.tone ?? 'default'];

  useResetWhen([open], () => { if (open) { setQuery(''); setType('all'); setChosen({}); } });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true); // before the ticket underneath sees Escape
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter(i => type === 'all' || i.type === type)
      .filter(i => !q || i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))
      .sort((a, b) => (a.spaceId === homeSpaceId ? 0 : 1) - (b.spaceId === homeSpaceId ? 0 : 1) || a.key.localeCompare(b.key, undefined, { numeric: true }))
      .slice(0, 100);
  }, [candidates, homeSpaceId, query, type]);

  const toggle = (id: number) => setChosen(c => {
    if (id in c) { const { [id]: _gone, ...rest } = c; return rest; }
    return { ...c, [id]: relations?.[0].value ?? '' };
  });
  const picked = Object.keys(chosen).map(Number).map(id => candidates.find(i => i.id === id)).filter((i): i is Issue => !!i);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key={`${testId}-picker`} {...dialogBackdrop} className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div {...dialogPanel} role="dialog" aria-modal="true" aria-label={p.title} data-testid={`${testId}-picker`}
            className="bg-white rounded-xl shadow-2xl border border-lira-border w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-start justify-between px-5 py-4 border-b border-lira-border">
              <div className="flex items-start gap-3">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tone.icon}`}>{p.icon}</span>
                <div>
                  <h2 className="text-base font-bold text-lira-text">{p.title}</h2>
                  <p className="text-xs text-lira-muted mt-0.5">{p.hint}</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-5 pt-4 space-y-3">
              {p.create && <CreateRow create={p.create} />}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-lira-muted" />
                <input autoFocus={!p.create} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by key or title" aria-label="Search tickets" className={`${INPUT} pl-9 pr-3`} />
              </div>
              {p.typeFilter && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ticket type">
                  {TYPES.map(t => (
                    <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full border cursor-pointer transition-colors ${type === t.id ? 'bg-lira-blue text-lira-on-blue border-lira-blue' : 'border-lira-border text-lira-muted hover:bg-gray-50'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ul className="flex-1 min-h-[160px] overflow-y-auto px-3 py-3" aria-label="Tickets">
              {shown.length === 0 && <li className="text-sm text-lira-muted text-center py-8">{p.emptyText}</li>}
              {shown.map(i => {
                const on = i.id! in chosen;
                return (
                  <li key={i.id} className={`flex items-center gap-2 rounded-lg transition-colors ${on ? 'bg-lira-blue-light ring-1 ring-lira-blue' : 'hover:bg-gray-50'}`}>
                    <label data-testid={`${testId}-${i.key}`} className="flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-2 cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={on} onChange={() => toggle(i.id!)} />
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-lira-blue ${on ? 'bg-lira-blue border-lira-blue text-lira-on-blue' : 'border-gray-300 bg-white'}`}>{on && <Tick />}</span>
                      <TypeIcon type={i.type} className="w-4 h-4 flex-shrink-0" />
                      <span className="font-mono text-xs font-semibold text-lira-muted w-20 flex-shrink-0">{i.key}</span>
                      <span className="flex-1 min-w-0 text-sm text-lira-text truncate">{i.title}</span>
                      <span className="text-3xs text-lira-muted flex-shrink-0">{statusLabel(i.status)}</span>
                    </label>
                    {on && relations && (
                      <select value={chosen[i.id!]} onChange={e => setChosen(c => ({ ...c, [i.id!]: e.target.value }))} aria-label={`How ${i.key} is linked`} data-testid={`${testId}-relation-${i.key}`}
                        className="mr-2 text-xs border border-lira-border rounded-md px-1.5 py-1 bg-white text-lira-text cursor-pointer flex-shrink-0">
                        {relations.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-lira-border bg-gray-50/60">
              <span className="text-xs text-lira-muted truncate">{picked.length === 0 ? 'Select one or more tickets' : `${picked.length} selected: ${picked.map(c => c.key).join(', ')}`}</span>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text rounded-lg cursor-pointer">Cancel</button>
                <button disabled={picked.length === 0} data-testid={`${testId}-confirm`} onClick={() => p.onPick(picked.map(issue => ({ issue, relation: chosen[issue.id!] || undefined })))}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${tone.confirm}`}>
                  {p.confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
