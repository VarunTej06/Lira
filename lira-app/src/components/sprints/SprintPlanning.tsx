import { issueLink } from '../../utils/links';
import { TypeIcon } from '../common/Icons';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, GripVertical, Minus, Plus, Search } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';
import {
  followingSprint, getIssueSprint, sprintIncludesSpace, getSprintMeta, isDone, isSprintWork, issuesInSprint, moveIssuesToSprint, setSprintMeta, sprintName,
  sprintStats,
} from '../../utils/sprintUtils';
import { Avatar } from '../common/Avatar';
import { suggestedCapacity } from '../../utils/sprintReports';
import { SprintChip, statusMeta } from './sprintParts';

interface SprintPlanningProps {
  issues: Issue[];
  spaces: Space[];
  sprint: string;
  keys: string[];
  scope: 'all' | number;
  onIssueClick: (issue: Issue) => void;
  flash: (msg: string) => void;
}

const DRAG_TYPE = 'application/x-lira-issue';

/** Plan a sprint: the backlog on the left, the sprint on the right. Drag a ticket across, or use the + / − buttons. */
export const SprintPlanning: React.FC<SprintPlanningProps> = ({ issues, spaces, sprint, keys, scope, onIssueClick, flash }) => {
  const [query, setQuery] = useState('');
  const [over, setOver] = useState<'sprint' | 'backlog' | null>(null);
  const [, bump] = useState(0);
  const spaceById = useMemo(() => new Map(spaces.map(s => [s.id!, s])), [spaces]);

  const scoped = useMemo(() => issues.filter(i => isSprintWork(i) && (scope === 'all' || i.spaceId === scope)), [issues, scope]);
  const inSprint = useMemo(() => issuesInSprint(scoped, sprint), [scoped, sprint]);
  const backlog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped
      .filter(i => getIssueSprint(i) !== sprint && !isDone(i) && sprintIncludesSpace(sprint, i.spaceId))
      .filter(i => !q || i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))
      // real backlog first, then tickets sitting in other sprints
      .sort((a, b) => Number(b.status === 'backlog') - Number(a.status === 'backlog') || (a.rank ?? 0) - (b.rank ?? 0));
  }, [scoped, sprint, query]);

  const meta = getSprintMeta(scope, sprint);
  const stats = sprintStats(inSprint);
  const capacity = meta.capacity;
  const suggestion = useMemo(() => suggestedCapacity(scoped, keys), [scoped, keys]);
  const overBy = capacity !== undefined ? stats.points - capacity : 0;
  const unestimated = inSprint.filter(i => typeof i.storyPoints !== 'number').length;
  const closed = !!meta.completedAt;

  const out = followingSprint(sprint, keys);
  const add = async (list: Issue[]) => {
    const moved = await moveIssuesToSprint(list, sprint);
    if (moved) flash(`${moved} ticket${moved > 1 ? 's' : ''} added to ${sprintName(sprint)}`);
  };
  const remove = async (list: Issue[]) => {
    const moved = await moveIssuesToSprint(list, out);
    if (moved) flash(`${moved} ticket${moved > 1 ? 's' : ''} moved to ${sprintName(out)}`);
  };
  const dragStart = (e: React.DragEvent, i: Issue) => {
    e.dataTransfer.setData(DRAG_TYPE, String(i.id));
    e.dataTransfer.effectAllowed = 'move';
  };
  const drop = (e: React.DragEvent, target: 'sprint' | 'backlog') => {
    e.preventDefault();
    setOver(null);
    const id = Number(e.dataTransfer.getData(DRAG_TYPE));
    const issue = scoped.find(i => i.id === id);
    if (!issue) return;
    if (target === 'sprint' && getIssueSprint(issue) !== sprint) void add([issue]);
    if (target === 'backlog' && getIssueSprint(issue) === sprint) void remove([issue]);
  };
  const allow = (target: 'sprint' | 'backlog') => (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    setOver(target);
  };

  const card = (i: Issue, side: 'sprint' | 'backlog') => {
    const type = ISSUE_TYPE_CONFIG[i.type] ?? ISSUE_TYPE_CONFIG.task;
    const st = statusMeta(i.status);
    const space = spaceById.get(i.spaceId);
    return (
      <div
        key={i.id}
        draggable={!closed}
        onDragStart={e => dragStart(e, i)}
        onClick={() => onIssueClick(i)} {...issueLink(i)}
        className="group flex items-center gap-2 px-2.5 py-2 border border-lira-border bg-white rounded-lg hover:shadow-sm cursor-pointer"
        data-testid={`plan-${side}-${i.key}`}
      >
        <GripVertical className="w-3.5 h-3.5 text-lira-muted flex-shrink-0 cursor-grab" aria-hidden />
        <span title={type.label} className="flex-shrink-0"><TypeIcon type={i.type} className="w-4 h-4" /></span>
        <span className="text-[11px] font-medium text-lira-muted flex-shrink-0">{i.key}</span>
        <span className="flex-1 min-w-0 text-sm text-lira-text truncate">{i.title}</span>
        {scope === 'all' && space && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white flex-shrink-0" style={{ backgroundColor: space.color }}>{space.key}</span>
        )}
        {side === 'backlog' && i.status !== 'backlog' && <SprintChip sprint={getIssueSprint(i)} />}
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: st.color, backgroundColor: st.bg }}>{st.label}</span>
        <span
          className={`text-[10px] rounded-full px-1.5 py-0.5 flex-shrink-0 ${typeof i.storyPoints === 'number' ? 'bg-gray-100 text-gray-700' : 'bg-amber-50 text-amber-700'}`}
          title={typeof i.storyPoints === 'number' ? 'Story points' : 'Not estimated'}
        >
          {typeof i.storyPoints === 'number' ? i.storyPoints : '?'}
        </span>
        <Avatar initials={i.assigneeInitials} size="xs" />
        {!closed && (
          <button
            onClick={e => { e.stopPropagation(); void (side === 'backlog' ? add([i]) : remove([i])); }}
            className="p-1 rounded-md border border-lira-border bg-white hover:bg-gray-50 cursor-pointer flex-shrink-0"
            aria-label={side === 'backlog' ? `Add ${i.key} to sprint` : `Move ${i.key} out of sprint`}
            title={side === 'backlog' ? 'Add to this sprint' : `Move to ${sprintName(out)}`}
          >
            {side === 'backlog' ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    );
  };

  const pct = capacity ? Math.min(100, Math.round((stats.points / capacity) * 100)) : 0;

  return (
    <div className="space-y-3">
      {/* Capacity */}
      <div className="bg-white border border-lira-border rounded-xl p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-lira-muted font-semibold">Committed</div>
            <div className="text-lg font-semibold text-lira-text" data-testid="plan-points">{stats.points} <span className="text-xs font-normal text-lira-muted">points · {stats.total} tickets</span></div>
          </div>
          <label className="text-xs text-lira-muted flex items-center gap-2">
            Team capacity
            <input
              type="number"
              min={0}
              value={capacity ?? ''}
              placeholder="points"
              aria-label="Team capacity in story points"
              onChange={e => {
                const v = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value));
                setSprintMeta(scope, sprint, { capacity: v });
                bump(n => n + 1);
              }}
              className="w-20 text-sm border border-lira-border rounded-lg px-2 py-1 bg-white text-lira-text focus:outline-none focus:border-lira-blue"
            />
          </label>
          {capacity === undefined && suggestion !== null && (
            <button
              onClick={() => { setSprintMeta(scope, sprint, { capacity: suggestion }); bump(n => n + 1); }}
              className="text-xs text-lira-blue hover:underline cursor-pointer"
            >
              Use {suggestion} (average of the last closed sprints)
            </button>
          )}
        </div>
        {capacity !== undefined && capacity > 0 && (
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={stats.points} aria-label="Points against capacity">
            <div className={overBy > 0 ? 'bg-red-500 h-full' : pct >= 90 ? 'bg-amber-500 h-full' : 'bg-green-500 h-full'} style={{ width: `${pct}%` }} />
          </div>
        )}
        {overBy > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert" data-testid="plan-overcommit">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Over-committed by {overBy} point{overBy === 1 ? '' : 's'}: {stats.points} planned against a capacity of {capacity}. Move something out or raise the capacity.
          </p>
        )}
        {unestimated > 0 && (
          <p className="text-[11px] text-amber-700">{unestimated} ticket{unestimated === 1 ? ' has' : 's have'} no story points, so the total may be understated.</p>
        )}
        {closed && <p className="text-[11px] text-lira-muted">This sprint is closed. Planning is read-only.</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Backlog */}
        <section
          onDragOver={allow('backlog')} onDragLeave={() => setOver(null)} onDrop={e => drop(e, 'backlog')}
          className={`rounded-xl border p-3 space-y-2 min-h-[240px] transition-colors ${over === 'backlog' ? 'border-lira-blue bg-lira-blue-light' : 'border-lira-border bg-gray-50'}`}
          aria-label="Backlog"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-lira-text">Backlog</h3>
            <span className="text-xs text-lira-muted">{backlog.length}</span>
            <div className="ml-auto relative">
              <Search className="w-3.5 h-3.5 text-lira-muted absolute left-2 top-1/2 -translate-y-1/2" aria-hidden />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search the backlog"
                className="text-xs border border-lira-border rounded-lg pl-7 pr-2 py-1 w-40 bg-white focus:outline-none focus:border-lira-blue"
              />
            </div>
          </div>
          <p className="text-[11px] text-lira-muted">Open tickets that are not in this sprint. Drag them right, or use +.</p>
          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-0.5">
            {backlog.map(i => card(i, 'backlog'))}
            {backlog.length === 0 && <p className="text-xs text-lira-muted text-center py-8">{query ? 'No tickets match.' : 'Nothing left to plan.'}</p>}
          </div>
        </section>

        {/* Sprint */}
        <section
          onDragOver={allow('sprint')} onDragLeave={() => setOver(null)} onDrop={e => drop(e, 'sprint')}
          className={`rounded-xl border p-3 space-y-2 min-h-[240px] transition-colors ${over === 'sprint' ? 'border-lira-blue bg-lira-blue-light' : 'border-lira-border bg-gray-50'}`}
          aria-label="Sprint"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-lira-text">{sprintName(sprint)}</h3>
            <span className="text-xs text-lira-muted">{inSprint.length}</span>
          </div>
          <p className="text-[11px] text-lira-muted">Drag a ticket back to the backlog to move it to {sprintName(out)}.</p>
          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-0.5">
            {inSprint.map(i => card(i, 'sprint'))}
            {inSprint.length === 0 && <p className="text-xs text-lira-muted text-center py-8">Empty. Drag tickets here from the backlog.</p>}
          </div>
        </section>
      </div>
    </div>
  );
};
