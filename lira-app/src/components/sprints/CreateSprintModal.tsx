import { DatePicker } from '../common/DatePicker';
import React, { useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Space } from '../../types/space';
import { SprintSpacesPicker } from './SprintSpacesPicker';
import {
  currentSprintKey, daysLeft, getPlannedSprints, MAX_SPRINT_DAYS, parseDay, shiftSprint, sprintDays, sprintEnd, sprintName, sprintPhase,
  sprintStart, toDay, type SprintKind,
} from '../../utils/sprintUtils';
import { currentTime } from '../../utils/clock';
import { useResetWhen } from '../../hooks/useResetWhen';
import { checkDraft, createSprintFromDraft, type DraftCheck } from './sprintDraft';

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
  { kind: 'days', label: 'Number of days', hint: `1–${MAX_SPRINT_DAYS} days` },
];

const LABEL = 'block text-xs font-semibold text-lira-muted mb-2 uppercase tracking-wide';
const FIELD_LABEL = 'block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide';
const INPUT = 'w-full text-sm border border-lira-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-lira-blue bg-white';
const CHOICE = 'rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer';
const choiceColour = (active: boolean) => (active ? 'border-lira-blue bg-lira-blue-light text-lira-blue' : 'border-lira-border bg-white text-lira-text hover:bg-gray-50');

/** Monthly, weekly or a number of days. */
function DurationPicker({ kind, onChange }: { kind: SprintKind; onChange: (kind: SprintKind) => void }) {
  return (
    <div>
      <label className={LABEL}>Sprint duration</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Sprint duration">
        {DURATIONS.map(d => (
          <button key={d.kind} type="button" role="radio" aria-checked={kind === d.kind} onClick={() => onChange(d.kind)} className={`${CHOICE} ${choiceColour(kind === d.kind)}`}>
            <div className="text-sm font-semibold">{d.label}</div>
            <div className="text-3xs text-lira-muted">{d.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The next twelve months, each marked Current, Already planned or Free. */
function MonthPicker({ months, planned, month, onChange }: { months: string[]; planned: Set<string>; month: string; onChange: (month: string) => void }) {
  const note = (m: string) => (sprintPhase(m) === 'active' ? 'Current' : planned.has(m) ? 'Already planned' : 'Free');
  return (
    <div>
      <label className={LABEL}>Sprint month</label>
      <div className="grid grid-cols-3 gap-2">
        {months.map(m => (
          <button key={m} type="button" onClick={() => onChange(m)} className={`${CHOICE} ${choiceColour(m === month)}`}>
            <div className="text-sm font-semibold">{sprintStart(m).toLocaleString('en-US', { month: 'short', year: 'numeric' })}</div>
            <div className="text-3xs text-lira-muted">{note(m)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function NameField({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return (
    <>
      <label htmlFor="sprint-name" className={FIELD_LABEL}>Name (optional)</label>
      <input id="sprint-name" value={value} onChange={e => onChange(e.target.value)} placeholder="Sprint 12" className={INPUT} />
    </>
  );
}

/** Start date, and either the number of days or the name; with a number of days the name gets its own row. */
function CustomFields({ kind, start, days, name, onStart, onDays, onName }: {
  kind: SprintKind; start: string; days: number; name: string; onStart: (s: string) => void; onDays: (n: number) => void; onName: (s: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor="sprint-start" className={FIELD_LABEL}>Start date</label>
        <DatePicker id="sprint-start" value={start} onChange={onStart} clearable={false} aria-label="Start date" />
      </div>
      {kind === 'days' ? (
        <>
          <div>
            <label htmlFor="sprint-days" className={FIELD_LABEL}>Number of days</label>
            <input id="sprint-days" type="number" min={1} max={MAX_SPRINT_DAYS} value={days} onChange={e => onDays(Number(e.target.value))} className={INPUT} />
          </div>
          <div className="col-span-2"><NameField value={name} onChange={onName} /></div>
        </>
      ) : (
        <div><NameField value={name} onChange={onName} /></div>
      )}
    </div>
  );
}

/** A line saying which dates the sprint will cover, or what is wrong with the choice. */
function SprintPreview({ check, month, start, name }: { check: DraftCheck; month: string; start: string; name: string }) {
  const { custom, customEnd, length, overlap } = check;
  return (
    <div className="rounded-xl bg-gray-50 border border-lira-border px-4 py-3 text-sm text-lira-text" aria-live="polite">
      {!custom && (
        <>
          <strong>{sprintName(month)}</strong>
          <span className="text-lira-muted">
            {' '}· {fmt(sprintStart(month))} – {fmt(sprintEnd(month))} · {sprintDays(month)} days
            {sprintPhase(month) === 'active' && ` · ${daysLeft(month)} left`}
          </span>
        </>
      )}
      {custom && customEnd && (
        <>
          <strong>{name.trim() || `Sprint ${fmt(parseDay(start))}–${fmt(customEnd)}`}</strong>
          <span className="text-lira-muted"> · {fmt(parseDay(start))} – {fmt(customEnd)} · {length} day{length === 1 ? '' : 's'}</span>
          {overlap && <div className="mt-1 text-red-600 text-xs">Overlaps the sprint starting {fmt(parseDay(overlap))}. Pick another start date or a shorter length.</div>}
        </>
      )}
      {custom && !customEnd && <span className="text-red-600 text-xs">Pick a valid start date.</span>}
    </div>
  );
}

/** Create a sprint: choose how long it runs (monthly, weekly, bi-weekly or a number of days), when it starts, and its goal. */
export const CreateSprintModal: React.FC<CreateSprintModalProps> = ({ isOpen, onClose, existingKeys, spaces = [], onCreated }) => {
  const currentKey = currentSprintKey();
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => shiftSprint(currentKey, i)), [currentKey]);
  const plannedKey = [...getPlannedSprints(), ...existingKeys].join('|');
  const planned = useMemo(() => new Set(plannedKey ? plannedKey.split('|') : []), [plannedKey]);

  const [kind, setKind] = useState<SprintKind>('monthly');
  const [month, setMonth] = useState<string>(months[0]);
  const [start, setStart] = useState(toDay(currentTime()));
  const [days, setDays] = useState(10);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [spaceIds, setSpaceIds] = useState<number[]>([]);

  useResetWhen([isOpen, months, planned], () => {
    if (isOpen) {
      setKind('monthly');
      setMonth(months.find(m => !planned.has(m)) ?? months[0]);
      setStart(toDay(currentTime()));
      setDays(10);
      setName('');
      setGoal('');
      setSpaceIds([]);
    }
  });

  const check = checkDraft({ kind, start, days });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!check.canSubmit) return;
    const key = createSprintFromDraft({ kind, month, start, days, name, goal, spaceIds }, spaces.length);
    if (!key) return;
    onCreated(key);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create sprint" size="md">
      <form onSubmit={submit} className="p-6 space-y-5">
        <DurationPicker kind={kind} onChange={setKind} />
        {check.custom
          ? <CustomFields kind={kind} start={start} days={days} name={name} onStart={setStart} onDays={setDays} onName={setName} />
          : <MonthPicker months={months} planned={planned} month={month} onChange={setMonth} />}
        <SprintPreview check={check} month={month} start={start} name={name} />

        {spaces.length > 0 && <SprintSpacesPicker spaces={spaces} value={spaceIds} onChange={setSpaceIds} />}

        <div>
          <label className={FIELD_LABEL}>Sprint goal (optional)</label>
          <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="What should be true by the end of this sprint?" className={INPUT} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!check.canSubmit}>{!check.custom && planned.has(month) ? 'Open sprint' : 'Create sprint'}</Button>
        </div>
      </form>
    </Modal>
  );
};
