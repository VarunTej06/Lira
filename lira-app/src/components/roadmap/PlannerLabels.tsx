import { issueLink } from '../../utils/links';
import { ChevronDown, ChevronRight, Plus, Zap } from 'lucide-react';
import type { Issue } from '../../types/issue';
import { STATUS_META, laneColor, resolveItem, type Roadmap, type buildPlannerRows } from '../../utils/roadmapUtils';
import { PALETTE } from '../../theme/palette';

type Rows = ReturnType<typeof buildPlannerRows>['rows'];
type Row = Rows[number];
type LaneRowData = Extract<Row, { kind: 'lane' }>;
type EpicRowData = Extract<Row, { kind: 'epic' }>;
type TicketRowData = Exclude<Row, LaneRowData | EpicRowData>;
type Adding = { id: string; text: string } | null;

const TICKET_COLORS: Record<string, string> = { done: PALETTE.successSoft, inprogress: PALETTE.link };
const ticketColor = (status: string) => TICKET_COLORS[status?.toLowerCase()] ?? PALETTE.textMuted;

interface Props {
  roadmap: Roadmap;
  rows: Rows;
  issues: Issue[];
  today: Date;
  width: number;
  collapsedLanes: string[];
  adding: Adding;
  setAdding: (a: Adding) => void;
  submitAdd: () => void;
  onToggleLane: (lane: string) => void;
  toggleEpic: (id: string) => void;
  onOpenItem: (id: string) => void;
  onOpenIssue: (issue: Issue) => void;
}

function LaneRow({ row: r, roadmap, collapsed, onToggle }: { row: LaneRowData; roadmap: Roadmap; collapsed: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 text-left bg-lira-bg/70 border-b border-lira-border/70 cursor-pointer hover:bg-lira-bg" style={{ height: r.h }}>
      <ChevronDown className={`w-3.5 h-3.5 text-lira-muted transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: laneColor(roadmap, r.lane) }} />
      <span className="text-xs font-semibold text-lira-text truncate">{r.lane}</span>
      <span className="ml-auto text-3xs text-lira-muted bg-lira-surface border border-lira-border rounded-full px-1.5">{r.count}</span>
    </button>
  );
}

/** The box that takes the title of a new task for an epic: Enter adds, Escape or leaving the box cancels. */
function AddTaskInput({ epicKey, text, onText, onSubmit, onCancel }: { epicKey?: string; text: string; onText: (text: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return (
    <input
      autoFocus
      value={text}
      onChange={e => onText(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel(); }}
      onBlur={onCancel}
      placeholder={`New task in ${epicKey}…  Enter to add`}
      className="flex-1 min-w-0 border border-lira-blue rounded px-2 py-1 text-xs bg-lira-surface text-lira-text focus:outline-none"
    />
  );
}

/** An epic's status, its ticket count and the + that starts a new task (the + shows when hovering the row). */
function EpicBadges({ row: r, status, onAdd }: { row: EpicRowData; status: keyof typeof STATUS_META; onAdd: () => void }) {
  return (
    <>
      <span className="text-3xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: STATUS_META[status].color + '22', color: STATUS_META[status].color }}>{STATUS_META[status].label}</span>
      {r.tickets.length > 0 && <span className="text-3xs text-lira-muted flex-shrink-0">{r.tickets.length}</span>}
      {r.epic && <button onClick={onAdd} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-lira-muted hover:text-lira-blue hover:bg-lira-bg cursor-pointer flex-shrink-0" title="Add a task to this epic" aria-label="Add a task to this epic"><Plus className="w-3.5 h-3.5" /></button>}
    </>
  );
}

function EpicRow({ row: r, issues, today, adding, setAdding, submitAdd, toggleEpic, onOpenItem }: Pick<Props, 'issues' | 'today' | 'adding' | 'setAdding' | 'submitAdd' | 'toggleEpic' | 'onOpenItem'> & { row: EpicRowData }) {
  const { status } = resolveItem(r.item, issues, today);
  const isAdding = adding?.id === r.item.id;
  return (
    <div className="group flex items-center gap-1.5 pl-5 pr-2 border-b border-lira-border/50 hover:bg-lira-bg/50" style={{ height: r.h }}>
      <button onClick={() => toggleEpic(r.item.id)} disabled={r.tickets.length === 0} className="p-0.5 text-lira-muted disabled:opacity-30 cursor-pointer" aria-label={r.expanded ? 'Collapse epic' : 'Expand epic'}>
        {r.expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      <span className="w-4 h-4 rounded flex items-center justify-center text-4xs bg-violet-500/20 text-violet-500 flex-shrink-0" title="Epic"><Zap className="w-3 h-3" /></span>
      {isAdding ? (
        <AddTaskInput epicKey={r.epic?.key} text={adding!.text} onText={text => setAdding({ id: r.item.id, text })} onSubmit={submitAdd} onCancel={() => setAdding(null)} />
      ) : (
        <>
          <button onClick={() => onOpenItem(r.item.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer" title={r.item.title}>
            <span className="text-3xs font-mono text-lira-muted flex-shrink-0">{r.epic?.key || r.item.epicKey || 'no epic'}</span>
            <span className="text-xs font-medium text-lira-text truncate">{r.item.title}</span>
          </button>
          <EpicBadges row={r} status={status} onAdd={() => setAdding({ id: r.item.id, text: '' })} />
        </>
      )}
    </div>
  );
}

function TicketRow({ row: r, onOpenIssue }: { row: TicketRowData; onOpenIssue: (issue: Issue) => void }) {
  const t = r.issue;
  return (
    <button onClick={() => onOpenIssue(t)} {...issueLink(t)} className="w-full flex items-center gap-2 pl-14 pr-3 text-left border-b border-lira-border/40 hover:bg-lira-bg/50 cursor-pointer" style={{ height: r.h }} title={t.title}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ticketColor(t.status) }} />
      <span className="text-3xs font-mono text-lira-muted flex-shrink-0">{t.key}</span>
      <span className="text-xs text-lira-text truncate">{t.title}</span>
      {t.assigneeInitials && <span className="ml-auto text-4xs font-bold text-white bg-lira-blue/70 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">{t.assigneeInitials.slice(0, 2)}</span>}
    </button>
  );
}

/** The left column of the planner: a row for each lane, epic and ticket, with the "add a task" box. */
export function PlannerLabels({ roadmap, rows, issues, today, width, collapsedLanes, adding, setAdding, submitAdd, onToggleLane, toggleEpic, onOpenItem, onOpenIssue }: Props) {
  return (
    <div className="sticky left-0 z-20 bg-lira-surface border-r border-lira-border" style={{ width }}>
      {rows.map(r => {
        if (r.kind === 'lane') return <LaneRow key={`l-${r.lane}`} row={r} roadmap={roadmap} collapsed={collapsedLanes.includes(r.lane)} onToggle={() => onToggleLane(r.lane)} />;
        if (r.kind === 'epic') return <EpicRow key={`e-${r.item.id}`} row={r} issues={issues} today={today} adding={adding} setAdding={setAdding} submitAdd={submitAdd} toggleEpic={toggleEpic} onOpenItem={onOpenItem} />;
        return <TicketRow key={`t-${r.issue.id}`} row={r} onOpenIssue={onOpenIssue} />;
      })}
    </div>
  );
}
