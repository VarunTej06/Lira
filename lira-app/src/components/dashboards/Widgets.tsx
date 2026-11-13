import React from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Ban, Minus, Flame } from 'lucide-react';
import type { Issue } from '../../types/issue';
import { CountUp } from '../common/motion';
import { TypeIcon } from '../common/Icons';
import { STATUS_META as ROADMAP_STATUS } from '../../utils/roadmap/types';
import { issueLink } from '../../utils/links';
import type { WidgetData } from '../../utils/dashboards/data';
import type { DashboardWidget } from '../../utils/dashboards/types';
import { METRICS, type Group } from '../../utils/dashboards/metrics';
import { AreaStack, BarRows, Columns, Donut, Empty, LineChart } from './charts';
import { PALETTE } from '../../theme/palette';

export interface WidgetActions {
  /** Open a list of tickets (the ones behind a bar, a slice, a number). */
  onDrill: (title: string, issues: Issue[]) => void;
  onOpenIssue: (issue: Issue) => void;
  /** The tickets behind a stat card. */
  statIssues: (widget: DashboardWidget) => Issue[];
}

const TONE: Record<string, string> = { bad: 'text-red-600 bg-red-50', warn: 'text-amber-700 bg-amber-50', good: 'text-emerald-700 bg-emerald-50', neutral: 'text-lira-muted bg-gray-100' };

const IssueRow: React.FC<{ issue: Issue; note?: string; tone?: string; onOpen: (i: Issue) => void }> = ({ issue, note, tone = 'neutral', onOpen }) => (
  <li>
    <button type="button" onClick={() => onOpen(issue)} {...issueLink(issue)} className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-md text-left hover:bg-gray-50 cursor-pointer">
      <TypeIcon type={issue.type} className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="font-mono text-2xs font-semibold text-lira-muted flex-shrink-0 w-[68px]">{issue.key}</span>
      <span className="flex-1 min-w-0 text-xs text-lira-text truncate">{issue.title}</span>
      {issue.blocked && <Ban className="w-3 h-3 text-red-500 flex-shrink-0" aria-label="Blocked" />}
      {note && <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-3xs font-semibold ${TONE[tone] ?? TONE.neutral}`}>{note}</span>}
    </button>
  </li>
);

const Trend: React.FC<{ delta?: number; better: 'up' | 'down' | null }> = ({ delta, better }) => {
  if (delta === undefined) return null;
  if (delta === 0) return <span className="flex items-center gap-1 text-xs text-lira-muted"><Minus className="w-3.5 h-3.5" /> no change since last week</span>;
  const up = delta > 0;
  const good = better === null ? null : (better === 'up') === up;
  const colour = good === null ? 'text-lira-muted' : good ? 'text-emerald-600' : 'text-red-600';
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${colour}`} data-testid="trend">
      {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
      {up ? '+' : ''}{delta} vs last week
    </span>
  );
};

interface BodyProps<K extends WidgetData['kind']> {
  widget: DashboardWidget;
  data: Extract<WidgetData, { kind: K }>;
  actions: WidgetActions;
  /** Open the tickets behind one bar or slice. */
  drill: (g: Group) => void;
  navigate: NavigateFunction;
}

/** What each kind of widget draws. */
const BODIES: { [K in WidgetData['kind']]: (props: BodyProps<K>) => React.ReactElement } = {
  stat: ({ widget, data, actions }) => {
    const r = data.result;
    const clickable = actions.statIssues(widget).length > 0;
    return (
      <button
        type="button" disabled={!clickable}
        onClick={() => actions.onDrill(widget.title, actions.statIssues(widget))}
        className="h-full w-full flex flex-col justify-center text-left disabled:cursor-default cursor-pointer"
        title={clickable ? 'Click to see the tickets' : undefined}
        data-testid={`stat-${widget.config.metric}`}
      >
        <span className="text-3xl font-bold text-lira-text leading-tight tabular-nums"><CountUp value={r.value} suffix={r.suffix} /></span>
        <span className="mt-1"><Trend delta={r.trend} better={r.meta.better} /></span>
        <span className="text-2xs text-lira-muted mt-1 truncate">{METRICS[widget.config.metric ?? 'open'].description}</span>
      </button>
    );
  
  },
  groups: ({ widget, data, drill }) => {
    return widget.type === 'donut'
      ? <Donut groups={data.groups} total={data.total} measure={data.measure} onPick={drill} />
      : <BarRows groups={data.groups} measure={data.measure} onPick={drill} />;
  },
  series: ({ widget, data }) => {
    const labels = data.points.map(p => p.label);
    if (widget.type === 'throughput') return <Columns labels={labels} values={data.points.map(p => p.done)} color={PALETTE.successSoft} ariaLabel="Tickets finished each week" average />;
    return (
      <LineChart
        ariaLabel="Created, finished and open tickets each week" labels={labels}
        series={[
          { name: 'Created', color: PALETTE.link, values: data.points.map(p => p.created) },
          { name: 'Finished', color: PALETTE.successSoft, values: data.points.map(p => p.done) },
          { name: 'Still open', color: PALETTE.warning, values: data.points.map(p => p.open), dashed: true },
        ]}
      />
    );
  
  },
  burn: ({ widget, data }) => {
    const pts = data.points;
    if (!pts.length) return <Empty text="The sprint has not started yet." />;
    const byPoints = pts.some(p => p.scopePoints > 0);
    const scope = pts.map(p => (byPoints ? p.scopePoints : p.scope));
    const done = pts.map(p => (byPoints ? p.donePoints : p.done));
    const labels = pts.map(p => `D${p.day}`);
    if (widget.type === 'burnup') {
      return <LineChart ariaLabel="Sprint burnup" labels={labels} series={[{ name: byPoints ? 'Scope (points)' : 'Scope (tickets)', color: PALETTE.textMuted, values: scope, dashed: true }, { name: 'Done', color: PALETTE.successSoft, values: done }]} />;
    }
    const remaining = pts.map((_, i) => scope[i] - done[i]);
    const start = scope[0] ?? 0;
    const ideal = pts.map((_, i) => Math.max(0, Math.round(start - (start * i) / Math.max(1, pts.length - 1))));
    return <LineChart ariaLabel="Sprint burndown" labels={labels} series={[{ name: 'Ideal', color: PALETTE.textFaint, values: ideal, dashed: true }, { name: byPoints ? 'Points left' : 'Tickets left', color: PALETTE.criticalDeep, values: remaining }]} />;
  
  },
  cfd: ({ data }) => {
    const pts = data.points;
    return (
      <AreaStack
        ariaLabel="Cumulative flow" labels={pts.map(p => `D${p.day}`)}
        layers={[
          { name: 'Done', color: PALETTE.success, values: pts.map(p => p.done) },
          { name: 'In progress', color: '#4C9AFF', values: pts.map(p => p.inprogress) },
          { name: 'To do', color: '#B3BAC5', values: pts.map(p => p.todo) },
          { name: 'Backlog', color: '#EBECF0', values: pts.map(p => p.backlog) },
        ]}
      />
    );
  
  },
  rows: ({ widget, data, actions }) => {
    return data.rows.length === 0 ? <Empty text="Nothing here. That is good news." /> : (
      <div className="flex flex-col h-full">
        <ul className="space-y-0.5" data-testid="issue-list">{data.rows.map(r => <IssueRow key={r.issue.id ?? r.issue.key} issue={r.issue} note={r.note} tone={r.tone} onOpen={actions.onOpenIssue} />)}</ul>
        {data.total > data.rows.length && (
          <button type="button" className="mt-auto pt-2 text-xs text-lira-blue hover:underline text-left cursor-pointer" onClick={() => actions.onDrill(widget.title, data.all)}>
            and {data.total - data.rows.length} more
          </button>
        )}
      </div>
    );
  },
  blocked: ({ data, actions }) => {
    return data.rows.length === 0 ? <Empty text="Nothing is blocked." /> : (
      <ul className="space-y-1" data-testid="blocked-list">
        {data.rows.map(r => (
          <li key={r.issue.id} className="rounded-lg border border-red-100 bg-red-50/40 px-2 py-1.5">
            <button type="button" onClick={() => actions.onOpenIssue(r.issue)} {...issueLink(r.issue)} className="w-full flex items-center gap-2 text-left cursor-pointer">
              <TypeIcon type={r.issue.type} className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-mono text-2xs font-semibold text-lira-muted flex-shrink-0">{r.issue.key}</span>
              <span className="flex-1 min-w-0 text-xs text-lira-text truncate">{r.issue.title}</span>
              <span className="text-3xs font-semibold text-red-700 flex-shrink-0">{r.days}d</span>
            </button>
            <div className="flex flex-wrap items-center gap-1 pl-5 pt-1">
              <span className="text-3xs text-lira-muted">blocked by</span>
              {r.blockers.length === 0 && <span className="text-3xs text-lira-muted italic">no ticket linked</span>}
              {r.blockers.map(b => (
                <button key={b.id} type="button" onClick={() => actions.onOpenIssue(b)} {...issueLink(b)} className="px-1.5 py-0.5 rounded bg-white border border-red-200 text-3xs font-mono font-semibold text-lira-text hover:text-lira-blue cursor-pointer" title={b.title}>{b.key}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    );
  },
  progress: ({ data, actions, navigate }) => {
    return data.rows.length === 0 ? <Empty /> : (
      <ul className="space-y-2.5" data-testid="progress-list">
        {data.rows.map(r => (
          <li key={r.key}>
            <button type="button" onClick={() => (r.href ? navigate(r.href) : actions.onDrill(r.label, r.issues))} className="w-full text-left cursor-pointer group" title={`${r.done} of ${r.total} done`}>
              <div className="flex items-baseline justify-between gap-2 text-xs mb-0.5">
                <span className="truncate text-lira-text group-hover:text-lira-blue">{r.label}</span>
                <span className="tabular-nums text-lira-muted flex-shrink-0">{r.done}/{r.total} <span className="font-semibold text-lira-text">{r.percent}%</span></span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${r.percent}%`, backgroundColor: r.color }} /></div>
            </button>
          </li>
        ))}
      </ul>
    );
  },
  workload: ({ data, actions }) => {
    if (data.rows.length === 0) return <Empty />;
    const max = Math.max(1, ...data.rows.map(r => r.points || r.open));
    return (
      <div className="overflow-x-auto -mx-1" data-testid="workload">
        <table className="w-full text-xs min-w-[460px]">
          <thead>
            <tr className="text-left text-3xs uppercase tracking-wide text-lira-muted">
              <th className="px-1 py-1 font-semibold">Person</th><th className="px-1 py-1 font-semibold w-[34%]">Points</th>
              <th className="px-1 py-1 font-semibold text-right">Open</th><th className="px-1 py-1 font-semibold text-right">Doing</th><th className="px-1 py-1 font-semibold text-right">Blocked</th><th className="px-1 py-1 font-semibold text-right">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map(r => (
              <tr key={r.name} className="border-t border-lira-border hover:bg-gray-50 cursor-pointer" onClick={() => actions.onDrill(`${r.name}: open tickets`, r.issues)}>
                <td className="px-1 py-1.5 text-lira-text">
                  <span className="flex items-center gap-1.5">{r.name}{r.overloaded && <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-50 text-red-600 text-3xs font-semibold" title="Carrying much more than the rest of the team"><Flame className="w-3 h-3" />overloaded</span>}</span>
                </td>
                <td className="px-1 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full ${r.overloaded ? 'bg-red-500' : 'bg-lira-blue'}`} style={{ width: `${((r.points || r.open) / max) * 100}%` }} /></div>
                    <span className="tabular-nums w-8 text-right text-lira-text">{r.points}</span>
                  </div>
                </td>
                <td className="px-1 py-1.5 text-right tabular-nums">{r.open}</td>
                <td className="px-1 py-1.5 text-right tabular-nums">{r.inProgress}</td>
                <td className={`px-1 py-1.5 text-right tabular-nums ${r.blocked ? 'text-red-600 font-semibold' : 'text-lira-muted'}`}>{r.blocked}</td>
                <td className={`px-1 py-1.5 text-right tabular-nums ${r.overdue ? 'text-red-600 font-semibold' : 'text-lira-muted'}`}>{r.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  
  },
  due: ({ data, actions }) => {
    const max = Math.max(1, ...data.days.map(d => d.count));
    return (
      <ol className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 h-full items-end" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }} data-testid="due-strip">
        {data.days.map(d => (
          <li key={d.date.toISOString()} className="flex flex-col items-center justify-end h-full min-w-0">
            <button type="button" disabled={!d.count} onClick={() => actions.onDrill(`Due ${d.date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}`, d.issues)} className="w-full flex flex-col items-center justify-end flex-1 cursor-pointer disabled:cursor-default" title={`${d.count} due`}>
              <span className="text-3xs font-semibold text-lira-text">{d.count || ''}</span>
              <span className="w-full rounded-t bg-lira-blue/80" style={{ height: `${d.count ? 14 + (d.count / max) * 46 : 3}px`, opacity: d.count ? 1 : 0.25 }} />
            </button>
            <span className={`text-4xs mt-1 ${d.date.getDay() === 0 || d.date.getDay() === 6 ? 'text-lira-muted' : 'text-lira-muted'}`}>{d.date.getDate()}</span>
          </li>
        ))}
      </ol>
    );
  
  },
  roadmap: ({ data, navigate }) => {
    return data.rows.length === 0 ? <Empty text="No roadmap items yet." /> : (
      <ul className="space-y-1.5" data-testid="roadmap-list">
        {data.rows.map((r, i) => {
          const st = ROADMAP_STATUS[r.status as keyof typeof ROADMAP_STATUS];
          return (
            <li key={`${r.roadmapId}-${i}`}>
              <button type="button" onClick={() => navigate(`/roadmaps/${encodeURIComponent(r.roadmapId)}`)} className="w-full flex items-center gap-2 text-left px-1.5 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer" title={r.roadmap}>
                <span className="px-1.5 py-0.5 rounded text-3xs font-semibold flex-shrink-0" style={{ color: st?.color, backgroundColor: `${st?.color}1A` }}>{st?.label ?? r.status}</span>
                <span className="flex-1 min-w-0 text-xs text-lira-text truncate">{r.title}</span>
                <span className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden flex-shrink-0"><span className="block h-full rounded-full bg-lira-blue" style={{ width: `${r.progress}%` }} /></span>
                <span className="text-3xs tabular-nums text-lira-muted w-8 text-right flex-shrink-0">{r.progress}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  },
  summary: ({ data }) => {
    return (
      <ul className="space-y-1.5 text-sm text-lira-text leading-relaxed" data-testid="summary-lines">
        {data.lines.map((l, i) => <li key={i} className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-lira-blue flex-shrink-0" />{l}</li>)}
      </ul>
    );
  },
};

/** The inside of a widget (the card around it is drawn by the dashboard). */
export const WidgetBody: React.FC<{ widget: DashboardWidget; data: WidgetData; actions: WidgetActions }> = ({ widget, data, actions }) => {
  const navigate = useNavigate();
  const drill = (g: Group) => actions.onDrill(`${widget.title}: ${g.label}`, g.issues);
  const render = BODIES[data.kind] as (props: BodyProps<WidgetData['kind']>) => React.ReactElement;
  return render({ widget, data, actions, drill, navigate });
};
