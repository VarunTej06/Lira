import { useState } from 'react';
import { CheckCircle2, Plus, Target } from 'lucide-react';
import type { Issue } from '../../types/issue';
import {
  daysElapsed, daysLeft, followingSprint, getSprintMeta, setSprintMeta, sprintDays, sprintEnd, sprintKindLabel,
  sprintLabel, sprintName, sprintPhase, sprintStart, sprintStats,
} from '../../utils/sprintUtils';
import { BLOCKED_META } from '../../utils/status';
import { notifySaved } from '../common/savedToastStore';
import { CountUp, GrowBar } from '../common/motion';
import { PhaseBadge } from './sprintParts';
import { STATUS_META } from '../../utils/status';
import { useResetWhen } from '../../hooks/useResetWhen';

interface Props {
  sprint: string;
  scope: 'all' | number;
  keys: string[];
  list: Issue[];
  /** Names of the spaces that can add tickets, or null for every space. */
  involvedNames: string[] | null;
  involvedCount?: number;
  onEditSpaces: () => void;
  onAddIssue?: (status: string, opts?: { sprint: string; spaceId?: number }) => void;
  onComplete: () => void;
  /** Called after the goal is saved, so the retrospective card shows the new goal. */
  onGoalSaved: () => void;
}

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** "Nov 1 – Nov 30 · 30 days", then days left while active, and when it was closed. */
function sprintFacts(sprint: string, phase: string, completedAt: string | undefined): string {
  const left = daysLeft(sprint);
  return [
    `${sprintKindLabel(sprint)} · ${fmt(sprintStart(sprint))} – ${fmt(sprintEnd(sprint))} · ${sprintDays(sprint)} days`,
    phase === 'active' ? ` · ${left} day${left === 1 ? '' : 's'} left` : '',
    completedAt ? ` · closed ${new Date(completedAt).toLocaleDateString()}` : '',
  ].join('');
}

/** "Alpha, Beta", a count when the names are empty, or "all spaces". */
const spacesText = (names: string[] | null, count?: number): string => (names ? names.join(', ') || `${count} spaces` : 'all spaces');

type Stats = ReturnType<typeof sprintStats>;
type HeadingProps = Pick<Props, 'sprint' | 'scope' | 'list' | 'keys' | 'involvedNames' | 'involvedCount' | 'onEditSpaces' | 'onAddIssue' | 'onComplete'> & { meta: ReturnType<typeof getSprintMeta>; phase: string };

/** The sprint's name, kind, dates, which spaces take part, and the Create ticket and Complete buttons. */
function SprintHeading({ sprint, scope, list, meta, phase, involvedNames, involvedCount, keys, onEditSpaces, onAddIssue, onComplete }: HeadingProps) {
  const completed = !!meta.completedAt;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-lira-text">{sprintName(sprint)}</h2>
          <PhaseBadge sprint={sprint} />
          {completed && <span className="text-3xs font-semibold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700">Closed</span>}
        </div>
        <p className="text-xs text-lira-muted mt-1">{sprintFacts(sprint, phase, meta.completedAt)}</p>
        <p className="text-xs text-lira-muted mt-1" data-testid="sprint-spaces">
          Spaces: {spacesText(involvedNames, involvedCount)}
          {' '}<button onClick={onEditSpaces} className="text-lira-blue hover:underline cursor-pointer">Edit</button>
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onAddIssue && phase !== 'past' && (
          <button onClick={() => onAddIssue('todo', { sprint, spaceId: scope === 'all' ? undefined : scope })} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-lira-border bg-white hover:bg-gray-50 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Create ticket
          </button>
        )}
        <button
          onClick={onComplete}
          disabled={list.length === 0 && !completed}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-lira-blue text-lira-on-blue hover:bg-lira-blue-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title={completed ? 'Edit the retrospective' : `Close the sprint. Done tickets stay; unfinished tickets move to ${sprintName(followingSprint(sprint, keys))}`}
        >
          <CheckCircle2 className="w-4 h-4" /> {completed ? 'Retrospective' : 'Complete sprint'}
        </button>
      </div>
    </div>
  );
}

/** The sprint goal box: Save and Cancel appear once the text differs from the saved goal. */
function GoalField({ sprint, scope, savedGoal, onGoalSaved }: { sprint: string; scope: 'all' | number; savedGoal: string; onGoalSaved: () => void }) {
  const [goalDraft, setGoalDraft] = useState('');
  useResetWhen([scope, sprint], () => { setGoalDraft(getSprintMeta(scope, sprint).goal || ''); });
  const saveGoal = () => {
    const goal = goalDraft.trim();
    setSprintMeta(scope, sprint, { goal });
    setGoalDraft(goal);
    onGoalSaved();
    notifySaved('Sprint goal saved');
  };
  return (
    <div className="flex items-start gap-2">
      <Target className="w-4 h-4 text-lira-muted mt-1.5 flex-shrink-0" />
      <input
        value={goalDraft}
        onChange={e => setGoalDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') saveGoal(); }}
        placeholder={`Sprint goal for ${sprintLabel(sprint)}… (what must be true by the end?)`}
        aria-label="Sprint goal"
        className="flex-1 text-sm border border-transparent hover:border-lira-border focus:border-lira-blue rounded px-2 py-1.5 bg-transparent text-lira-text outline-none"
      />
      {goalDraft.trim() !== savedGoal && (
        <>
          <button onClick={() => setGoalDraft(savedGoal)} className="px-2.5 py-1.5 text-xs text-lira-muted hover:text-lira-text cursor-pointer">Cancel</button>
          <button onClick={saveGoal} className="px-3 py-1.5 text-xs font-semibold bg-lira-blue text-lira-on-blue rounded-lg hover:bg-lira-blue-hover cursor-pointer">Save goal</button>
        </>
      )}
    </div>
  );
}

/** Done and in-progress share of the sprint as a bar, the points, and a mark for today while the sprint is active. */
function ProgressBar({ sprint, phase, stats }: { sprint: string; phase: string; stats: Stats }) {
  const share = (n: number) => (stats.total ? (n / stats.total) * 100 : 0);
  return (
    <div>
      <div className="flex justify-between text-xs text-lira-muted mb-1">
        <span><CountUp value={stats.done} /> of {stats.total} done · <CountUp value={stats.percent} suffix="%" /></span>
        <span><CountUp value={stats.donePoints} />/{stats.points} points</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
        <GrowBar className="bg-green-500" percent={share(stats.done)} />
        <GrowBar className="bg-blue-500" percent={share(stats.inprogress)} />
      </div>
      {phase === 'active' && (
        <div className="relative h-1 mt-1">
          <div className="absolute top-0 h-1 w-0.5 bg-gray-500" style={{ left: `${(daysElapsed(sprint) / sprintDays(sprint)) * 100}%` }} title="Today" />
        </div>
      )}
    </div>
  );
}

/** One small tile per status, with its count. */
function StatTiles({ stats }: { stats: Stats }) {
  const tiles = [
    { label: 'Backlog', value: stats.backlog, color: STATUS_META.backlog.color },
    { label: 'To Do', value: stats.todo, color: STATUS_META.todo.color },
    { label: 'In Progress', value: stats.inprogress, color: STATUS_META.inprogress.color },
    { label: 'Blocked', value: stats.blocked, color: BLOCKED_META.color },
    { label: 'Done', value: stats.done, color: STATUS_META.done.color },
    { label: 'Carried over in', value: stats.carriedIn, color: '#B45309' },
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {tiles.map(t => (
        <div key={t.label} className="border border-lira-border rounded-md px-2.5 py-1.5 min-w-0">
          <div className="text-lg font-semibold leading-tight" style={{ color: t.color }}><CountUp value={t.value} /></div>
          <div className="text-2xs text-lira-muted truncate">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

/** The sprint's name, dates, goal, progress bar and status counts. */
export function SprintSummary({ sprint, scope, keys, list, involvedNames, involvedCount, onEditSpaces, onAddIssue, onComplete, onGoalSaved }: Props) {
  const meta = getSprintMeta(scope, sprint);
  const phase = sprintPhase(sprint);
  return (
    <div className="bg-white border border-lira-border rounded-lg p-5 space-y-4">
      <SprintHeading sprint={sprint} scope={scope} list={list} keys={keys} meta={meta} phase={phase} involvedNames={involvedNames} involvedCount={involvedCount} onEditSpaces={onEditSpaces} onAddIssue={onAddIssue} onComplete={onComplete} />
      <GoalField sprint={sprint} scope={scope} savedGoal={meta.goal || ''} onGoalSaved={onGoalSaved} />
      <ProgressBar sprint={sprint} phase={phase} stats={sprintStats(list)} />
      <StatTiles stats={sprintStats(list)} />
    </div>
  );
}
