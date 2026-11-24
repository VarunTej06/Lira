import { useState, type FormEvent } from 'react';
import type { Space } from '../../types/space';
import { currentTime } from '../../utils/clock';
import { MAX_MINUTES, MIN_MINUTES } from '../../utils/storyRound';
import { newBox, scopeLabel, type BoxScope, type StoryBox } from '../../utils/storybox';
import { loadProfile } from '../../utils/userPrefs';
import { Modal } from '../common/Modal';
import { FIELD, LABEL } from '../standup/parts';

interface Props { isOpen: boolean; onClose: () => void; onCreate: (box: StoryBox) => void; spaces: readonly Space[]; sprints: readonly string[] }

const MINUTES = Array.from({ length: MAX_MINUTES - MIN_MINUTES + 1 }, (_, i) => MIN_MINUTES + i);

/** The form for a new box: its name, whether it is about one space or one sprint, and how long each ticket is open for voting. The time is asked every time and has no default. */
export function NewStoryBoxModal({ isOpen, onClose, onCreate, spaces, sprints }: Props) {
  const [name, setName] = useState('');
  const [by, setBy] = useState<'space' | 'sprint'>('space');
  const [spaceId, setSpaceId] = useState('');
  const [sprintKey, setSprintKey] = useState('');
  const [minutes, setMinutes] = useState('');
  const space = spaceId || String(spaces[0]?.id ?? '');
  const sprint = sprintKey || sprints[0] || '';
  const scope: BoxScope | null = by === 'space' ? (space ? { type: 'space', spaceId: Number(space) } : null) : sprint ? { type: 'sprint', sprintKey: sprint } : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!scope || !minutes) return;
    onCreate(newBox(crypto.randomUUID(), name || scopeLabel(scope, spaces), scope, currentTime().toISOString(), loadProfile().name || 'Someone', Number(minutes)));
    setName(''); setMinutes('');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New story box" size="md">
      <form onSubmit={submit} aria-label="New story box" className="p-6 space-y-4 text-lira-text">
        <div><label className={LABEL} htmlFor="sb-name">Name</label><input id="sb-name" value={name} onChange={e => setName(e.target.value)} placeholder="Sprint 12 planning" className={FIELD} /></div>
        <fieldset>
          <legend className={LABEL}>Estimate by</legend>
          <div className="inline-flex rounded-xl border border-lira-border overflow-hidden text-xs">
            {(['space', 'sprint'] as const).map(v => (
              <label key={v} className={`px-3 py-1.5 cursor-pointer ${by === v ? 'bg-lira-blue text-lira-on-blue' : 'bg-white text-lira-muted hover:text-lira-text'}`}>
                <input type="radio" name="by" className="sr-only" checked={by === v} onChange={() => setBy(v)} />{v === 'space' ? 'Space' : 'Sprint'}
              </label>
            ))}
          </div>
        </fieldset>
        {by === 'space'
          ? <div><label className={LABEL} htmlFor="sb-space">Space</label><select id="sb-space" value={space} onChange={e => setSpaceId(e.target.value)} className={FIELD}>{spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          : <div><label className={LABEL} htmlFor="sb-sprint">Sprint</label><select id="sb-sprint" value={sprint} onChange={e => setSprintKey(e.target.value)} className={FIELD}>{sprints.map(s => <option key={s} value={s}>{s}</option>)}</select></div>}
        <div>
          <label className={LABEL} htmlFor="sb-minutes">Time to vote on each ticket</label>
          <select id="sb-minutes" required value={minutes} onChange={e => setMinutes(e.target.value)} className={FIELD}>
            <option value="">Choose</option>{MINUTES.map(m => <option key={m} value={m}>{m} minute{m === 1 ? '' : 's'}</option>)}
          </select>
          <p className="text-3xs text-lira-muted mt-1">Everyone has this long to give their points once a ticket is put up. You choose it each time.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-lira-border bg-white text-lira-text hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button type="submit" disabled={!scope || !minutes} className="px-4 py-2 text-sm font-semibold rounded-xl bg-lira-blue text-lira-on-blue hover:bg-lira-blue-hover disabled:opacity-50 cursor-pointer">Make the box</button>
        </div>
      </form>
    </Modal>
  );
}
