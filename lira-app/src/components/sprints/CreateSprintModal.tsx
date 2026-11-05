import React, { useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  addPlannedSprint, currentSprintKey, daysLeft, getPlannedSprints, setSprintMeta, shiftSprint,
  sprintDays, sprintEnd, sprintName, sprintPhase, sprintStart,
} from '../../utils/sprintUtils';

interface CreateSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Sprint months that already hold tickets, so the picker can mark them. */
  existingKeys: string[];
  onCreated: (sprint: string) => void;
}

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Sprints are calendar months — "creating" one plans a month ahead and (optionally) sets its goal. */
export const CreateSprintModal: React.FC<CreateSprintModalProps> = ({ isOpen, onClose, existingKeys, onCreated }) => {
  const months = useMemo(() => {
    const cur = currentSprintKey();
    return Array.from({ length: 12 }, (_, i) => shiftSprint(cur, i));
  }, [isOpen]);
  const planned = useMemo(() => new Set([...getPlannedSprints(), ...existingKeys]), [isOpen, existingKeys]);

  const firstFree = months.find(m => !planned.has(m)) ?? months[0];
  const [month, setMonth] = useState<string>(firstFree);
  const [goal, setGoal] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setMonth(months.find(m => !planned.has(m)) ?? months[0]);
      setGoal('');
    }
  }, [isOpen, months, planned]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addPlannedSprint(month);
    if (goal.trim()) setSprintMeta('all', month, { goal: goal.trim() });
    onCreated(month);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create sprint" size="md">
      <form onSubmit={submit} className="p-6 space-y-5">
        <p className="text-sm text-jira-muted">
          Every sprint is one calendar month. Pick the month you want to plan; you can then move tickets into it from any other sprint.
        </p>

        <div>
          <label className="block text-xs font-semibold text-jira-muted mb-2 uppercase tracking-wide">Sprint month</label>
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
                    active
                      ? 'border-jira-blue bg-jira-blue-light text-jira-blue'
                      : 'border-jira-border bg-white text-jira-text hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-semibold">{sprintStartLabel(m)}</div>
                  <div className="text-[10px] text-jira-muted">
                    {sprintPhase(m) === 'active' ? 'Current' : exists ? 'Already planned' : 'Free'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 border border-jira-border px-4 py-3 text-sm text-jira-text">
          <strong>{sprintName(month)}</strong>
          <span className="text-jira-muted">
            {' '}· {fmt(sprintStart(month))} – {fmt(sprintEnd(month))} · {sprintDays(month)} days
            {sprintPhase(month) === 'active' && ` · ${daysLeft(month)} left`}
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">Sprint goal (optional)</label>
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="What should be true by the end of this month?"
            className="w-full text-sm border border-jira-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-jira-blue bg-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{planned.has(month) ? 'Open sprint' : 'Create sprint'}</Button>
        </div>
      </form>
    </Modal>
  );
};

function sprintStartLabel(key: string): string {
  return sprintStart(key).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}
