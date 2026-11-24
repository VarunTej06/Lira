import type { Issue } from '../../types/issue';

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

function TicketCard({ issue, sized, spaceKey, canStart, landed, onStart }: { issue: Issue; sized: boolean; spaceKey: string; canStart: boolean; landed: boolean; onStart: (id: number) => void }) {
  return (
    <li draggable={canStart} onDragStart={e => { e.dataTransfer.setData('text/plain', String(issue.id)); e.dataTransfer.effectAllowed = 'move'; }}
      className={`w-52 shrink-0 rounded-lg border border-lira-border bg-lira-surface p-2 ${canStart ? 'cursor-grab active:cursor-grabbing' : ''} ${landed ? 'animate-card-land motion-reduce:animate-none' : ''}`}>
      <div className="flex items-center justify-between gap-2"><strong>{issue.key}</strong><span className="text-3xs text-lira-muted">{spaceKey}</span></div>
      <p className="truncate" title={issue.title}>{issue.title}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        {sized ? <span className="rounded px-1.5 py-0.5 bg-lira-blue-light font-bold">{issue.storyPoints} points</span> : <span className="text-lira-muted">No points</span>}
        {canStart && <button type="button" aria-label={`Start voting on ${issue.key}`} onClick={() => onStart(issue.id!)} className="rounded border border-lira-border px-2 py-0.5">Start voting</button>}
      </div>
    </li>
  );
}

function Lane({ title, hint, tickets, sized, ...rest }: { title: string; hint: string; tickets: readonly Issue[]; sized: boolean } & Omit<Props, 'pending' | 'sized' | 'idle'> & { canStart: boolean }) {
  const total = tickets.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
  return (
    <section aria-label={title} className="flex-1 min-w-0 rounded-lg border border-lira-border bg-lira-bg p-3">
      <h3 className="font-bold">{title} <span className="font-normal text-lira-muted">{tickets.length}{sized ? `, ${total} points` : ''}</span></h3>
      {tickets.length === 0 ? <p className="text-lira-muted py-3">{hint}</p> : (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {tickets.map(i => <TicketCard key={i.id} issue={i} sized={sized} spaceKey={rest.spaceKey(i.spaceId)} canStart={rest.canStart} landed={rest.landedId === i.id} onStart={rest.onStart} />)}
        </ul>
      )}
    </section>
  );
}

/** The two lanes: tickets still to be sized, and tickets that are sized. */
export function StoryLanes({ pending, sized, idle, ...rest }: Props) {
  const canStart = rest.canRun && idle;
  return (
    <div className="flex flex-col md:flex-row gap-3 text-ui">
      <Lane title="Yet to be sized" hint="Everything here has points." tickets={pending} sized={false} canStart={canStart} {...rest} />
      <Lane title="Sized" hint="Tickets appear here once their points are confirmed." tickets={sized} sized canStart={canStart} {...rest} />
    </div>
  );
}
