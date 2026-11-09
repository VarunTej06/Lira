import { issueLink } from '../../utils/links';
import React, { useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import type { Issue } from '../../types/issue';
import { CountUp, motion } from '../common/motion';
import { getSprintMeta, isSprintWork, issuesInSprint, sprintName } from '../../utils/sprintUtils';
import {
  buildReport, reportHtml, reportMarkdown, type BurnupPoint, type FlowPoint, type SprintReport as Report,
} from '../../utils/sprintReports';

interface SprintReportsProps {
  issues: Issue[];
  sprint: string;
  scope: 'all' | number;
  onIssueClick: (issue: Issue) => void;
}

const W = 440, H = 170, P = { l: 30, r: 8, t: 10, b: 22 };
const iw = W - P.l - P.r, ih = H - P.t - P.b;

const Axes: React.FC<{ max: number; days: number }> = ({ max, days }) => (
  <>
    {[0, 0.5, 1].map(f => {
      const y = P.t + ih - f * ih;
      return (
        <g key={f}>
          <line x1={P.l} x2={W - P.r} y1={y} y2={y} stroke="#DFE1E6" strokeWidth="1" />
          <text x={P.l - 4} y={y + 3} fontSize="9" textAnchor="end" fill="#6B778C">{Math.round(max * f)}</text>
        </g>
      );
    })}
    {[1, Math.ceil(days / 2), days].filter((d, i, a) => a.indexOf(d) === i).map(d => (
      <text key={d} x={P.l + ((d - 1) / Math.max(1, days - 1)) * iw} y={H - 6} fontSize="9" textAnchor="middle" fill="#6B778C">day {d}</text>
    ))}
  </>
);

const BurnupChart: React.FC<{ data: BurnupPoint[]; days: number }> = ({ data, days }) => {
  const max = Math.max(1, ...data.map(d => d.scope));
  const x = (d: number) => P.l + ((d - 1) / Math.max(1, days - 1)) * iw;
  const y = (v: number) => P.t + ih - (v / max) * ih;
  if (!data.length) return <p className="text-xs text-lira-muted py-10 text-center">The sprint has not started yet.</p>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" role="img" aria-label="Burnup chart: scope and completed work">
      <Axes max={max} days={days} />
      <motion.polyline points={data.map(d => `${x(d.day)},${y(d.scope)}`).join(' ')} fill="none" stroke="#97A0AF" strokeWidth="2" strokeDasharray="4 3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
      <motion.polyline points={data.map(d => `${x(d.day)},${y(d.done)}`).join(' ')} fill="none" stroke="#00875A" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeInOut', delay: 0.15 }} />
    </svg>
  );
};

const FLOW_COLORS = { done: '#36B37E', inprogress: '#4C9AFF', todo: '#B3BAC5', backlog: '#EBECF0' } as const;

const FlowChart: React.FC<{ data: FlowPoint[]; days: number }> = ({ data, days }) => {
  const max = Math.max(1, ...data.map(d => d.backlog + d.todo + d.inprogress + d.done));
  const x = (d: number) => P.l + ((d - 1) / Math.max(1, days - 1)) * iw;
  const y = (v: number) => P.t + ih - (v / max) * ih;
  if (!data.length) return <p className="text-xs text-lira-muted py-10 text-center">The sprint has not started yet.</p>;
  // stacked from the bottom: done, in progress, to do, backlog
  const layers = (['done', 'inprogress', 'todo', 'backlog'] as const).map((k, idx, arr) => {
    const below = (d: FlowPoint) => arr.slice(0, idx).reduce((a, s) => a + d[s], 0);
    const top = data.map(d => `${x(d.day)},${y(below(d) + d[k])}`);
    const bottom = [...data].reverse().map(d => `${x(d.day)},${y(below(d))}`);
    return { k, pts: [...top, ...bottom].join(' ') };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" role="img" aria-label="Cumulative flow chart">
      <Axes max={max} days={days} />
      <motion.g initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }} transition={{ duration: 1.1, ease: 'easeInOut' }}>
        {layers.map(l => <polygon key={l.k} points={l.pts} fill={FLOW_COLORS[l.k]} opacity="0.9" />)}
      </motion.g>
    </svg>
  );
};

const Tile: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({ label, value, sub }) => (
  <div className="border border-lira-border rounded-xl px-3 py-2 bg-white">
    <div className="text-xl font-semibold text-lira-text">{value}</div>
    <div className="text-[11px] text-lira-muted">{label}</div>
    {sub && <div className="text-[10px] text-lira-muted">{sub}</div>}
  </div>
);

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

const download = (name: string, text: string, mime: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Opens the printable report; the browser's print dialog can save it as a PDF. */
const printReport = (r: Report) => {
  const w = window.open('', '_blank', 'width=860,height=900');
  if (!w) return;
  w.document.open();
  w.document.write(reportHtml(r));
  w.document.close();
  w.focus();
  w.onload = () => w.print();
  setTimeout(() => { try { w.print(); } catch { /* window closed */ } }, 400);
};

/** Burnup, cumulative flow, scope changes, lead and cycle time for one sprint, with Markdown and PDF export. */
export const SprintReports: React.FC<SprintReportsProps> = ({ issues, sprint, scope, onIssueClick }) => {
  const report = useMemo(() => {
    const scoped = issues.filter(i => isSprintWork(i) && (scope === 'all' || i.spaceId === scope));
    return buildReport(issuesInSprint(scoped, sprint), issues, sprint, scope);
  }, [issues, sprint, scope]);
  const { stats, times, changes, burnup, flow } = report;
  const meta = getSprintMeta(scope, sprint);
  const file = `${sprintName(sprint).replace(/[^\w]+/g, '-').toLowerCase()}-report`;
  const added = changes.filter(c => c.kind === 'added').length;
  const gone = changes.length - added;

  return (
    <div className="space-y-4" data-testid="sprint-reports">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-lira-text">Report · {sprintName(sprint)}</h3>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => download(`${file}.md`, reportMarkdown(report), 'text/markdown')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-lira-border bg-white hover:bg-gray-50 text-lira-text cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Markdown
          </button>
          <button
            onClick={() => printReport(report)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-lira-border bg-white hover:bg-gray-50 text-lira-text cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Done" value={<><CountUp value={stats.done} />/{stats.total}</>} sub={<CountUp value={stats.percent} suffix="%" />} />
        <Tile label="Points done" value={<><CountUp value={stats.donePoints} />/{stats.points}</>} sub={meta.capacity !== undefined ? `capacity ${meta.capacity}` : undefined} />
        <Tile label="Lead time (average)" value={times.lead.n ? days(times.lead.avg) : '—'} sub={times.lead.n ? `median ${times.lead.median} · ${times.lead.n} done` : 'no finished tickets'} />
        <Tile label="Cycle time (average)" value={times.cycle.n ? days(times.cycle.avg) : '—'} sub={times.cycle.n ? `median ${times.cycle.median} · ${times.cycle.n} tracked` : 'starts when a ticket enters In Progress'} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-lira-border rounded-xl p-4">
          <h4 className="text-sm font-semibold text-lira-text mb-1">Burnup</h4>
          <BurnupChart data={burnup} days={report.days} />
          <div className="flex gap-3 text-[10px] text-lira-muted">
            <span><span className="inline-block w-3 border-t-2 border-dashed border-gray-400 mr-1 align-middle" />Scope</span>
            <span><span className="inline-block w-3 border-t-2 mr-1 align-middle" style={{ borderColor: '#00875A' }} />Done</span>
          </div>
        </div>
        <div className="bg-white border border-lira-border rounded-xl p-4">
          <h4 className="text-sm font-semibold text-lira-text mb-1">Cumulative flow</h4>
          <FlowChart data={flow} days={report.days} />
          <div className="flex flex-wrap gap-3 text-[10px] text-lira-muted">
            {(['done', 'inprogress', 'todo', 'backlog'] as const).map(k => (
              <span key={k}><span className="inline-block w-2 h-2 mr-1 rounded-sm" style={{ backgroundColor: FLOW_COLORS[k] }} />{{ done: 'Done', inprogress: 'In Progress', todo: 'To Do', backlog: 'Backlog' }[k]}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-lira-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-lira-border flex items-center gap-2">
          <h4 className="text-sm font-semibold text-lira-text">Scope changes</h4>
          <span className="text-xs text-lira-muted">{added} added · {gone} taken out, after the first day</span>
        </div>
        {changes.length === 0 ? (
          <p className="text-xs text-lira-muted px-4 py-6 text-center">No tickets were added or removed after the first day.</p>
        ) : (
          <ul>
            {changes.map((c, i) => (
              <li key={`${c.issue.id}-${i}`} className="flex items-center gap-3 px-4 py-2 border-b border-lira-border last:border-0 text-sm hover:bg-gray-50 cursor-pointer" onClick={() => onIssueClick(c.issue)} {...issueLink(c.issue)}>
                <span className="text-xs text-lira-muted w-14 flex-shrink-0">{c.at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded flex-shrink-0 ${c.kind === 'added' ? 'bg-amber-100 text-amber-800' : c.kind === 'carried' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                  {c.kind === 'added' ? 'Added' : c.kind === 'carried' ? 'Carried over' : 'Removed'}
                </span>
                <span className="text-xs text-lira-muted flex-shrink-0">{c.issue.key}</span>
                <span className="truncate text-lira-text">{c.issue.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
