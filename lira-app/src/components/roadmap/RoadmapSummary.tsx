import type { ReactNode } from 'react';
import { AlertTriangle, CalendarClock, Flag, Target } from 'lucide-react';
import { AnimatedValue } from '../common/motion';
import { STATUS_META, summarize, type RoadmapStatus } from '../../utils/roadmapUtils';

type Summary = ReturnType<typeof summarize>;
const STATUSES = Object.keys(STATUS_META) as RoadmapStatus[];

/** The four number tiles and the stacked status bar at the top of a roadmap. `conflicts` counts dependency problems. */
export function RoadmapSummary({ summary, conflicts }: { summary: Summary; conflicts: number }) {
  const total = Math.max(1, summary.total);
  const tiles: { label: string; value: ReactNode; sub: string; icon: ReactNode; tone: string }[] = [
    { label: 'Overall progress', value: `${summary.percent}%`, sub: `${summary.byStatus.done} of ${summary.total} epics done`, icon: <Target className="w-4 h-4" />, tone: 'text-lira-blue bg-lira-blue-light' },
    { label: 'Next milestone', value: summary.nextMilestone ? (summary.daysToNextMilestone === 0 ? 'Today' : `${summary.daysToNextMilestone}d`) : '—', sub: summary.nextMilestone?.title || 'None scheduled', icon: <Flag className="w-4 h-4" />, tone: 'text-violet-600 bg-violet-50' },
    { label: 'In progress', value: summary.byStatus.inprogress, sub: `${summary.byStatus.planned} planned`, icon: <CalendarClock className="w-4 h-4" />, tone: 'text-teal-600 bg-teal-50' },
    { label: 'Needs attention', value: summary.overdue + summary.byStatus.blocked + conflicts, sub: `${summary.overdue} late · ${summary.byStatus.blocked} blocked · ${conflicts} dependency`, icon: <AlertTriangle className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {tiles.map(t => (
          <div key={t.label} className="rounded-2xl border border-lira-border bg-lira-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-wider text-lira-muted">{t.label}</span>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.tone}`}>{t.icon}</span>
            </div>
            <div className="text-2xl font-semibold text-lira-text mt-1"><AnimatedValue value={t.value as string | number} /></div>
            <div className="text-2xs text-lira-muted truncate">{t.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-lira-border bg-lira-surface px-4 py-3">
        <div className="flex h-2.5 rounded-full overflow-hidden bg-lira-border/50">
          {STATUSES.map(s => summary.byStatus[s] > 0 && (
            <div key={s} style={{ width: `${(summary.byStatus[s] / total) * 100}%`, background: STATUS_META[s].color }} title={`${STATUS_META[s].label}: ${summary.byStatus[s]}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-2xs text-lira-muted">
          {STATUSES.map(s => (
            <span key={s} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].color }} />{STATUS_META[s].label} {summary.byStatus[s]}</span>
          ))}
        </div>
      </div>
    </>
  );
}
