import type { ReactNode } from 'react';
import { CountUp, motion } from '../../common/motion';
import { statusLabel } from '../../../utils/status';
import { PriorityIcon, TypeIcon } from '../../common/Icons';
import { KanbanSquare, Settings, Plus, Layers, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { Button } from '../../common/Button';
import { ISSUE_TYPE_CONFIG } from '../../../types/issue';
import { formatRelativeDate } from '../../../utils/dateUtils';
import { getStatusBadgeClass } from './badges';
import type { DetailCtx } from './types';

type Stats = DetailCtx['stats'];

// Class names are written out in full (not built from a colour name) so Tailwind can find them.
const STAT_CARDS = [
  { title: 'Total Issues', note: 'In this project scope', value: (s: Stats) => s.total, valueClass: 'text-lira-text', iconBox: 'bg-blue-50 text-lira-blue', Icon: Layers },
  { title: 'Open Issues', note: 'Backlog + Todo + In Progress', value: (s: Stats) => s.open, valueClass: 'text-amber-600', iconBox: 'bg-amber-50 text-amber-600', Icon: AlertCircle },
  { title: 'Completed Issues', note: 'Done & verified', value: (s: Stats) => s.done, valueClass: 'text-emerald-600', iconBox: 'bg-emerald-50 text-emerald-600', Icon: CheckCircle2 },
  { title: 'Completion %', note: null, value: (s: Stats) => s.percent, suffix: '%', valueClass: 'text-purple-600', iconBox: 'bg-purple-50 text-purple-600', Icon: TrendingUp },
] as const;

/** The stacked bar, in the order the work flows. */
const BAR_SEGMENTS = [
  { key: 'backlog', label: 'Backlog', color: 'bg-slate-400' },
  { key: 'todo', label: 'To Do', color: 'bg-blue-500' },
  { key: 'inProgress', label: 'In Progress', color: 'bg-amber-500' },
  { key: 'done', label: 'Done', color: 'bg-emerald-500' },
] as const;

/** The legend under the bar. Blocked is a flag on a ticket, so it has a legend entry but no bar segment. */
const LEGEND = [
  { key: 'backlog', label: 'Backlog', box: 'bg-gray-50 border-gray-100', dot: 'bg-slate-400', value: 'text-lira-text' },
  { key: 'todo', label: 'To Do', box: 'bg-blue-50/60 border-blue-100', dot: 'bg-blue-500', value: 'text-lira-blue' },
  { key: 'blocked', label: 'Blocked (flagged)', box: 'bg-red-50/60 border-red-100', dot: 'bg-red-500', value: 'text-red-700' },
  { key: 'inProgress', label: 'In Progress', box: 'bg-amber-50/60 border-amber-100', dot: 'bg-amber-500', value: 'text-amber-700' },
  { key: 'done', label: 'Done', box: 'bg-emerald-50/60 border-emerald-100', dot: 'bg-emerald-500', value: 'text-emerald-700' },
] as const;

const PRIORITIES = [
  { key: 'highest', label: 'Highest', box: 'border-red-200 bg-red-50/50', title: 'text-red-700', count: 'text-red-800', pct: 'text-red-600' },
  { key: 'high', label: 'High', box: 'border-orange-200 bg-orange-50/50', title: 'text-orange-700', count: 'text-orange-800', pct: 'text-orange-600' },
  { key: 'medium', label: 'Medium', box: 'border-amber-200 bg-amber-50/50', title: 'text-amber-700', count: 'text-amber-800', pct: 'text-amber-600' },
  { key: 'low', label: 'Low', box: 'border-emerald-200 bg-emerald-50/50', title: 'text-emerald-700', count: 'text-emerald-800', pct: 'text-emerald-600' },
  { key: 'lowest', label: 'Lowest', box: 'border-slate-200 bg-slate-50/60', title: 'text-slate-700', count: 'text-slate-800', pct: 'text-slate-600' },
] as const;

const percentOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

function Card({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-lira-border p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-lira-text">{title}</h3>
          <p className="text-xs text-lira-muted mt-0.5">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const EmptyNote = ({ children }: { children: ReactNode }) => (
  <div className="py-8 text-center text-xs text-lira-muted bg-gray-50 rounded-xl border border-dashed border-gray-200">{children}</div>
);

export function OverviewTab(ctx: DetailCtx) {
  const { onIssueClick, onAddIssue, stats, priorityCounts, recentIssues, setActiveTab } = ctx;
  const counts = stats as unknown as Record<string, number>;
  const priorities = priorityCounts as unknown as Record<string, number>;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-lira-border p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-lira-muted">Project Workspace Actions</h3>
          <p className="text-xs text-lira-text mt-0.5">Jump directly to issue authoring, Kanban execution, or project schema settings.</p>
        </div>
        <div className="flex items-center gap-2.5">
          {onAddIssue && <Button variant="primary" size="sm" onClick={() => onAddIssue('todo')} icon={<Plus className="w-4 h-4" />}>Create Issue</Button>}
          <Button variant="secondary" size="sm" onClick={() => setActiveTab('board')} icon={<KanbanSquare className="w-4 h-4" />}>View Board</Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab('settings')} icon={<Settings className="w-4 h-4" />}>Open Settings</Button>
        </div>
      </div>

      {/* At-a-glance numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ title, note, value, valueClass, iconBox, Icon, ...rest }) => (
          <div key={title} className="bg-white rounded-xl border border-lira-border p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-lira-muted uppercase tracking-wider">{title}</p>
              <h4 className={`text-2xl font-black mt-1 ${valueClass}`}><CountUp value={value(stats)} suffix={'suffix' in rest ? rest.suffix : undefined} /></h4>
              <p className="text-[11px] text-lira-muted mt-0.5">{note ?? <><CountUp value={stats.done} /> of {stats.total} resolved</>}</p>
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBox}`}><Icon className="w-5 h-5" /></div>
          </div>
        ))}
      </div>

      {/* Status distribution */}
      <Card
        title="Status Distribution"
        subtitle="Proportional workflow breakdown across Backlog, To Do, In Progress, and Done stages."
        action={<span className="text-xs font-semibold text-lira-muted"><CountUp value={stats.total} suffix=" Items" /></span>}
      >
        {stats.total === 0 ? (
          <EmptyNote>No issues recorded yet for this project. Click <strong>Create Issue</strong> above to start.</EmptyNote>
        ) : (
          <div className="space-y-3.5">
            <div className="h-7 w-full bg-gray-100 rounded-xl overflow-hidden flex shadow-inner border border-gray-200/80">
              {BAR_SEGMENTS.filter(seg => counts[seg.key] > 0).map(seg => {
                const pct = percentOf(counts[seg.key], stats.total);
                const share = counts[seg.key] / stats.total;
                return (
                  <motion.div
                    key={seg.key}
                    initial={{ width: 0 }}
                    animate={{ width: `${share * 100}%` }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: BAR_SEGMENTS.findIndex(s => s.key === seg.key) * 0.2 }}
                    className={`${seg.color} flex items-center justify-center text-white text-[11px] font-bold px-1 relative group cursor-pointer`}
                    title={`${seg.label}: ${counts[seg.key]} (${pct}%)`}
                  >
                    {share >= 0.1 && <span>{pct}%</span>}
                  </motion.div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
              {LEGEND.map(item => (
                <div key={item.key} className={`flex items-center gap-2 p-2.5 rounded-lg border ${item.box}`}>
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${item.dot}`} />
                  <div className="text-xs">
                    <span className="text-lira-muted font-medium">{item.label}: </span>
                    <span className={`font-bold ${item.value}`}><CountUp value={counts[item.key]} /></span>
                    <span className="text-[10px] text-lira-muted ml-1">(<CountUp value={percentOf(counts[item.key], stats.total)} suffix="%" />)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Priority breakdown */}
      <Card title="Priority Breakdown" subtitle="Issue volume classified by operational severity">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {PRIORITIES.map(p => (
            <div key={p.key} className={`p-3 rounded-xl border flex flex-col justify-between ${p.box}`}>
              <span className={`text-xs font-semibold flex items-center gap-1 ${p.title}`}><PriorityIcon priority={p.key} /> {p.label}</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-xl font-bold ${p.count}`}><CountUp value={priorities[p.key]} /></span>
                <span className={`text-[10px] font-medium ${p.pct}`}><CountUp value={percentOf(priorities[p.key], stats.total)} suffix="%" /></span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent activity */}
      <Card
        title="Recent Activity"
        subtitle="Last 5 recently modified issues in this project"
        action={<button onClick={() => setActiveTab('tickets')} className="text-xs font-semibold text-lira-blue hover:underline cursor-pointer">View all ({stats.total}) →</button>}
      >
        {recentIssues.length === 0 ? (
          <EmptyNote>No issues available to display.</EmptyNote>
        ) : (
          <div className="divide-y divide-gray-100 border border-lira-border rounded-xl overflow-hidden">
            {recentIssues.map(issue => (
              <div key={issue.id || issue.key} onClick={() => onIssueClick?.(issue)} className="p-3.5 hover:bg-blue-50/50 transition-colors cursor-pointer flex items-center justify-between gap-3 group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-base" title={ISSUE_TYPE_CONFIG[issue.type]?.label || issue.type}><TypeIcon type={issue.type} className="w-4 h-4" /></span>
                  <span className="font-mono text-xs font-bold text-lira-blue group-hover:underline whitespace-nowrap">{issue.key}</span>
                  <span className="text-xs text-lira-text font-medium truncate group-hover:text-lira-blue transition-colors">{issue.title}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border capitalize ${getStatusBadgeClass(issue.status)}`}>{statusLabel(issue.status)}</span>
                  <span className="text-xs text-lira-muted whitespace-nowrap">{formatRelativeDate(issue.updatedAt || issue.createdAt) || 'Recently'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
