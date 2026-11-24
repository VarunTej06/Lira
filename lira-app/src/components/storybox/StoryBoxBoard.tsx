import { useState, type DragEvent } from 'react';
import { db } from '../../db/db';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { currentTime } from '../../utils/clock';
import { lanes, minutesOf, phaseNow } from '../../utils/storyRound';
import { scopeLabel, votesFor, type StoryBox } from '../../utils/storybox';
import { FIELD } from '../teams/teamsUi';
import { Participants } from './Participants';
import { StoryLanes } from './StoryLanes';
import { useStoryRoom } from './useStoryRoom';
import { VotingStage } from './VotingStage';

interface Props { box: StoryBox; issues: Issue[]; spaces: Space[]; canManage: boolean; onChange: (box: StoryBox) => void; onDelete: () => void }

const LEAVE_MS = 450;

/**
 * One story box as a planning room: the tickets still to be sized and those sized, and below them a voting stage. The people who run the
 * box drag a ticket onto the stage (or press its button) to ask everyone for points; everyone gives theirs within the time, the facilitator
 * reveals them, picks the final points and confirms, and the ticket moves to the sized lane.
 */
export function StoryBoxBoard({ box, issues, spaces, canManage, onChange, onDelete }: Props) {
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
  const sizedPoints = all.sized.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

  return (
    <section aria-label={box.name} className="flex-1 min-w-0 space-y-3 text-ui">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <h2 className="text-lg font-bold">{box.name} <span className={`ml-2 text-xs rounded px-2 py-0.5 border ${open ? 'border-lira-blue text-lira-text' : 'border-lira-border text-lira-muted'}`}>{open ? 'Open' : 'Closed'}</span></h2>
          <p className="text-lira-muted">{scopeLabel(box.scope, spaces)}. Made by {box.createdBy}. {minutes} minute{minutes === 1 ? '' : 's'} to vote on each ticket. {all.sized.length} sized, {sizedPoints} points.</p>
        </div>
        <input type="search" aria-label="Search tickets" placeholder="Search tickets" value={text} onChange={e => setText(e.target.value)} className={`${FIELD} w-48`} />
        {canManage && (
          <div className="flex gap-2">
            <button type="button" onClick={close} className="rounded px-3 py-1.5 border border-lira-border">{open ? 'Close the box' : 'Reopen'}</button>
            <button type="button" onClick={onDelete} className="rounded px-3 py-1.5 border border-lira-border">Delete</button>
          </div>
        )}
      </header>
      {!open && <p role="status" className="text-lira-muted">This box is closed: points can no longer be given. It stays here as history.</p>}
      {room.problem && <p role="alert" className="text-red-600">{room.problem}</p>}
      <StoryLanes pending={all.pending.filter(match)} sized={all.sized.filter(match)} spaceKey={spaceKey} canRun={canRun} idle={!round} landedId={landed} onStart={start} />
      {open && (round && phase ? (
        <VotingStage box={box} room={room.room} issue={activeIssue} round={round} phase={phase} nowMs={room.nowMs} minutes={minutes} canRun={canRun} leaving={leaving}
          reveal={t => { void room.reveal(t); }} revote={t => { void room.revote(t); }} finalise={(t, p) => { void finalise(t, p); }} vote={(t, p) => { void room.vote(t, p); }} />
      ) : (
        <section aria-label="Voting stage" onDragOver={e => { if (canRun) e.preventDefault(); }} onDrop={drop} className="rounded-lg border-2 border-dashed border-lira-border p-8 text-center text-lira-muted">
          {canRun ? `Drag a ticket here, or press Start voting on a ticket, to ask everyone for points. Each ticket is open for ${minutes} minute${minutes === 1 ? '' : 's'}.` : 'Waiting for the facilitator to put a ticket up for voting.'}
        </section>
      ))}
      {open && round && phase && <Participants people={room.room.people} points={points} revealed={phase === 'revealed'} />}
    </section>
  );
}
