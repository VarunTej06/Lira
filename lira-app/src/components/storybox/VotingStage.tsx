import { Vote } from 'lucide-react';
import { useState } from 'react';
import type { Issue } from '../../types/issue';
import { clockText, msLeft, type Phase, type Room, type Round } from '../../utils/storyRound';
import { statsOf, suggestedPoints, votesFor, type StoryBox } from '../../utils/storybox';
import { FIELD } from '../teams/teamsUi';
import { PeopleCards } from './PeopleCards';
import { VoteHand } from './VoteHand';

export interface StageActions {
  reveal: (ticketId: number) => void;
  revote: (ticketId: number) => void;
  finalise: (ticketId: number, points: number) => void;
  vote: (ticketId: number, points: number | null) => void;
}

interface Props extends StageActions {
  box: StoryBox;
  room: Room;
  issue: Issue | undefined;
  round: Round | undefined;
  phase: Phase;
  nowMs: number;
  minutes: number;
  canRun: boolean;
  /** The ticket that was just confirmed and is on its way to the Sized lane. */
  leaving: boolean;
}

/** The facilitator's closing step: the points everyone gave, their average, and the final points to confirm. */
function Outcome({ box, room, ticket, canRun, onConfirm, onRevote }: { box: StoryBox; room: Room; ticket: number; canRun: boolean; onConfirm: (p: number) => void; onRevote: () => void }) {
  const list = votesFor(room.votes, ticket);
  const stats = statsOf(list);
  const hint = suggestedPoints(list, box.scale);
  const [choice, setChoice] = useState<string>(hint === null ? '' : String(hint));
  return (
    <div className="space-y-2">
      <p>{stats.count === 0 ? 'Nobody voted.' : `Average ${stats.average}, middle ${stats.median}, from ${stats.min} to ${stats.max}.`}{hint !== null && ` Suggested: ${hint}.`}</p>
      {canRun ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">Final points
            <select aria-label="Final points" value={choice} onChange={e => setChoice(e.target.value)} className={FIELD}><option value="">Choose</option>{box.scale.map(p => <option key={p} value={p}>{p}</option>)}</select>
          </label>
          <button type="button" disabled={choice === ''} onClick={() => onConfirm(Number(choice))} className="rounded-xl px-3 py-1.5 text-sm font-semibold bg-lira-blue text-lira-on-blue hover:bg-lira-blue-hover disabled:opacity-50 cursor-pointer">Confirm</button>
          <button type="button" onClick={onRevote} className="rounded-xl px-3 py-1.5 text-sm border border-lira-border bg-white text-lira-text hover:bg-gray-50 cursor-pointer">Vote again</button>
        </div>
      ) : <p className="text-lira-muted">The facilitator is choosing the final points.</p>}
    </div>
  );
}

/** The ticket being voted on: the countdown, everyone's cards, your own hand, and what the facilitator can do next. */
export function VotingStage({ box, room, issue, round, phase, nowMs, minutes, canRun, leaving, reveal, revote, finalise, vote }: Props) {
  if (!round || !issue) return null;
  const left = msLeft(round.endsAt, nowMs, room.offsetMs);
  const points = new Map(votesFor(room.votes, round.ticketId).map(v => [v.userId, v.points]));
  const mine = votesFor(room.votes, round.ticketId).find(v => v.mine)?.points;
  const revealed = phase === 'revealed';
  return (
    <section aria-label="Voting stage" className={`border border-lira-blue ring-1 ring-lira-blue rounded-2xl overflow-hidden bg-white text-sm ${leaving ? 'animate-card-leave motion-reduce:animate-none' : 'animate-card-rise motion-reduce:animate-none'}`}>
      <header className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 border-b border-lira-border">
        <Vote className="w-3.5 h-3.5 text-lira-blue" /><h3 className="text-xs font-semibold text-lira-text uppercase tracking-wide">Voting stage</h3>
        {phase === 'voting' && <span role="timer" aria-label="Time left to vote" className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-mono font-bold bg-lira-blue-light text-lira-blue">{clockText(left)}</span>}
        {phase === 'timeup' && <span className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700">Time is up</span>}
        {revealed && <span className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold bg-green-100 text-green-700">Revealed</span>}
      </header>
      <div className="p-4 space-y-3">
      <h4 className="text-base font-semibold text-lira-text"><span className="font-mono text-lira-muted text-sm mr-1">{issue.key}</span>{issue.title}</h4>
      {phase === 'voting' && <progress aria-hidden="true" className="w-full h-1.5 accent-lira-blue" max={minutes * 60_000} value={left} />}
      <PeopleCards people={room.people} points={points} reveal={revealed} />
      {!revealed && (
        <>
          <VoteHand scale={box.scale} mine={mine} disabled={phase !== 'voting'} onPick={p => vote(round.ticketId, p)} />
          <p className="text-lira-muted">{phase === 'voting' ? (mine === undefined ? 'Pick a card. You can change it until the timer ends.' : `You voted ${mine}. You can change it until the timer ends.`) : 'Voting has ended. Waiting for the facilitator to reveal.'}</p>
          {canRun && <button type="button" onClick={() => reveal(round.ticketId)} className="rounded-xl px-3 py-1.5 text-sm font-semibold bg-lira-blue text-lira-on-blue hover:bg-lira-blue-hover cursor-pointer">Reveal points</button>}
        </>
      )}
      {revealed && <Outcome key={round.ticketId} box={box} room={room} ticket={round.ticketId} canRun={canRun} onConfirm={p => finalise(round.ticketId, p)} onRevote={() => revote(round.ticketId)} />}
      </div>
    </section>
  );
}
