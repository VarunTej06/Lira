import { ArrowLeft, Layers, Search, Target, Timer, Trash2 } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { db } from '../../db/db';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { currentTime } from '../../utils/clock';
import { lanes, minutesOf, phaseNow } from '../../utils/storyRound';
import { scopeLabel, votesFor, type StoryBox } from '../../utils/storybox';
import { FIELD } from '../standup/parts';
import { Participants } from './Participants';
import { StoryLanes } from './StoryLanes';
import { useStoryRoom } from './useStoryRoom';
import { VotingStage } from './VotingStage';

interface Props { box: StoryBox; issues: Issue[]; spaces: Space[]; canManage: boolean; onChange: (box: StoryBox) => void; onDelete: () => void; onBack: () => void }

const LEAVE_MS = 450;
const BUTTON = 'text-sm px-3 py-1.5 rounded-xl border border-lira-border bg-white text-lira-text hover:bg-gray-50 cursor-pointer';

/**
 * One story box as a planning room: the tickets still to be sized and those sized, and below them a voting stage. The people who run the
 * box drag a ticket onto the stage (or press its button) to ask everyone for points; everyone gives theirs within the time, the facilitator
 * reveals them, picks the final points and confirms, and the ticket moves to the sized lane.
 */
export function StoryBoxBoard({ box, issues, spaces, canManage, onChange, onDelete, onBack }: Props) {
  const room = useStoryRoom(box, onChange);
  const [text, setText] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [landed, setLanded] = useState<number | null>(null);
  const open = box.status === 'open';
  const canRun = canManage && open;
  const minutes = minutesOf(box);
  const round = room.room.rounds.find(r => r.ticketId === room.room.activeTicketId);
  const phase = round ? phaseNow(round, room.nowMs, room.room.offsetMs) : undefined;
  const all = lanes(issues, box, room.room.activeTicketId);
  const match = (i: Issue) => `${i.key} ${i.title}`.toLowerCase().includes(text.toLowerCase());
  const activeIssue = issues.find(i => i.id === room.room.activeTicketId);
  const spaceKey = (id: number) => spaces.find(s => s.id === id)?.key ?? '';
  const points = new Map(votesFor(room.room.votes, room.room.activeTicketId ?? -1).map(v => [v.userId, v.points]));
  const sizedPoints = all.sized.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

  const start = (ticketId: number) => { setLanded(null); void room.start(ticketId); };
  const drop = (e: DragEvent) => { e.preventDefault(); const id = Number(e.dataTransfer.getData('text/plain')); if (canRun && !round && Number.isInteger(id) && id > 0) start(id); };
  /** The ticket leaves the stage first, then the points are confirmed and put on it, so the move is seen before the lane changes. */
  async function finalise(ticketId: number, p: number) {
    setLeaving(true);
    await new Promise(r => window.setTimeout(r, LEAVE_MS));
    const done = await room.finalise(ticketId, p);
    setLeaving(false);
    if (!done) return;
    await db.issues.update(ticketId, { storyPoints: p, updatedAt: currentTime() });
    setLanded(ticketId);
  }
  const close = () => onChange(open ? { ...box, status: 'closed', closedAt: currentTime().toISOString() } : { ...box, status: 'open', closedAt: undefined });
  const tiles = [
    { label: 'Tickets sized', value: `${all.sized.length + (round?.phase === 'confirmed' ? 1 : 0)} of ${all.pending.length + all.sized.length + (round ? 1 : 0)}`, icon: <Target className="w-4 h-4" />, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Points boxed', value: String(sizedPoints), icon: <Layers className="w-4 h-4" />, tone: 'text-lira-blue bg-lira-blue-light' },
    { label: 'Time to vote', value: `${minutes} min`, icon: <Timer className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg">
      <section aria-label={box.name} className="max-w-6xl mx-auto p-6 space-y-4">
        <nav aria-label="Where you are" className="flex items-center gap-2 text-sm text-lira-muted">
          <button type="button" onClick={onBack} className="flex items-center gap-1.5 hover:text-lira-text cursor-pointer"><ArrowLeft className="w-4 h-4" /> All story boxes</button>
          <span>/</span><span className="text-lira-text">{box.name}</span>
        </nav>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-lira-text flex items-center gap-2">
              <Layers className="w-5 h-5 text-lira-blue" /> {box.name}
              <span className={`text-3xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{open ? 'Open' : 'Closed'}</span>
            </h1>
            <p className="text-xs text-lira-muted mt-0.5">{scopeLabel(box.scope, spaces)}. Made by {box.createdBy}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative"><Search className="w-3.5 h-3.5 text-lira-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input type="search" aria-label="Search tickets" placeholder="Search tickets" value={text} onChange={e => setText(e.target.value)} className={`${FIELD} !w-48 pl-8`} /></label>
            {canManage && <button type="button" onClick={close} className={BUTTON}>{open ? 'Close the box' : 'Reopen'}</button>}
            {canManage && <button type="button" onClick={onDelete} className={`${BUTTON} !text-red-600 flex items-center gap-1.5`}><Trash2 className="w-3.5 h-3.5" />Delete</button>}
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tiles.map(t => (
            <div key={t.label} className="bg-white border border-lira-border rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${t.tone}`}>{t.icon}</span>
              <div><div className="text-2xl font-semibold text-lira-text leading-none">{t.value}</div><div className="text-2xs text-lira-muted mt-1">{t.label}</div></div>
            </div>
          ))}
        </div>

        {!open && <p role="status" className="text-xs text-lira-muted bg-white border border-lira-border rounded-2xl px-4 py-3">This box is closed: points can no longer be given. It stays here as history.</p>}
        {room.problem && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">{room.problem}</p>}
        <StoryLanes pending={all.pending.filter(match)} sized={all.sized.filter(match)} spaceKey={spaceKey} canRun={canRun} idle={!round} landedId={landed} onStart={start} />
        {open && (round && phase ? (
          <VotingStage box={box} room={room.room} issue={activeIssue} round={round} phase={phase} nowMs={room.nowMs} minutes={minutes} canRun={canRun} leaving={leaving}
            reveal={t => { void room.reveal(t); }} revote={t => { void room.revote(t); }} finalise={(t, p) => { void finalise(t, p); }} vote={(t, p) => { void room.vote(t, p); }} />
        ) : (
          <section aria-label="Voting stage" onDragOver={e => { if (canRun) e.preventDefault(); }} onDrop={drop} className="rounded-2xl border-2 border-dashed border-lira-border bg-white/60 px-6 py-10 text-center text-xs text-lira-muted">
            {canRun ? `Drag a ticket here, or press Start voting on a ticket, to ask everyone for points. Each ticket is open for ${minutes} minute${minutes === 1 ? '' : 's'}.` : 'Waiting for the facilitator to put a ticket up for voting.'}
          </section>
        ))}
        {open && round && phase && <Participants people={room.room.people} points={points} revealed={phase === 'revealed'} />}
      </section>
    </div>
  );
}
