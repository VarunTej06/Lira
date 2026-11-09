import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Flame, Plus, Search, X } from 'lucide-react';
import type { Issue, IssueType } from '../../../types/issue';
import { useAllIssues } from '../../../hooks/useIssues';
import { TypeIcon } from '../../common/Icons';
import { AnimatePresence, motion } from '../../common/motionPresets';
import { dialogBackdrop, dialogPanel } from '../../common/motionPresets';
import { BLOCKED_META } from '../../../utils/status';
import { useResetWhen } from '../../../hooks/useResetWhen';
import { NO_ISSUES } from '../../../utils/emptyLists';

/**
 * The Blocked switch of a ticket: a two-part pill ("Not blocked" | "Blocked").
 * Turning it on asks which tickets (epics, tasks, bugs or subtasks) the work is waiting on; one or several can be chosen.
 * Once blocked, pressing Blocked again does nothing: the blocking tickets are changed from the list below the pill.
 * A ticket that blocks others lists them under "This ticket is blocking".
 */
interface ToggleProps {
  issue: Issue;
  blocked: boolean;
  /** The tickets this one is blocked by. */
  blockers: Issue[];
  /** The tickets that are blocked by this one. */
  blocking: Issue[];
  /** Called with the ids of all the blocking tickets (empty = not blocked). */
  onChange: (ids: number[]) => void;
  onOpenIssue?: (issue: Issue) => void;
}

const FLAMES = [
  { left: '8%', top: '-9px', delay: '0s', dx: '-3px', size: 11 },
  { left: '28%', top: '-11px', delay: '0.5s', dx: '2px', size: 13 },
  { left: '50%', top: '-12px', delay: '0.2s', dx: '-2px', size: 14 },
  { left: '72%', top: '-10px', delay: '0.8s', dx: '3px', size: 12 },
  { left: '92%', top: '-8px', delay: '0.35s', dx: '2px', size: 11 },
  { left: '-3px', top: '30%', delay: '0.65s', dx: '-4px', size: 11 },
  { left: 'calc(100% - 9px)', top: '25%', delay: '0.95s', dx: '4px', size: 11 },
];

/** Small flames that keep rising around the white half of the switch while the ticket is blocked. */
const Fire: React.FC = () => (
  <span aria-hidden className="lira-fire-wrap">
    {FLAMES.map((f, i) => (
      <Flame
        key={i}
        className="lira-flame"
        style={{ left: f.left, top: f.top, width: f.size, height: f.size, animationDelay: f.delay, ['--dx' as string]: f.dx }}
      />
    ))}
  </span>
);

export const BlockedToggle: React.FC<ToggleProps> = ({ issue, blocked, blockers, blocking, onChange, onOpenIssue }) => {
  const [picking, setPicking] = useState(false);
  const ids = blockers.map(b => b.id!).filter(Boolean);

  const option = (on: boolean, label: string) => {
    const selected = blocked === on;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        data-testid={on ? 'blocked-on' : 'blocked-off'}
        onClick={() => {
          if (on) { if (!blocked) setPicking(true); } // already blocked: nothing to ask, use the list below to change tickets
          else if (blocked) onChange([]);
        }}
        className={`relative z-10 flex-1 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors duration-200 whitespace-nowrap ${
          selected ? 'text-[var(--blocked-track)] cursor-default' : 'text-white cursor-pointer'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div>
      <p id="issue-blocked-label" className="text-xs font-semibold text-lira-muted uppercase tracking-wider mb-2">Blocked</p>
      <div
        role="radiogroup"
        aria-labelledby="issue-blocked-label"
        data-testid="blocked-toggle"
        style={{ ['--blocked-track' as string]: blocked ? BLOCKED_META.color : 'rgb(var(--lira-blue))', backgroundColor: blocked ? BLOCKED_META.color : 'rgb(var(--lira-blue))' }}
        className="relative flex p-1 rounded-full transition-colors duration-300"
      >
        <motion.span
          aria-hidden
          data-testid="blocked-pill"
          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm ${blocked ? 'lira-fire' : ''}`}
          initial={false}
          animate={{ left: blocked ? 'calc(50% + 0px)' : '4px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        >
          {blocked && <Fire />}
        </motion.span>
        {option(false, 'Not blocked')}
        {option(true, 'Blocked')}
      </div>

      {blocked && blockers.length > 0 && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs" data-testid="blocked-by">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-3xs font-semibold uppercase tracking-wide text-red-700"><Ban className="w-3.5 h-3.5" /> Blocked by</div>
            <button type="button" onClick={() => setPicking(true)} data-testid="blocked-add" className="flex items-center gap-0.5 text-lira-blue font-semibold hover:underline cursor-pointer">
              <Plus className="w-3 h-3" /> {blockers.length === 1 ? 'Add or change' : 'Add'}
            </button>
          </div>
          {blockers.length === 1 ? (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => onOpenIssue?.(blockers[0])} className="flex items-center gap-1.5 min-w-0 flex-1 text-left text-lira-text hover:text-lira-blue cursor-pointer" title={`Open ${blockers[0].key}`}>
                <TypeIcon type={blockers[0].type} className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-mono font-semibold flex-shrink-0">{blockers[0].key}</span>
                <span className="truncate">{blockers[0].title}</span>
              </button>
              <button type="button" aria-label={`Remove ${blockers[0].key}`} onClick={() => onChange([])} className="p-0.5 rounded hover:bg-red-100 text-red-600 cursor-pointer flex-shrink-0"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <ul className="flex flex-wrap gap-1.5" data-testid="blocker-chips">
              {blockers.map(b => (
                <li key={b.id} className="flex items-center gap-1 max-w-full pl-1.5 pr-1 py-0.5 rounded bg-white border border-red-200 text-lira-text">
                  <button type="button" onClick={() => onOpenIssue?.(b)} title={`${b.key}: ${b.title}`} className="flex items-center gap-1 min-w-0 hover:text-lira-blue cursor-pointer">
                    <TypeIcon type={b.type} className="w-3 h-3 flex-shrink-0" />
                    <span className="font-mono font-semibold">{b.key}</span>
                  </button>
                  <button type="button" aria-label={`Remove ${b.key}`} onClick={() => onChange(ids.filter(x => x !== b.id))} className="p-0.5 rounded hover:bg-red-100 text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {blocking.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs" data-testid="blocking-list">
          <div className="text-3xs font-semibold uppercase tracking-wide text-amber-800 mb-1">This ticket is blocking</div>
          <ul className="space-y-1">
            {blocking.map(b => (
              <li key={b.id}>
                <button type="button" onClick={() => onOpenIssue?.(b)} className="flex items-center gap-1.5 max-w-full text-left text-lira-text hover:text-lira-blue cursor-pointer" title={`Open ${b.key}`}>
                  <TypeIcon type={b.type} className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-mono font-semibold flex-shrink-0">{b.key}</span>
                  <span className="truncate">{b.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BlockerPicker
        open={picking}
        issue={issue}
        alreadyIds={ids}
        onClose={() => setPicking(false)}
        onPick={picked => { onChange([...ids, ...picked.map(p => p.id!)]); setPicking(false); }}
      />
    </div>
  );
};

const TYPES: { id: IssueType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'epic', label: 'Epics' }, { id: 'task', label: 'Tasks' }, { id: 'bug', label: 'Bugs' }, { id: 'subtask', label: 'Subtasks' },
];

interface PickerProps { open: boolean; issue: Issue; alreadyIds: number[]; onClose: () => void; onPick: (issues: Issue[]) => void }

/** Choose the ticket, or tickets, that block this one. */
const BlockerPicker: React.FC<PickerProps> = ({ open, issue, alreadyIds, onClose, onPick }) => {
  const all = useAllIssues() ?? NO_ISSUES;
  const [query, setQuery] = useState('');
  const [type, setType] = useState<IssueType | 'all'>('all');
  const [chosen, setChosen] = useState<number[]>([]);
  const adding = alreadyIds.length > 0;

  useResetWhen([open], () => { if (open) { setQuery(''); setType('all'); setChosen([]); } });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter(i => i.id !== issue.id && i.status !== 'done' && !alreadyIds.includes(i.id!) && !(i.blocked && i.blockedByIds?.includes(issue.id!))) // not itself, not finished, not already linked, not one that waits on this ticket
      .filter(i => type === 'all' || i.type === type)
      .filter(i => !q || i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))
      .sort((a, b) => (a.spaceId === issue.spaceId ? 0 : 1) - (b.spaceId === issue.spaceId ? 0 : 1) || a.key.localeCompare(b.key, undefined, { numeric: true }))
      .slice(0, 100);
  }, [all, issue.id, issue.spaceId, alreadyIds, query, type]);

  const toggle = (id: number) => setChosen(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));
  const chosenIssues = chosen.map(id => all.find(i => i.id === id)).filter((i): i is Issue => !!i);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="blocker-picker"
          {...dialogBackdrop}
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            {...dialogPanel}
            role="dialog" aria-modal="true" aria-label="Blocked by" data-testid="blocker-picker"
            className="bg-white rounded-xl shadow-2xl border border-lira-border w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-lira-border">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0"><Ban className="w-5 h-5" /></span>
                <div>
                  <h2 className="text-base font-bold text-lira-text">{adding ? `What else is blocking ${issue.key}?` : `What is blocking ${issue.key}?`}</h2>
                  <p className="text-xs text-lira-muted mt-0.5">Choose one or more epics, tasks, bugs or subtasks this work is waiting on. Each is linked to this ticket.</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-5 pt-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-lira-muted" />
                <input
                  autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by key or title" aria-label="Search tickets"
                  className="w-full text-sm border border-lira-border rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue bg-white text-lira-text"
                />
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ticket type">
                {TYPES.map(t => (
                  <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full border cursor-pointer transition-colors ${type === t.id ? 'bg-lira-blue text-white border-lira-blue' : 'border-lira-border text-lira-muted hover:bg-gray-50'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="flex-1 min-h-[160px] overflow-y-auto px-3 py-3" aria-label="Tickets">
              {candidates.length === 0 && <li className="text-sm text-lira-muted text-center py-8">No open tickets match.</li>}
              {candidates.map(i => {
                const on = chosen.includes(i.id!);
                return (
                  <li key={i.id}>
                    <label
                      data-testid={`blocker-${i.key}`}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${on ? 'bg-lira-blue-light ring-1 ring-lira-blue' : 'hover:bg-gray-50'}`}
                    >
                      <input type="checkbox" className="sr-only peer" checked={on} onChange={() => toggle(i.id!)} />
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-lira-blue ${on ? 'bg-lira-blue border-lira-blue text-white' : 'border-gray-300 bg-white'}`}>
                        {on && <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.2 2.2L9.5 3.5" /></svg>}
                      </span>
                      <TypeIcon type={i.type} className="w-4 h-4 flex-shrink-0" />
                      <span className="font-mono text-xs font-semibold text-lira-muted w-20 flex-shrink-0">{i.key}</span>
                      <span className="flex-1 min-w-0 text-sm text-lira-text truncate">{i.title}</span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-lira-border bg-gray-50/60">
              <span className="text-xs text-lira-muted truncate">{chosenIssues.length === 0 ? 'Select one or more tickets' : `${chosenIssues.length} selected: ${chosenIssues.map(c => c.key).join(', ')}`}</span>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text rounded-lg cursor-pointer">Cancel</button>
                <button
                  disabled={chosenIssues.length === 0} data-testid="blocker-confirm" onClick={() => onPick(chosenIssues)}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? 'Add to blocked by' : 'Mark as blocked'}
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
