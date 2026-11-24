import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStoredList } from '../../hooks/useStoredList';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { currentTime } from '../../utils/clock';
import { isInvitedMember } from '../../utils/hostedOrg';
import { groupBoxes, newBox, scopeLabel, sprintsOf, type BoxScope, type StoryBox } from '../../utils/storybox';
import { MAX_MINUTES, MIN_MINUTES } from '../../utils/storyRound';
import { loadProfile } from '../../utils/userPrefs';
import { confirmDialog } from '../common/dialogStore';
import { BUTTON, FIELD } from '../teams/teamsUi';
import { StoryBoxBoard } from './StoryBoxBoard';

const KEY = 'lira_storyboxes';

/**
 * Story boxes: estimating story points together. The people who run a workspace (everyone, in the local edition) make a box for one
 * space or for one sprint across all spaces, and close it when the estimating is done; everyone who may see the box gives their own
 * points. Closed boxes stay as the history.
 */
export function StoryBoxesPage({ issues, spaces }: { issues: Issue[]; spaces: Space[] }) {
  const [boxes, saveBoxes] = useStoredList<StoryBox>(KEY);
  const { boxId } = useParams();
  const navigate = useNavigate();
  const canManage = !isInvitedMember();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [by, setBy] = useState<'space' | 'sprint'>('space');
  const [spaceId, setSpaceId] = useState('');
  const [sprintKey, setSprintKey] = useState('');
  const [minutes, setMinutes] = useState(''); // empty on purpose: the time is chosen every time a box is made
  const sprints = sprintsOf(issues);
  const { open, history } = groupBoxes(boxes);
  const box = boxes.find(b => b.id === boxId);

  const scope: BoxScope | null = by === 'space' ? (spaceId || spaces[0]?.id ? { type: 'space', spaceId: Number(spaceId || spaces[0]?.id) } : null) : (sprintKey || sprints[0]) ? { type: 'sprint', sprintKey: sprintKey || sprints[0] } : null;
  function create(e: FormEvent) {
    e.preventDefault();
    if (!scope || !minutes) return;
    const made = newBox(crypto.randomUUID(), name || scopeLabel(scope, spaces), scope, currentTime().toISOString(), loadProfile().name || 'Someone', Number(minutes));
    saveBoxes([...boxes, made]);
    setCreating(false); setName(''); setMinutes('');
    navigate(`/storyboxes/${made.id}`);
  }
  async function remove(b: StoryBox) {
    if (!(await confirmDialog({ title: `Delete "${b.name}"?`, message: 'The box and everyone\'s points in it are deleted. Points already put on tickets stay.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    saveBoxes(boxes.filter(x => x.id !== b.id));
    navigate('/storyboxes');
  }
  const item = (b: StoryBox) => (
    <li key={b.id}><button type="button" onClick={() => navigate(`/storyboxes/${b.id}`)} className={`w-full text-left rounded border px-2 py-1.5 ${b.id === boxId ? 'border-lira-blue bg-lira-blue-light' : 'border-lira-border'}`}>
      <span className="block truncate font-bold">{b.name}</span><span className="block text-lira-muted truncate">{scopeLabel(b.scope, spaces)}</span></button></li>
  );

  return (
    <div className="flex gap-4 p-4 h-full min-h-0 overflow-y-auto">
      <nav aria-label="Story boxes" className="w-64 shrink-0 space-y-3 text-ui">
        {canManage && <button type="button" onClick={() => setCreating(c => !c)} className={`${BUTTON} w-full`}>New story box</button>}
        {creating && (
          <form onSubmit={create} aria-label="New story box" className="border border-lira-border rounded-lg p-3 space-y-2">
            <label className="flex flex-col gap-1">Name<input value={name} onChange={e => setName(e.target.value)} placeholder="Sprint 12 planning" className={FIELD} /></label>
            <fieldset className="space-y-1"><legend>Estimate by</legend>
              <label className="flex items-center gap-1.5"><input type="radio" name="by" checked={by === 'space'} onChange={() => setBy('space')} />Space</label>
              <label className="flex items-center gap-1.5"><input type="radio" name="by" checked={by === 'sprint'} onChange={() => setBy('sprint')} />Sprint</label>
            </fieldset>
            {by === 'space'
              ? <label className="flex flex-col gap-1">Space<select value={spaceId} onChange={e => setSpaceId(e.target.value)} className={FIELD}>{spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              : <label className="flex flex-col gap-1">Sprint<select value={sprintKey} onChange={e => setSprintKey(e.target.value)} className={FIELD}>{sprints.map(s => <option key={s} value={s}>{s}</option>)}</select></label>}
            <label className="flex flex-col gap-1">Time to vote on each ticket
              <select required value={minutes} onChange={e => setMinutes(e.target.value)} className={FIELD}>
                <option value="">Choose</option>{Array.from({ length: MAX_MINUTES - MIN_MINUTES + 1 }, (_, i) => MIN_MINUTES + i).map(m => <option key={m} value={m}>{m} minute{m === 1 ? '' : 's'}</option>)}
              </select>
            </label>
            <div className="flex gap-2"><button type="submit" disabled={!scope || !minutes} className={BUTTON}>Make the box</button><button type="button" onClick={() => setCreating(false)} className="rounded px-3 py-1.5 border border-lira-border">Cancel</button></div>
          </form>
        )}
        <section aria-label="Open boxes"><h3 className="font-bold mb-1">Open</h3>{open.length ? <ul className="space-y-1">{open.map(item)}</ul> : <p className="text-lira-muted">None open.</p>}</section>
        <section aria-label="History"><h3 className="font-bold mb-1">History</h3>{history.length ? <ul className="space-y-1">{history.map(item)}</ul> : <p className="text-lira-muted">Closed boxes appear here.</p>}</section>
      </nav>
      {box
        ? <StoryBoxBoard box={box} issues={issues} spaces={spaces} canManage={canManage} onChange={next => saveBoxes(boxes.map(b => (b.id === next.id ? next : b)))} onDelete={() => { void remove(box); }} />
        : <p className="text-ui text-lira-muted">{boxes.length ? 'Choose a story box.' : canManage ? 'Make a story box to start estimating together.' : 'Nobody has made a story box you can see yet.'}</p>}
    </div>
  );
}
