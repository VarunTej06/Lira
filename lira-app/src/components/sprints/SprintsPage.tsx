import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, ArrowRightCircle, CalendarClock, Target, AlertTriangle, Plus } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import {
  allSprintKeys, burndown, completeSprint, currentSprintKey, daysLeft, getIssueSprint, getSprintMeta,
  isDone, isSprintWork, issuesInSprint, moveIssuesToSprint, nextSprint, prevSprint, setSprintMeta,
  sprintDays, sprintEnd, sprintLabel, sprintName, sprintPhase, sprintStart, sprintStats,
} from '../../utils/sprintUtils';
import { PhaseBadge, SprintSelect, STATUS_META, TicketRow } from './sprintParts';
import { StandupButton } from '../standup/StandupButton';

interface SprintsPageProps {
  spaces: Space[];
  issues: Issue[];
  /** When set, the page is locked to one space (used by a space's "Sprints" tab). */
  lockedSpaceId?: number;
  onIssueClick: (issue: Issue) => void;
  onOpenSpace?: (spaceId: number) => void;
  /** Create a ticket in the sprint being viewed; spaceId is set only when the page is scoped to one space. */
  onAddIssue?: (status: string, opts?: { sprint: string; spaceId?: number }) => void;
  onOpenAllTickets?: () => void;
  /** Jump to this sprint (e.g. when picked from the sidebar). */
  focusSprint?: string;
  onCreateSprint?: () => void;
  /** Shows a "← All sprints" link back to the overview. */
  onBack?: () => void;
}

const GROUPS = ['inprogress', 'todo', 'backlog', 'done'] as const;
const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const SprintsPage: React.FC<SprintsPageProps> = ({
  spaces, issues, lockedSpaceId, onIssueClick, onOpenSpace, onAddIssue, onOpenAllTickets,
  focusSprint, onCreateSprint, onBack,
}) => {
  const [scope, setScope] = useState<'all' | number>(lockedSpaceId ?? 'all');
  const [sprint, setSprint] = useState(currentSprintKey());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [goalDraft, setGoalDraft] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => { if (lockedSpaceId) setScope(lockedSpaceId); }, [lockedSpaceId]);
  useEffect(() => { if (focusSprint) setSprint(focusSprint); }, [focusSprint]);
  useEffect(() => { setSelected(new Set()); }, [sprint, scope]);

  const spaceById = useMemo(() => new Map(spaces.map(s => [s.id!, s])), [spaces]);

  // Everything below is limited to the chosen space (or all spaces)
  const scoped = useMemo(
    () => issues.filter(i => isSprintWork(i) && (scope === 'all' || i.spaceId === scope)),
    [issues, scope]
  );
  const keys = useMemo(() => allSprintKeys(scoped), [scoped]);
  const list = useMemo(() => issuesInSprint(scoped, sprint), [scoped, sprint]);
  const stats = useMemo(() => sprintStats(list), [list]);
  const phase = sprintPhase(sprint);
  const meta = getSprintMeta(scope, sprint);

  useEffect(() => { setGoalDraft(getSprintMeta(scope, sprint).goal || ''); }, [scope, sprint]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  // Open tickets stranded in sprints that already ended
  const stranded = useMemo(
    () => scoped.filter(i => !isDone(i) && getIssueSprint(i) < currentSprintKey()),
    [scoped]
  );

  const velocity = useMemo(() => {
    const cur = currentSprintKey();
    const last = keys.filter(k => k <= cur).slice(-6);
    const rows = last.map(k => {
      const l = issuesInSprint(scoped, k);
      return { key: k, ...sprintStats(l) };
    });
    const max = Math.max(1, ...rows.map(r => r.total));
    const closed = rows.filter(r => r.key < cur && r.total > 0);
    const avg = closed.length ? Math.round(closed.reduce((a, r) => a + r.done, 0) / closed.length) : 0;
    return { rows, max, avg };
  }, [keys, scoped]);

  const burn = useMemo(() => burndown(list, sprint), [list, sprint]);

  const toggle = (i: Issue) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i.id!) ? next.delete(i.id!) : next.add(i.id!);
      return next;
    });

  const selectedIssues = list.filter(i => selected.has(i.id!));
  const unfinished = list.filter(i => !isDone(i));

  const handleComplete = async () => {
    const target = nextSprint(sprint);
    if (unfinished.length > 0 &&
        !window.confirm(`Complete ${sprintName(sprint)}?\n\n${stats.done} done ticket(s) stay in this sprint.\n${unfinished.length} unfinished ticket(s) (backlog / to do / in progress) move to ${sprintName(target)}.`)) return;
    const moved = await completeSprint(list, sprint, scope, target);
    flash(moved ? `${moved} unfinished ticket${moved > 1 ? 's' : ''} carried over to ${sprintName(target)}` : `${sprintName(sprint)} completed — nothing to carry over`);
  };

  const handleRescue = async () => {
    const moved = await moveIssuesToSprint(stranded, currentSprintKey());
    flash(`${moved} stranded ticket${moved > 1 ? 's' : ''} moved to ${sprintName(currentSprintKey())}`);
  };

  const handleBulkMove = async (target: string) => {
    const moved = await moveIssuesToSprint(selectedIssues, target);
    setSelected(new Set());
    flash(`${moved} ticket${moved > 1 ? 's' : ''} moved to ${sprintName(target)}`);
  };

  const completed = !!meta.completedAt;
  const total = sprintDays(sprint);
  const elapsed = phase === 'past' ? total : phase === 'upcoming' ? 0 : new Date().getDate();

  return (
    <div className="flex-1 overflow-y-auto bg-jira-bg">
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            {onBack && (
              <button onClick={onBack} className="text-xs text-jira-blue hover:underline cursor-pointer mb-1">← All sprints</button>
            )}
            <h1 className="text-xl font-semibold text-jira-text flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-jira-blue" />
              {lockedSpaceId ? `${spaceById.get(lockedSpaceId)?.name ?? 'Space'} sprints` : 'Sprints'}
            </h1>
            <p className="text-xs text-jira-muted mt-0.5">Monthly sprints — every calendar month is one sprint.</p>
          </div>
          <div className="flex items-center gap-2">
            {!lockedSpaceId && (
              <select
                value={scope}
                onChange={e => setScope(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="text-sm border border-jira-border rounded-md px-3 py-1.5 bg-white text-jira-text cursor-pointer"
                aria-label="Space"
              >
                <option value="all">All spaces</option>
                {spaces.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            )}
            <StandupButton
              scope={{
                type: 'sprint',
                id: `sprint:${sprint}:${scope}`,
                name: `${sprintName(sprint)}${scope !== 'all' ? ' · ' + (spaceById.get(scope)?.name ?? '') : ''}`,
                sprint,
                spaceId: scope === 'all' ? undefined : scope,
              }}
              className="!py-1.5 !text-sm"
            />
            {onCreateSprint && (
              <button onClick={onCreateSprint} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-jira-blue text-white hover:bg-jira-blue-hover cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> New sprint
              </button>
            )}
            {onOpenAllTickets && (
              <button onClick={onOpenAllTickets} className="text-sm px-3 py-1.5 border border-jira-border rounded-md bg-white text-jira-text hover:bg-gray-50 cursor-pointer">
                All tickets
              </button>
            )}
          </div>
        </div>

        {/* Sprint timeline */}
        <div className="flex items-center gap-2">
          <button onClick={() => setSprint(prevSprint(sprint))} className="p-1.5 rounded border border-jira-border bg-white hover:bg-gray-50 cursor-pointer" aria-label="Previous sprint">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 flex gap-1.5 overflow-x-auto py-1">
            {keys.map(k => {
              const s = sprintStats(issuesInSprint(scoped, k));
              const active = k === sprint;
              return (
                <button
                  key={k}
                  onClick={() => setSprint(k)}
                  ref={el => { if (el && active) el.scrollIntoView({ inline: 'center', block: 'nearest' }); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-md border text-left cursor-pointer transition-colors ${
                    active ? 'bg-jira-blue border-jira-blue text-white' : 'bg-white border-jira-border text-jira-text hover:bg-gray-50'
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center gap-1">
                    {sprintLabel(k, true)}
                    {k === currentSprintKey() && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-green-500'}`} />}
                  </div>
                  <div className={`text-[10px] ${active ? 'text-white/80' : 'text-jira-muted'}`}>{s.done}/{s.total} done</div>
                </button>
              );
            })}
          </div>
          <button onClick={() => setSprint(nextSprint(sprint))} className="p-1.5 rounded border border-jira-border bg-white hover:bg-gray-50 cursor-pointer" aria-label="Next sprint">
            <ChevronRight className="w-4 h-4" />
          </button>
          {sprint !== currentSprintKey() && (
            <button onClick={() => setSprint(currentSprintKey())} className="text-xs px-2.5 py-1.5 rounded border border-jira-border bg-white hover:bg-gray-50 cursor-pointer">
              Current
            </button>
          )}
        </div>

        {/* Stranded banner */}
        {stranded.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 flex-1">
              <strong>{stranded.length}</strong> unfinished ticket{stranded.length > 1 ? 's are' : ' is'} still sitting in sprints that have already ended.
            </p>
            <button onClick={handleRescue} className="text-xs font-medium px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 cursor-pointer">
              Move to {sprintLabel(currentSprintKey(), true)}
            </button>
          </div>
        )}

        {/* Sprint summary */}
        <div className="bg-white border border-jira-border rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-jira-text">{sprintName(sprint)}</h2>
                <PhaseBadge sprint={sprint} />
                {completed && <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700">Closed</span>}
              </div>
              <p className="text-xs text-jira-muted mt-1">
                {fmt(sprintStart(sprint))} – {fmt(sprintEnd(sprint))} · {total} days
                {phase === 'active' && ` · ${daysLeft(sprint)} day${daysLeft(sprint) === 1 ? '' : 's'} left`}
                {completed && meta.completedAt && ` · closed ${new Date(meta.completedAt).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onAddIssue && phase !== 'past' && (
                <button onClick={() => onAddIssue('todo', { sprint, spaceId: scope === 'all' ? undefined : scope })} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-jira-border bg-white hover:bg-gray-50 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Create ticket
                </button>
              )}
              <button
                onClick={handleComplete}
                disabled={list.length === 0}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-jira-blue text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={`Done tickets stay; unfinished tickets move to ${sprintName(nextSprint(sprint))}`}
              >
                <CheckCircle2 className="w-4 h-4" /> Complete sprint
              </button>
            </div>
          </div>

          {/* Goal */}
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-jira-muted mt-1.5 flex-shrink-0" />
            <input
              value={goalDraft}
              onChange={e => setGoalDraft(e.target.value)}
              onBlur={() => setSprintMeta(scope, sprint, { goal: goalDraft })}
              placeholder={`Sprint goal for ${sprintLabel(sprint)}… (what must be true by month end?)`}
              className="flex-1 text-sm border border-transparent hover:border-jira-border focus:border-jira-blue rounded px-2 py-1.5 bg-transparent text-jira-text outline-none"
            />
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-jira-muted mb-1">
              <span>{stats.done} of {stats.total} done · {stats.percent}%</span>
              <span>{stats.donePoints}/{stats.points} points</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
              <div className="bg-green-500" style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }} />
              <div className="bg-blue-500" style={{ width: `${stats.total ? (stats.inprogress / stats.total) * 100 : 0}%` }} />
            </div>
            {phase === 'active' && (
              <div className="relative h-1 mt-1">
                <div className="absolute top-0 h-1 w-0.5 bg-gray-500" style={{ left: `${(elapsed / total) * 100}%` }} title="Today" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Backlog', v: stats.backlog, c: STATUS_META.backlog.color },
              { label: 'To Do', v: stats.todo, c: STATUS_META.todo.color },
              { label: 'In Progress', v: stats.inprogress, c: STATUS_META.inprogress.color },
              { label: 'Done', v: stats.done, c: STATUS_META.done.color },
              { label: 'Carried over in', v: stats.carriedIn, c: '#B45309' },
            ].map(t => (
              <div key={t.label} className="border border-jira-border rounded-md px-3 py-2">
                <div className="text-xl font-semibold" style={{ color: t.c }}>{t.v}</div>
                <div className="text-[11px] text-jira-muted">{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-jira-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-jira-text mb-2">Burndown</h3>
            <BurndownChart data={burn} total={list.length} />
          </div>
          <div className="bg-white border border-jira-border rounded-lg p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-semibold text-jira-text">Velocity (last sprints)</h3>
              <span className="text-[11px] text-jira-muted">avg {velocity.avg} done / closed sprint</span>
            </div>
            <div className="flex items-end gap-3 h-32">
              {velocity.rows.map(r => (
                <button key={r.key} onClick={() => setSprint(r.key)} className="flex-1 flex flex-col items-center justify-end h-full gap-1 cursor-pointer group" title={`${sprintName(r.key)}: ${r.done}/${r.total} done`}>
                  <div className="w-full flex items-end justify-center gap-0.5 flex-1">
                    <div className="w-1/2 bg-gray-300 rounded-t" style={{ height: `${(r.total / velocity.max) * 100}%` }} />
                    <div className="w-1/2 bg-green-500 rounded-t" style={{ height: `${(r.done / velocity.max) * 100}%` }} />
                  </div>
                  <span className={`text-[10px] ${r.key === sprint ? 'font-bold text-jira-blue' : 'text-jira-muted'}`}>{sprintLabel(r.key, true)}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3 text-[10px] text-jira-muted mt-2">
              <span><span className="inline-block w-2 h-2 bg-gray-300 mr-1" />Committed</span>
              <span><span className="inline-block w-2 h-2 bg-green-500 mr-1" />Done</span>
            </div>
          </div>
        </div>

        {/* Bulk bar */}
        {selectedIssues.length > 0 && (
          <div className="sticky top-0 z-10 flex items-center gap-3 bg-jira-blue text-white rounded-lg px-4 py-2 shadow-md">
            <span className="text-sm font-medium">{selectedIssues.length} selected</span>
            <span className="text-xs opacity-80">Move to</span>
            <SprintSelect value="all" options={keys} onChange={v => v !== 'all' && handleBulkMove(v)} allLabel="Choose sprint…" className="text-jira-text" />
            <button onClick={() => handleBulkMove(nextSprint(sprint))} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 cursor-pointer">
              <ArrowRightCircle className="w-3.5 h-3.5" /> Next sprint
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs underline cursor-pointer">Clear</button>
          </div>
        )}

        {/* Tickets grouped by status */}
        <div className="space-y-3">
          {list.length === 0 && (
            <div className="bg-white border border-dashed border-jira-border rounded-lg py-12 text-center text-sm text-jira-muted">
              No tickets in {sprintName(sprint)}{scope !== 'all' ? ' for this space' : ''}.
              {phase !== 'past' && ' Create one, or move tickets here from another sprint.'}
            </div>
          )}
          {GROUPS.map(status => {
            const rows = list.filter(i => i.status?.toLowerCase() === status);
            if (rows.length === 0) return null;
            const sm = STATUS_META[status];
            const isCollapsed = collapsed.has(status);
            return (
              <div key={status} className="bg-white border border-jira-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setCollapsed(prev => { const n = new Set(prev); n.has(status) ? n.delete(status) : n.add(status); return n; })}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-jira-border text-left cursor-pointer"
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: sm.color }}>{sm.label}</span>
                  <span className="text-xs text-jira-muted">{rows.length}</span>
                  {status === 'done' && <span className="text-[10px] text-jira-muted ml-auto">stays in this sprint when it closes</span>}
                </button>
                {!isCollapsed && rows.map(i => (
                  <TicketRow
                    key={i.id}
                    issue={i}
                    space={spaceById.get(i.spaceId)}
                    showSpace={scope === 'all'}
                    sprintOptions={keys}
                    selected={selected.has(i.id!)}
                    onToggleSelect={toggle}
                    onClick={onIssueClick}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {scope === 'all' && onOpenSpace && list.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-jira-muted items-center">
            Jump to a space:
            {spaces.filter(s => list.some(i => i.spaceId === s.id)).map(s => (
              <button key={s.id} onClick={() => onOpenSpace(s.id!)} className="px-2 py-1 rounded border border-jira-border bg-white hover:bg-gray-50 text-jira-text cursor-pointer">
                {s.icon} {s.name} ({list.filter(i => i.spaceId === s.id).length})
              </button>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
};

const BurndownChart: React.FC<{ data: ReturnType<typeof burndown>; total: number }> = ({ data, total }) => {
  const W = 420, H = 150, P = { l: 28, r: 8, t: 8, b: 20 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const n = data.length;
  const x = (d: number) => P.l + ((d - 1) / Math.max(1, n - 1)) * iw;
  const y = (v: number) => P.t + ih - (total ? (v / total) * ih : 0);
  const ideal = data.map(p => `${x(p.day)},${y(p.ideal)}`).join(' ');
  const actualPts = data.filter(p => p.actual !== null);
  const actual = actualPts.map(p => `${x(p.day)},${y(p.actual!)}`).join(' ');
  if (total === 0) return <p className="text-xs text-jira-muted py-10 text-center">No tickets to chart.</p>;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36" role="img" aria-label="Burndown chart">
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={y(total * f)} y2={y(total * f)} stroke="#DFE1E6" strokeWidth="1" />
            <text x={P.l - 4} y={y(total * f) + 3} fontSize="9" textAnchor="end" fill="#6B778C">{Math.round(total * f)}</text>
          </g>
        ))}
        {[1, Math.ceil(n / 2), n].map(d => (
          <text key={d} x={x(d)} y={H - 6} fontSize="9" textAnchor="middle" fill="#6B778C">{d}</text>
        ))}
        <polyline points={ideal} fill="none" stroke="#97A0AF" strokeWidth="1.5" strokeDasharray="4 3" />
        {actualPts.length > 0 && <polyline points={actual} fill="none" stroke="#0052CC" strokeWidth="2" />}
      </svg>
      <div className="flex gap-3 text-[10px] text-jira-muted">
        <span><span className="inline-block w-3 border-t-2 border-dashed border-gray-400 mr-1 align-middle" />Ideal</span>
        <span><span className="inline-block w-3 border-t-2 border-jira-blue mr-1 align-middle" />Remaining</span>
      </div>
    </div>
  );
};
