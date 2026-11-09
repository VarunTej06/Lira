import React, { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import {
  followingSprint, getIssueSprint, getSprintMeta, isSprintWork, issuesInSprint, moveIssuesToSprint, setSprintMeta, sprintName, sprintStats,
} from '../../utils/sprintUtils';
import { suggestedCapacity } from '../../utils/sprintReports';
import { CapacityPanel } from './CapacityPanel';
import { PlanningCard } from './PlanningCard';
import { backlogFor, movedMessage } from './planningRules';

interface SprintPlanningProps {
  issues: Issue[];
  spaces: Space[];
  sprint: string;
  keys: string[];
  scope: 'all' | number;
  onIssueClick: (issue: Issue) => void;
  flash: (msg: string) => void;
}

type Side = 'sprint' | 'backlog';
const DRAG_TYPE = 'application/x-lira-issue';

interface DropListProps {
  side: Side;
  title: string;
  count: number;
  over: Side | null;
  hint: string;
  /** Extra controls on the heading row (the backlog has a search box). */
  headExtra?: ReactNode;
  onOver: (e: React.DragEvent) => void;
  onLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  children: ReactNode;
}

/** One of the two lists: a drop target with a heading, a hint and the cards. */
function DropList({ side, title, count, over, hint, headExtra, onOver, onLeave, onDrop, children }: DropListProps) {
  return (
    <section
      onDragOver={onOver} onDragLeave={onLeave} onDrop={onDrop}
      className={`rounded-xl border p-3 space-y-2 min-h-[240px] transition-colors ${over === side ? 'border-lira-blue bg-lira-blue-light' : 'border-lira-border bg-gray-50'}`}
      aria-label={side === 'backlog' ? 'Backlog' : 'Sprint'}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-lira-text">{title}</h3>
        <span className="text-xs text-lira-muted">{count}</span>
        {headExtra}
      </div>
      <p className="text-2xs text-lira-muted">{hint}</p>
      <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-0.5">{children}</div>
    </section>
  );
}

function BacklogSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="ml-auto relative">
      <Search className="w-3.5 h-3.5 text-lira-muted absolute left-2 top-1/2 -translate-y-1/2" aria-hidden />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search"
        aria-label="Search the backlog"
        className="text-xs border border-lira-border rounded-lg pl-7 pr-2 py-1 w-40 bg-white focus:outline-none focus:border-lira-blue"
      />
    </div>
  );
}

const emptyNote = (text: string) => <p className="text-xs text-lira-muted text-center py-8">{text}</p>;

/** Plan a sprint: the backlog on the left, the sprint on the right. Drag a ticket across, or use the + / − buttons. */
export const SprintPlanning: React.FC<SprintPlanningProps> = ({ issues, spaces, sprint, keys, scope, onIssueClick, flash }) => {
  const [query, setQuery] = useState('');
  const [over, setOver] = useState<Side | null>(null);
  const [, bump] = useState(0);
  const spaceById = useMemo(() => new Map(spaces.map(s => [s.id!, s])), [spaces]);

  const scoped = useMemo(() => issues.filter(i => isSprintWork(i) && (scope === 'all' || i.spaceId === scope)), [issues, scope]);
  const inSprint = useMemo(() => issuesInSprint(scoped, sprint), [scoped, sprint]);
  const backlog = useMemo(() => backlogFor(scoped, sprint, query), [scoped, sprint, query]);

  const meta = getSprintMeta(scope, sprint);
  const stats = sprintStats(inSprint);
  const suggestion = useMemo(() => suggestedCapacity(scoped, keys), [scoped, keys]);
  const closed = !!meta.completedAt;

  const out = followingSprint(sprint, keys);
  const moveTo = async (list: Issue[], target: string, verb: string) => {
    const moved = await moveIssuesToSprint(list, target);
    if (moved) flash(movedMessage(moved, verb, sprintName(target)));
  };
  const add = (list: Issue[]) => moveTo(list, sprint, 'added to');
  const remove = (list: Issue[]) => moveTo(list, out, 'moved to');
  const dragStart = (e: React.DragEvent, i: Issue) => {
    e.dataTransfer.setData(DRAG_TYPE, String(i.id));
    e.dataTransfer.effectAllowed = 'move';
  };
  const drop = (e: React.DragEvent, target: Side) => {
    e.preventDefault();
    setOver(null);
    const issue = scoped.find(i => i.id === Number(e.dataTransfer.getData(DRAG_TYPE)));
    if (!issue) return;
    const inThisSprint = getIssueSprint(issue) === sprint;
    if (target === 'sprint' && !inThisSprint) void add([issue]);
    if (target === 'backlog' && inThisSprint) void remove([issue]);
  };
  const allow = (target: Side) => (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    setOver(target);
  };
  const setCapacity = (capacity: number | undefined) => {
    setSprintMeta(scope, sprint, { capacity });
    bump(n => n + 1);
  };

  const card = (i: Issue, side: Side) => (
    <PlanningCard
      key={i.id} issue={i} side={side} space={spaceById.get(i.spaceId)} showSpace={scope === 'all'} closed={closed} outSprint={out}
      onOpen={onIssueClick} onDragStart={dragStart} onMove={x => void (side === 'backlog' ? add([x]) : remove([x]))}
    />
  );

  return (
    <div className="space-y-3">
      <CapacityPanel
        points={stats.points} total={stats.total} capacity={meta.capacity} suggestion={suggestion}
        unestimated={inSprint.filter(i => typeof i.storyPoints !== 'number').length} closed={closed} onCapacity={setCapacity}
      />
      <div className="grid md:grid-cols-2 gap-4">
        <DropList
          side="backlog" title="Backlog" count={backlog.length} over={over} headExtra={<BacklogSearch value={query} onChange={setQuery} />}
          hint="Open tickets that are not in this sprint. Drag them right, or use +."
          onOver={allow('backlog')} onLeave={() => setOver(null)} onDrop={e => drop(e, 'backlog')}
        >
          {backlog.map(i => card(i, 'backlog'))}
          {backlog.length === 0 && emptyNote(query ? 'No tickets match.' : 'Nothing left to plan.')}
        </DropList>
        <DropList
          side="sprint" title={sprintName(sprint)} count={inSprint.length} over={over}
          hint={`Drag a ticket back to the backlog to move it to ${sprintName(out)}.`}
          onOver={allow('sprint')} onLeave={() => setOver(null)} onDrop={e => drop(e, 'sprint')}
        >
          {inSprint.map(i => card(i, 'sprint'))}
          {inSprint.length === 0 && emptyNote('Empty. Drag tickets here from the backlog.')}
        </DropList>
      </div>
    </div>
  );
};
