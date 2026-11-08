import { DatePicker } from '../common/DatePicker';
import React, { useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Space } from '../../types/space';
import { SprintSpacesPicker } from './SprintSpacesPicker';
import {
  addCustomSprint, addPlannedSprint, currentSprintKey, daysLeft, findOverlap, getPlannedSprints, kindLength, MAX_SPRINT_DAYS,
  parseDay, setSprintMeta, setSprintSpaces, shiftSprint, sprintDays, sprintEnd, sprintName, sprintPhase, sprintStart, toDay, type SprintKind,
} from '../../utils/sprintUtils';

interface CreateSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Sprint keys that already hold tickets, so the picker can mark them. */
  existingKeys: string[];
  /** Every space; the sprint can be limited to some of them. */
  spaces?: Space[];
  onCreated: (sprint: string) => void;
}

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const DURATIONS: { kind: SprintKind; label: string; hint: string }[] = [
  { kind: 'monthly', label: 'Monthly', hint: 'A calendar month' },
  { kind: 'weekly', label: 'Weekly', hint: '7 days' },
  { kind: 'biweekly', label: 'Bi-weekly', hint: '14 days' },
  { kind: 'days', label: 'Number of days', hint: `1–${MAX_SPRINT_DAYS} days` },
];

/** Create a sprint: choose how long it runs (monthly, weekly, bi-weekly or a number of days), when it starts, and its goal. */
export const CreateSprintModal: React.FC<CreateSprintModalProps> = ({ isOpen, onClose, existingKeys, spaces = [], onCreated }) => {
  const months = useMemo(() => {
    const cur = currentSprintKey();
    return Array.from({ length: 12 }, (_, i) => shiftSprint(cur, i));
  }, [isOpen]);
  const planned = useMemo(() => new Set([...getPlannedSprints(), ...existingKeys]), [isOpen, existingKeys]);

  const [kind, setKind] = useState<SprintKind>('monthly');
  const [month, setMonth] = useState<string>(months[0]);
  const [start, setStart] = useState(toDay(new Date()));
  const [days, setDays] = useState(10);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [spaceIds, setSpaceIds] = useState<number[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      setKind('monthly');
      setMonth(months.find(m => !planned.has(m)) ?? months[0]);
      setStart(toDay(new Date()));
      setDays(10);
      setName('');
      setGoal('');
      setSpaceIds([]);
    }
  }, [isOpen, months, planned]);

  const custom = kind !== 'monthly';
  const length = custom ? kindLength(kind, days) : 0;
  const startValid = /^\d{4}-\d{2}-\d{2}$/.test(start) && !Number.isNaN(parseDay(start).getTime());
  const overlap = custom && startValid ? findOverlap(start, length) : undefined;
  const customEnd = custom && startValid ? new Date(parseDay(start).getFullYear(), parseDay(start).getMonth(), parseDay(start).getDate() + length - 1) : null;
  const canSubmit = !custom || (startValid && !overlap && (kind !== 'days' || (days >= 1 && days <= MAX_SPRINT_DAYS)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    let key: string | null;
    if (custom) {
      key = addCustomSprint({ start, kind: kind as Exclude<SprintKind, 'monthly'>, days, name });
    } else {
      addPlannedSprint(month);
      key = month;
    }
    if (!key) return;
    if (goal.trim()) setSprintMeta('all', key, { goal: goal.trim() });
    if (spaceIds.length && spaceIds.length < spaces.length) setSprintSpaces(key, spaceIds);
    onCreated(key);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create sprint" size="md">
      <form onSubmit={submit} className="p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-lira-muted mb-2 uppercase tracking-wide">Sprint duration</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Sprint duration">
            {DURATIONS.map(d => (
              <button
                key={d.kind}
                type="button"
                role="radio"
                aria-checked={kind === d.kind}
                onClick={() => setKind(d.kind)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                  kind === d.kind ? 'border-lira-blue bg-lira-blue-light text-lira-blue' : 'border-lira-border bg-white text-lira-text hover:bg-gray-50'
                }`}
              >
                <div className="text-sm font-semibold">{d.label}</div>
                <div className="text-[10px] text-lira-muted">{d.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {!custom ? (
          <div>
            <label className="block text-xs font-semibold text-lira-muted mb-2 uppercase tracking-wide">Sprint month</label>
            <div className="grid grid-cols-3 gap-2">
              {months.map(m => {
                const exists = planned.has(m);
                const active = m === month;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonth(m)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                      active ? 'border-lira-blue bg-lira-blue-light text-lira-blue' : 'border-lira-border bg-white text-lira-text hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-sm font-semibold">{sprintStart(m).toLocaleString('en-US', { month: 'short', year: 'numeric' })}</div>
                    <div className="text-[10px] text-lira-muted">{sprintPhase(m) === 'active' ? 'Current' : exists ? 'Already planned' : 'Free'}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sprint-start" className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">Start date</label>
              <DatePicker id="sprint-start" value={start} onChange={setStart} clearable={false} aria-label="Start date" />
            </div>
            {kind === 'days' ? (
              <div>
                <label htmlFor="sprint-days" className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">Number of days</label>
                <input
                  id="sprint-days"
                  type="number"
                  min={1}
                  max={MAX_SPRINT_DAYS}
                  value={days}
                  onChange={e => setDays(Number(e.target.value))}
                  className="w-full text-sm border border-lira-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-lira-blue bg-white"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="sprint-name" className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">Name (optional)</label>
                <input
                  id="sprint-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Sprint 12"
                  className="w-full text-sm border border-lira-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-lira-blue bg-white"
                />
              </div>
            )}
            {kind === 'days' && (
              <div className="col-span-2">
                <label htmlFor="sprint-name" className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">Name (optional)</label>
                <input
                  id="sprint-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Sprint 12"
                  className="w-full text-sm border border-lira-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-lira-blue bg-white"
                />
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl bg-gray-50 border border-lira-border px-4 py-3 text-sm text-lira-text" aria-live="polite">
          {!custom ? (
            <>
              <strong>{sprintName(month)}</strong>
              <span className="text-lira-muted">
                {' '}· {fmt(sprintStart(month))} – {fmt(sprintEnd(month))} · {sprintDays(month)} days
                {sprintPhase(month) === 'active' && ` · ${daysLeft(month)} left`}
              </span>
            </>
          ) : customEnd ? (
            <>
              <strong>{name.trim() || `Sprint ${fmt(parseDay(start))}–${fmt(customEnd)}`}</strong>
              <span className="text-lira-muted"> · {fmt(parseDay(start))} – {fmt(customEnd)} · {length} day{length === 1 ? '' : 's'}</span>
              {overlap && <div className="mt-1 text-red-600 text-xs">Overlaps the sprint starting {fmt(parseDay(overlap))}. Pick another start date or a shorter length.</div>}
            </>
          ) : (
            <span className="text-red-600 text-xs">Pick a valid start date.</span>
          )}
        </div>

        {spaces.length > 0 && <SprintSpacesPicker spaces={spaces} value={spaceIds} onChange={setSpaceIds} />}

        <div>
          <label className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">Sprint goal (optional)</label>
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="What should be true by the end of this sprint?"
            className="w-full text-sm border border-lira-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-lira-blue bg-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!canSubmit}>{!custom && planned.has(month) ? 'Open sprint' : 'Create sprint'}</Button>
        </div>
      </form>
    </Modal>
  );
};
