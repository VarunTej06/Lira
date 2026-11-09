import { keepPlace } from '../../utils/keepPlace';
import { notifySaved } from '../common/SavedToast';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { matchesStatusFilter } from '../../utils/spaceFilters';
import { ChevronLeft, ChevronRight, CheckCircle2, ArrowRightCircle, CalendarClock, Target, AlertTriangle, Plus } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import {
  allSprintKeys, burndown, currentSprintKey, daysLeft, getIssueSprint, getSprintMeta,
  getSprintSpaces, setSprintSpaces, isDone, isSprintWork, issuesInSprint, moveIssuesToSprint, followingSprint, neighbourSprint, daysElapsed, sprintKindLabel, setSprintMeta,
  sprintDays, sprintEnd, sprintLabel, sprintName, sprintPhase, sprintStart, sprintStats,
} from '../../utils/sprintUtils';
import { PhaseBadge, SprintSelect, STATUS_META, TicketRow } from './sprintParts';
import { BLOCKED_META } from '../../utils/status';
import { StandupButton } from '../standup/StandupButton';
import { SprintPlanning } from './SprintPlanning';
import { SprintReports } from './SprintReports';
import { EpicTimeline } from './EpicTimeline';
import { CloseSprintModal } from './CloseSprintModal';
import { RetroCard } from './RetroCard';
import { EMPTY_FILTER, SprintFilter, type SprintFilterValue } from './SprintFilter';
import { SprintSpacesPicker } from './SprintSpacesPicker';
import { Modal } from '../common/Modal';
import { CountUp, GrowBar, GrowColumn, motion, slide, Toast } from '../common/motion';

type View = 'sprint' | 'planning' | 'reports' | 'epics';
const VIEWS: { id: View; label: string }[] = [
  { id: 'sprint', label: 'Sprint' },
  { id: 'planning', label: 'Planning' },
  { id: 'reports', label: 'Reports' },
  { id: 'epics', label: 'Epics' },
];

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

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const SprintsPage: React.FC<SprintsPageProps> = ({
  spaces, issues, lockedSpaceId, onIssueClick, onOpenSpace, onAddIssue, onOpenAllTickets,
  focusSprint, onCreateSprint, onBack,
}) => {
  const [scope, setScope] = useState<'all' | number>(lockedSpaceId ?? 'all');
  const [sprint, setSprint] = useState(currentSprintKey());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [goalDraft, setGoalDraft] = useState('');
  // The strip of sprint chips scrolls sideways to show the sprint you are on. It moves only the strip: never the page.
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>('[data-active-sprint="true"]');
    if (strip && chip) strip.scrollLeft = chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2;
  }, [sprint]);
  const [toast, setToast] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>('sprint');
  const [closeOpen, setCloseOpen] = useState(false);
  const [retroVersion, setRetroVersion] = useState(0);
  const [filter, setFilter] = useState<SprintFilterValue>(EMPTY_FILTER);
  const [spacesOpen, setSpacesOpen] = useState(false);
  const [spacesDraft, setSpacesDraft] = useState<number[]>([]);

  useEffect(() => { if (lockedSpaceId) setScope(lockedSpaceId); }, [lockedSpaceId]);
  useEffect(() => { if (focusSprint) setSprint(focusSprint); }, [focusSprint]);
  useEffect(() => { setSelected(new Set()); setFilter(EMPTY_FILTER); }, [sprint, scope]);

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
    () => scoped.filter(i => !isDone(i) && sprintPhase(getIssueSprint(i)) === 'past'),
    [scoped]
  );

  const velocity = useMemo(() => {
    const last = keys.filter(k => sprintPhase(k) !== 'upcoming').slice(-6);
    const rows = last.map(k => {
      const l = issuesInSprint(scoped, k);
      return { key: k, ...sprintStats(l) };
    });
    const max = Math.max(1, ...rows.map(r => r.total));
    const closed = rows.filter(r => sprintPhase(r.key) === 'past' && r.total > 0);
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

  // the status / space filter only narrows the ticket list below; the numbers above stay for the whole sprint
  const visible = useMemo(
    () => list.filter(i => matchesStatusFilter(i, filter.statuses.map(s => s.toLowerCase())) && (!filter.spaceIds.length || filter.spaceIds.includes(i.spaceId))),
    [list, filter],
  );
  const involved = getSprintSpaces(sprint);
  const involvedNames = involved ? spaces.filter(s => involved.includes(s.id!)).map(s => s.name) : [];
  const selectedIssues = list.filter(i => selected.has(i.id!));

  // The one ticket box: its title follows the Status filter, and the checkbox selects or clears every ticket shown.
  const boxCollapsed = collapsed.has('box');
  const statusOrder = ['inprogress', 'todo', 'backlog', 'done'];
  const shown = useMemo(() => [...visible].sort((x, y) => statusOrder.indexOf(x.status?.toLowerCase()) - statusOrder.indexOf(y.status?.toLowerCase())), [visible]);
  const boxTitle = filter.statuses.length === 0 ? 'All tickets' : filter.statuses.map(s => (s === 'blocked' ? BLOCKED_META.label : (STATUS_META as Record<string, { label: string; color: string }>)[s]?.label ?? s)).join(' + ');
  const boxColor = filter.statuses.length === 1 ? (filter.statuses[0] === 'blocked' ? BLOCKED_META.color : (STATUS_META as Record<string, { label: string; color: string }>)[filter.statuses[0]]?.color) : undefined;
  const shownSelected = shown.filter(i => selected.has(i.id!)).length;
  const allVisibleSelected = shown.length > 0 && shownSelected === shown.length;
  const selectAllRef = useRef<HTMLInputElement>(null);
  const boxHeadRef = useRef<HTMLDivElement>(null); // the heading row stays where it is on the screen when the filter changes the list
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = shownSelected > 0 && shownSelected < shown.length; }, [shownSelected, shown.length]);
  const toggleAllVisible = () => setSelected(prev => {
    const next = new Set(prev);
    if (allVisibleSelected) shown.forEach(i => next.delete(i.id!)); else shown.forEach(i => next.add(i.id!));
    return next;
  });
  const unfinished = list.filter(i => !isDone(i));

  const handleComplete = () => setCloseOpen(true);

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
  const elapsed = daysElapsed(sprint);

  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg">
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            {onBack && (
              <button onClick={onBack} className="text-xs text-lira-blue hover:underline cursor-pointer mb-1">← All sprints</button>
            )}
            <h1 className="text-xl font-semibold text-lira-text flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-lira-blue" />
              {lockedSpaceId ? `${spaceById.get(lockedSpaceId)?.name ?? 'Space'} sprints` : 'Sprints'}
            </h1>
            <p className="text-xs text-lira-muted mt-0.5">Sprints run monthly, weekly, bi-weekly or for a set number of days.</p>
          </div>
          <div className="flex items-center gap-2">
            {!lockedSpaceId && (
              <select
                value={scope}
                onChange={e => setScope(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="text-sm border border-lira-border rounded-md px-3 py-1.5 bg-white text-lira-text cursor-pointer"
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
              <button onClick={onCreateSprint} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-lira-blue text-white hover:bg-lira-blue-hover cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> New sprint
              </button>
            )}
            {onOpenAllTickets && (
              <button onClick={onOpenAllTickets} className="text-sm px-3 py-1.5 border border-lira-border rounded-md bg-white text-lira-text hover:bg-gray-50 cursor-pointer">
                All tickets
              </button>
            )}
          </div>
        </div>

        {/* Sprint timeline */}
        <div className="flex items-center gap-2">
          <button onClick={() => setSprint(neighbourSprint(sprint, keys, -1))} className="p-1.5 rounded border border-lira-border bg-white hover:bg-gray-50 cursor-pointer" aria-label="Previous sprint">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div ref={stripRef} className="relative flex-1 flex gap-1.5 overflow-x-auto py-1">
            {keys.map(k => {
              const s = sprintStats(issuesInSprint(scoped, k));
              const active = k === sprint;
              return (
                <button
                  key={k}
                  onClick={() => setSprint(k)}
                  data-active-sprint={active ? 'true' : undefined}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-md border text-left cursor-pointer transition-colors ${
                    active ? 'bg-lira-blue border-lira-blue text-white' : 'bg-white border-lira-border text-lira-text hover:bg-gray-50'
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center gap-1">
                    {sprintLabel(k, true)}
                    {k === currentSprintKey() && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-green-500'}`} />}
                  </div>
                  <div className={`text-[10px] ${active ? 'text-white/80' : 'text-lira-muted'}`}>{s.done}/{s.total} done</div>
                </button>
              );
            })}
          </div>
          <button onClick={() => setSprint(neighbourSprint(sprint, keys, 1))} className="p-1.5 rounded border border-lira-border bg-white hover:bg-gray-50 cursor-pointer" aria-label="Next sprint">
            <ChevronRight className="w-4 h-4" />
          </button>
          {sprint !== currentSprintKey() && (
            <button onClick={() => setSprint(currentSprintKey())} className="text-xs px-2.5 py-1.5 rounded border border-lira-border bg-white hover:bg-gray-50 cursor-pointer">
              Current
            </button>
          )}
        </div>

        {/* Rollover prompt: this sprint has ended and still has unfinished tickets */}
        {phase === 'past' && !meta.completedAt && unfinished.length > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3" role="status" data-testid="rollover-prompt">
            <ArrowRightCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-900 flex-1">
              {sprintName(sprint)} ended with <strong>{unfinished.length}</strong> unfinished ticket{unfinished.length > 1 ? 's' : ''}. Carry {unfinished.length > 1 ? 'them' : 'it'} over to {sprintName(followingSprint(sprint, keys))}?
            </p>
            <button onClick={handleComplete} className="text-xs font-medium px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">
              Carry over and close
            </button>
          </div>
        )}

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
        <div className="bg-white border border-lira-border rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-lira-text">{sprintName(sprint)}</h2>
                <PhaseBadge sprint={sprint} />
                {completed && <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700">Closed</span>}
              </div>
              <p className="text-xs text-lira-muted mt-1">
                {sprintKindLabel(sprint)} · {fmt(sprintStart(sprint))} – {fmt(sprintEnd(sprint))} · {total} days
                {phase === 'active' && ` · ${daysLeft(sprint)} day${daysLeft(sprint) === 1 ? '' : 's'} left`}
                {completed && meta.completedAt && ` · closed ${new Date(meta.completedAt).toLocaleDateString()}`}
              </p>
              <p className="text-xs text-lira-muted mt-1" data-testid="sprint-spaces">
                Spaces: {involved ? involvedNames.join(', ') || `${involved.length} spaces` : 'all spaces'}
                {' '}<button onClick={() => { setSpacesDraft(involved ?? []); setSpacesOpen(true); }} className="text-lira-blue hover:underline cursor-pointer">Edit</button>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onAddIssue && phase !== 'past' && (
                <button onClick={() => onAddIssue('todo', { sprint, spaceId: scope === 'all' ? undefined : scope })} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-lira-border bg-white hover:bg-gray-50 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Create ticket
                </button>
              )}
              <button
                onClick={handleComplete}
                disabled={list.length === 0 && !completed}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-lira-blue text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={completed ? 'Edit the retrospective' : `Close the sprint. Done tickets stay; unfinished tickets move to ${sprintName(followingSprint(sprint, keys))}`}
              >
                <CheckCircle2 className="w-4 h-4" /> {completed ? 'Retrospective' : 'Complete sprint'}
              </button>
            </div>
          </div>

          {/* Goal */}
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-lira-muted mt-1.5 flex-shrink-0" />
            <input
              value={goalDraft}
              onChange={e => setGoalDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setSprintMeta(scope, sprint, { goal: goalDraft.trim() }); setGoalDraft(goalDraft.trim()); setRetroVersion(v => v + 1); notifySaved('Sprint goal saved'); } }}
              placeholder={`Sprint goal for ${sprintLabel(sprint)}… (what must be true by the end?)`}
              aria-label="Sprint goal"
              className="flex-1 text-sm border border-transparent hover:border-lira-border focus:border-lira-blue rounded px-2 py-1.5 bg-transparent text-lira-text outline-none"
            />
            {goalDraft.trim() !== (meta.goal || '') && (
              <>
                <button onClick={() => setGoalDraft(meta.goal || '')} className="px-2.5 py-1.5 text-xs text-lira-muted hover:text-lira-text cursor-pointer">Cancel</button>
                <button
                  onClick={() => { setSprintMeta(scope, sprint, { goal: goalDraft.trim() }); setGoalDraft(goalDraft.trim()); setRetroVersion(v => v + 1); notifySaved('Sprint goal saved'); }}
                  className="px-3 py-1.5 text-xs font-semibold bg-lira-blue text-white rounded-lg hover:bg-lira-blue-hover cursor-pointer"
                >
                  Save goal
                </button>
              </>
            )}
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-lira-muted mb-1">
              <span><CountUp value={stats.done} /> of {stats.total} done · <CountUp value={stats.percent} suffix="%" /></span>
              <span><CountUp value={stats.donePoints} />/{stats.points} points</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
              <GrowBar className="bg-green-500" percent={stats.total ? (stats.done / stats.total) * 100 : 0} />
              <GrowBar className="bg-blue-500" percent={stats.total ? (stats.inprogress / stats.total) * 100 : 0} />
            </div>
            {phase === 'active' && (
              <div className="relative h-1 mt-1">
                <div className="absolute top-0 h-1 w-0.5 bg-gray-500" style={{ left: `${(elapsed / total) * 100}%` }} title="Today" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Backlog', v: stats.backlog, c: STATUS_META.backlog.color },
              { label: 'To Do', v: stats.todo, c: STATUS_META.todo.color },
              { label: 'In Progress', v: stats.inprogress, c: STATUS_META.inprogress.color },
              { label: 'Blocked', v: stats.blocked, c: BLOCKED_META.color },
              { label: 'Done', v: stats.done, c: STATUS_META.done.color },
              { label: 'Carried over in', v: stats.carriedIn, c: '#B45309' },
            ].map(t => (
              <div key={t.label} className="border border-lira-border rounded-md px-2.5 py-1.5 min-w-0">
                <div className="text-lg font-semibold leading-tight" style={{ color: t.c }}><CountUp value={t.v} /></div>
                <div className="text-[11px] text-lira-muted truncate">{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Views */}
        <div className="flex gap-1 border-b border-lira-border" role="tablist" aria-label="Sprint views">
          {VIEWS.map(v => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={`relative px-4 py-2 text-sm font-medium -mb-px border-b-2 border-transparent cursor-pointer transition-colors ${view === v.id ? 'text-lira-blue' : 'text-lira-muted hover:text-lira-text'}`}
            >
              {v.label}
              {view === v.id && <motion.span layoutId="sprint-view-underline" transition={slide} className="absolute left-0 right-0 -bottom-[2px] h-0.5 rounded-full bg-lira-blue" aria-hidden />}
            </button>
          ))}
        </div>

        <motion.div key={view} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={slide} className="space-y-5">
        {view === 'planning' && <SprintPlanning issues={issues} spaces={spaces} sprint={sprint} keys={keys} scope={scope} onIssueClick={onIssueClick} flash={flash} />}
        {view === 'reports' && <SprintReports key={`${sprint}-${scope}`} issues={issues} sprint={sprint} scope={scope} onIssueClick={onIssueClick} />}
        {view === 'epics' && <EpicTimeline issues={issues} keys={keys} scope={scope} sprint={sprint} onIssueClick={onIssueClick} onPickSprint={k => { setSprint(k); setView('sprint'); }} />}

        {view === 'sprint' && (<>
        <RetroCard sprint={sprint} scope={scope} version={retroVersion} onEdit={() => setCloseOpen(true)} onChanged={() => setRetroVersion(v => v + 1)} />

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-lira-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-lira-text mb-2">Burndown</h3>
            <BurndownChart key={`${sprint}-${scope}`} data={burn} total={list.length} />
          </div>
          <div className="bg-white border border-lira-border rounded-lg p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-semibold text-lira-text">Velocity (last sprints)</h3>
              <span className="text-[11px] text-lira-muted">avg {velocity.avg} done / closed sprint</span>
            </div>
            <div key={`${sprint}-${scope}`} className="flex items-end gap-3 h-32">
              {velocity.rows.map((r, n) => (
                <button key={r.key} onClick={() => setSprint(r.key)} className="flex-1 flex flex-col items-center justify-end h-full gap-1 cursor-pointer group" title={`${sprintName(r.key)}: ${r.done}/${r.total} done`}>
                  <div className="w-full flex items-end justify-center gap-0.5 flex-1">
                    <GrowColumn className="w-1/2 bg-gray-300 rounded-t" delay={n * 0.08} heightPercent={(r.total / velocity.max) * 100} />
                    <GrowColumn className="w-1/2 bg-green-500 rounded-t" delay={n * 0.08 + 0.1} heightPercent={(r.done / velocity.max) * 100} />
                  </div>
                  <span className={`text-[10px] ${r.key === sprint ? 'font-bold text-lira-blue' : 'text-lira-muted'}`}>{sprintLabel(r.key, true)}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3 text-[10px] text-lira-muted mt-2">
              <span><span className="inline-block w-2 h-2 bg-gray-300 mr-1" />Committed</span>
              <span><span className="inline-block w-2 h-2 bg-green-500 mr-1" />Done</span>
            </div>
          </div>
        </div>

        {/* Bulk bar */}
        {selectedIssues.length > 0 && (
          <div className="sticky top-0 z-10 flex items-center gap-3 bg-lira-blue text-white rounded-lg px-4 py-2 shadow-md">
            <span className="text-sm font-medium">{selectedIssues.length} selected</span>
            <span className="text-xs opacity-80">Move to</span>
            <SprintSelect value="all" options={keys} onChange={v => v !== 'all' && handleBulkMove(v)} allLabel="Choose sprint…" className="text-lira-text" />
            <button onClick={() => handleBulkMove(followingSprint(sprint, keys))} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 cursor-pointer">
              <ArrowRightCircle className="w-3.5 h-3.5" /> Next sprint
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs underline cursor-pointer">Clear</button>
          </div>
        )}

        {/* All the tickets in one box. The heading row has the select-all checkbox, the title and the filters. */}
        {list.length === 0 ? (
          <div className="bg-white border border-dashed border-lira-border rounded-lg py-12 text-center text-sm text-lira-muted">
            No tickets in {sprintName(sprint)}{scope !== 'all' ? ' for this space' : ''}.
            {phase !== 'past' && ' Create one, or move tickets here from another sprint.'}
          </div>
        ) : (
          <div className="bg-white border border-lira-border rounded-lg overflow-hidden" data-testid="ticket-box">
            <div ref={boxHeadRef} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 bg-gray-50 border-b border-lira-border">
              <button
                type="button"
                aria-label={boxCollapsed ? 'Show the tickets' : 'Hide the tickets'}
                aria-expanded={!boxCollapsed}
                onClick={e => keepPlace(e.currentTarget, () => setCollapsed(prev => { const n = new Set(prev); n.has('box') ? n.delete('box') : n.add('box'); return n; }))}
                className="p-0.5 rounded hover:bg-gray-200 cursor-pointer"
              >
                <ChevronRight className={`w-4 h-4 transition-transform ${boxCollapsed ? '' : 'rotate-90'}`} />
              </button>
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                disabled={visible.length === 0}
                aria-label={allVisibleSelected ? 'Deselect all tickets' : 'Select all tickets'}
                title={allVisibleSelected ? 'Deselect all' : 'Select all'}
                data-testid="select-all"
                className="cursor-pointer"
              />
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: boxColor }} data-testid="ticket-box-title">{boxTitle}</h3>
              <span className="text-xs text-lira-muted" data-testid="filter-count">
                {visible.length}{(filter.statuses.length > 0 || filter.spaceIds.length > 0) ? ` of ${list.length}` : ''}
              </span>
              {filter.statuses.length === 1 && filter.statuses[0] === 'done' && <span className="text-[10px] text-lira-muted">stays in this sprint when it closes</span>}
              <div className="ml-auto">
                <SprintFilter spaces={involved ? spaces.filter(s => involved.includes(s.id!)) || spaces : spaces} value={filter} onChange={v => (boxHeadRef.current ? keepPlace(boxHeadRef.current, () => setFilter(v)) : setFilter(v))} />
              </div>
            </div>
            {!boxCollapsed && (visible.length === 0
              ? <p className="px-4 py-8 text-center text-sm text-lira-muted">No tickets match this filter.</p>
              : shown.map(i => (
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
              )))}
          </div>
        )}

        {scope === 'all' && onOpenSpace && list.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-lira-muted items-center">
            Jump to a space:
            {spaces.filter(s => list.some(i => i.spaceId === s.id)).map(s => (
              <button key={s.id} onClick={() => onOpenSpace(s.id!)} className="px-2 py-1 rounded border border-lira-border bg-white hover:bg-gray-50 text-lira-text cursor-pointer">
                {s.icon} {s.name} ({list.filter(i => i.spaceId === s.id).length})
              </button>
            ))}
          </div>
        )}
        </>)}
        </motion.div>
      </div>

      <Modal isOpen={spacesOpen} onClose={() => setSpacesOpen(false)} title={`Spaces in ${sprintName(sprint)}`} size="md">
        <div className="p-6 space-y-4">
          <SprintSpacesPicker spaces={spaces} value={spacesDraft} onChange={setSpacesDraft} />
          <p className="text-[11px] text-lira-muted">Tickets already in the sprint stay. This decides which spaces can add tickets from now on.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setSpacesOpen(false)} className="text-sm px-3 py-1.5 rounded-lg border border-lira-border bg-white cursor-pointer">Cancel</button>
            <button
              onClick={() => { setSprintSpaces(sprint, spacesDraft.length && spacesDraft.length < spaces.length ? spacesDraft : null); setSpacesOpen(false); flash('Sprint spaces updated'); }}
              className="text-sm px-3 py-1.5 rounded-lg bg-lira-blue text-white cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      <CloseSprintModal
        isOpen={closeOpen}
        onClose={() => setCloseOpen(false)}
        sprint={sprint}
        scope={scope}
        list={list}
        keys={keys}
        onSaved={msg => { flash(msg); setRetroVersion(v => v + 1); }}
      />

      <Toast message={toast} />
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
  if (total === 0) return <p className="text-xs text-lira-muted py-10 text-center">No tickets to chart.</p>;
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
        <motion.polyline points={ideal} fill="none" stroke="#97A0AF" strokeWidth="1.5" strokeDasharray="4 3" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} />
        {actualPts.length > 0 && <motion.polyline points={actual} fill="none" stroke="#0052CC" strokeWidth="2" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: 'easeInOut', delay: 0.15 }} />}
      </svg>
      <div className="flex gap-3 text-[10px] text-lira-muted">
        <span><span className="inline-block w-3 border-t-2 border-dashed border-gray-400 mr-1 align-middle" />Ideal</span>
        <span><span className="inline-block w-3 border-t-2 border-lira-blue mr-1 align-middle" />Remaining</span>
      </div>
    </div>
  );
};
