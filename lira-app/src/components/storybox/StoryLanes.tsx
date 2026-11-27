import { Inbox, PackageCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Issue } from '../../types/issue';
import { TypeIcon } from '../common/Icons';

interface Props {
  pending: readonly Issue[];
  sized: readonly Issue[];
  spaceKey: (spaceId: number) => string;
  /** Who runs the box may put a ticket up for voting, by dragging it to the stage or with its button. */
  canRun: boolean;
  /** False while another ticket is being voted on. */
  idle: boolean;
  landedId: number | null;
  onStart: (ticketId: number) => void;
}

/** One ticket as a line, like in the stand-up: its type, key, title and space, then its points or a button to put it up for voting. Draggable to the stage. */
function TicketLine({ issue, sized, spaceKey, canStart, landed, onStart }: { issue: Issue; sized: boolean; spaceKey: string; canStart: boolean; landed: boolean; onStart: (id: number) => void }) {
  return (
    <li draggable={canStart} onDragStart={e => { e.dataTransfer.setData('text/plain', String(issue.id)); e.dataTransfer.effectAllowed = 'move'; }}
      className={`flex items-center gap-2.5 px-3 py-2 border-b border-lira-border last:border-0 hover:bg-gray-50 transition-colors ${canStart ? 'cursor-grab active:cursor-grabbing' : ''} ${landed ? 'animate-card-land motion-reduce:animate-none bg-lira-blue-light' : ''}`}>
      <TypeIcon type={issue.type} className="w-4 h-4 flex-shrink-0" />
      <span className="font-mono text-2xs text-lira-muted w-20 flex-shrink-0">{issue.key}</span>
      <span className="flex-1 min-w-0 text-sm text-lira-text truncate" title={issue.title}>{issue.title}</span>
      <span className="text-3xs text-lira-muted flex-shrink-0">{spaceKey}</span>
      {sized && <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap flex-shrink-0">{issue.storyPoints} points</span>}
      {canStart && <button type="button" aria-label={`Start voting on ${issue.key}`} onClick={() => onStart(issue.id!)} className="text-3xs font-medium px-2.5 py-1 rounded-lg border border-lira-border bg-white text-lira-text hover:bg-gray-50 cursor-pointer flex-shrink-0">Start voting</button>}
    </li>
  );
}

/** A titled box of tickets that scrolls up and down when there are many. */
function Lane({ title, icon, tickets, empty, children }: { title: string; icon: ReactNode; tickets: readonly Issue[]; empty: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="border border-lira-border rounded-2xl overflow-hidden bg-white flex flex-col">
      <header className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-lira-border">
        {icon}<h3 className="text-xs font-semibold text-lira-text uppercase tracking-wide">{title}</h3>
        <span className="text-2xs text-lira-muted">{tickets.length}</span>
        {title === 'Sized' && <span className="ml-auto text-2xs font-semibold text-lira-text">{tickets.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0)} points</span>}
      </header>
      {tickets.length === 0 ? <p className="px-3 py-6 text-xs text-lira-muted text-center">{empty}</p> : <ul className="max-h-72 overflow-y-auto">{children}</ul>}
    </section>
  );
}

/** The two boxes of tickets: yet to be sized and sized. */
export function StoryLanes({ pending, sized, spaceKey, canRun, idle, landedId, onStart }: Props) {
  const canStart = canRun && idle;
  const line = (i: Issue, isSized: boolean) => <TicketLine key={i.id} issue={i} sized={isSized} spaceKey={spaceKey(i.spaceId)} canStart={canStart} landed={landedId === i.id} onStart={onStart} />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Lane title="Yet to be sized" icon={<Inbox className="w-3.5 h-3.5 text-amber-500" />} tickets={pending} empty="Every ticket here has points.">{pending.map(i => line(i, false))}</Lane>
      <Lane title="Sized" icon={<PackageCheck className="w-3.5 h-3.5 text-emerald-500" />} tickets={sized} empty="Tickets appear here once their points are confirmed.">{sized.map(i => line(i, true))}</Lane>
    </div>
  );
}
