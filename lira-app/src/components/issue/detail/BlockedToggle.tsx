import React, { useMemo, useState } from 'react';
import { Ban, Flame, Plus, X } from 'lucide-react';
import type { Issue } from '../../../types/issue';
import { useAllIssues } from '../../../hooks/useIssues';
import { TypeIcon } from '../../common/Icons';
import { motion } from '../../common/motionPresets';
import { TicketPicker } from '../../common/TicketPicker';
import { BLOCKED_META } from '../../../utils/status';
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
          selected ? 'text-[var(--blocked-track)] cursor-default' : `${blocked ? 'text-white' : 'text-lira-on-blue'} cursor-pointer`
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
        style={{ ['--blocked-track' as string]: blocked ? BLOCKED_META.color : 'rgb(var(--lira-blue-text))',backgroundColor: blocked ? BLOCKED_META.color : 'rgb(var(--lira-blue))' }}
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

interface PickerProps { open: boolean; issue: Issue; alreadyIds: number[]; onClose: () => void; onPick: (issues: Issue[]) => void }

/** Choose the ticket, or tickets, that block this one. */
const BlockerPicker: React.FC<PickerProps> = ({ open, issue, alreadyIds, onClose, onPick }) => {
  const all = useAllIssues() ?? NO_ISSUES;
  const adding = alreadyIds.length > 0;
  // not itself, not finished, not already linked, not one that waits on this ticket
  const candidates = useMemo(
    () => all.filter(i => i.id !== issue.id && i.status !== 'done' && !alreadyIds.includes(i.id!) && !(i.blocked && i.blockedByIds?.includes(issue.id!))),
    [all, issue.id, alreadyIds],
  );
  return (
    <TicketPicker
      open={open} onClose={onClose} testId="blocker" tone="danger" typeFilter
      icon={<Ban className="w-5 h-5" />}
      title={adding ? `What else is blocking ${issue.key}?` : `What is blocking ${issue.key}?`}
      hint="Choose one or more epics, tasks, bugs or subtasks this work is waiting on. Each is linked to this ticket."
      candidates={candidates} homeSpaceId={issue.spaceId}
      emptyText="No open tickets match."
      confirmLabel={adding ? 'Add to blocked by' : 'Mark as blocked'}
      onPick={picked => onPick(picked.map(p => p.issue))}
    />
  );
};
