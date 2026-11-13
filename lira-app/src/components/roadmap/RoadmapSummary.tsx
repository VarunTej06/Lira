import type { ReactNode } from 'react';
import { AlertTriangle, CalendarClock, Flag, Target } from 'lucide-react';
import { AnimatedValue } from '../common/motion';
import { STATUS_META, summarize, type RoadmapStatus } from '../../utils/roadmapUtils';

type Summary = ReturnType<typeof summarize>;
const STATUSES = Object.keys(STATUS_META) as RoadmapStatus[];

/** One strip above a roadmap: four numbers and the stacked status bar. It is kept low so the calendar starts high on the page. `conflicts` counts dependency problems. */
export function RoadmapSummary({ summary, conflicts }: { summary: Summary; conflicts: number }) {
  const total = Math.max(1, summary.total);
  const tiles: { label: string; value: ReactNode; sub: string; icon: ReactNode; tone: string }[] = [
    { label: 'Overall progress', value: `${summary.percent}%`, sub: `${summary.byStatus.done} of ${summary.total} epics done`, icon: <Target className="w-4 h-4" />, tone: 'text-lira-blue bg-lira-blue-light' },
    { label: 'Next milestone', value: summary.nextMilestone ? (summary.daysToNextMilestone === 0 ? 'Today' : `${summary.daysToNextMilestone}d`) : '—', sub: summary.nextMilestone?.title || 'None scheduled', icon: <Flag className="w-4 h-4" />, tone: 'text-violet-600 bg-violet-50' },
    { label: 'In progress', value: summary.byStatus.inprogress, sub: `${summary.byStatus.planned} planned`, icon: <CalendarClock className="w-4 h-4" />, tone: 'text-teal-600 bg-teal-50' },
    { label: 'Needs attention', value: summary.overdue + summary.byStatus.blocked + conflicts, sub: `${summary.overdue} late · ${summary.byStatus.blocked} blocked · ${conflicts} dependency`, icon: <AlertTriangle className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="rounded-2xl border border-lira-border bg-lira-surface px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2" data-testid="roadmap-summary">
      {tiles.map(t => (
        <div key={t.label} className="flex items-center gap-2 min-w-0" title={t.sub}>
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${t.tone}`}>{t.icon}</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-lira-text leading-tight"><AnimatedValue value={t.value as string | number} /></div>
            <div className="text-3xs font-semibold uppercase tracking-wider text-lira-muted leading-tight">{t.label}</div>
          </div>
        </div>
      ))}
      <div className="flex-1 min-w-[240px]">
        <div className="flex h-2 rounded-full overflow-hidden bg-lira-border/50">
          {STATUSES.map(s => summary.byStatus[s] > 0 && (
            <div key={s} style={{ width: `${(summary.byStatus[s] / total) * 100}%`, background: STATUS_META[s].color }} title={`${STATUS_META[s].label}: ${summary.byStatus[s]}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-3xs text-lira-muted">
          {STATUSES.map(s => (
            <span key={s} className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_META[s].color }} />{STATUS_META[s].label} {summary.byStatus[s]}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
