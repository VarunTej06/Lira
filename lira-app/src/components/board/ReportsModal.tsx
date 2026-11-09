import React, { useState, useMemo } from 'react';
import { BarChart3, PieChart, CheckCircle2, Clock, TrendingUp, Award, Layers, Flame } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
  issues: Issue[];
}

interface Slice { key: string; label: string; count: number; color: string }

// Class names are written out in full so Tailwind can find them.
const STATUS_BARS = [
  { key: 'done', label: 'Done', color: 'bg-emerald-500', barBg: 'bg-emerald-100', text: 'text-emerald-700' },
  { key: 'inprogress', label: 'In Progress', color: 'bg-blue-600', barBg: 'bg-blue-100', text: 'text-blue-700' },
  { key: 'blocked', label: 'Blocked (flagged)', color: 'bg-red-500', barBg: 'bg-red-100', text: 'text-red-700' },
  { key: 'todo', label: 'To Do', color: 'bg-sky-500', barBg: 'bg-sky-100', text: 'text-sky-700' },
  { key: 'backlog', label: 'Backlog', color: 'bg-gray-400', barBg: 'bg-gray-200', text: 'text-gray-600' },
];
const PRIORITY_BARS = [
  { key: 'highest', label: 'Highest', color: 'bg-red-600', barBg: 'bg-red-100', text: 'text-lira-text' },
  { key: 'high', label: 'High', color: 'bg-amber-600', barBg: 'bg-amber-100', text: 'text-lira-text' },
  { key: 'medium', label: 'Medium', color: 'bg-yellow-500', barBg: 'bg-yellow-100', text: 'text-lira-text' },
  { key: 'low', label: 'Low', color: 'bg-emerald-500', barBg: 'bg-emerald-100', text: 'text-lira-text' },
  { key: 'lowest', label: 'Lowest', color: 'bg-cyan-500', barBg: 'bg-cyan-100', text: 'text-lira-text' },
];
// Donut colours (hex, drawn in SVG).
const STATUS_DONUT = [['done', 'Done', '#36B37E'], ['inprogress', 'In Progress', '#0052CC'], ['todo', 'To Do', '#4C9AFF'], ['backlog', 'Backlog', '#6B778C']] as const;
const PRIORITY_DONUT = [['highest', 'Highest', '#FF0000'], ['high', 'High', '#FF5630'], ['medium', 'Medium', '#FF8B00'], ['low', 'Low', '#36B37E'], ['lowest', 'Lowest', '#00B8D9']] as const;

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
const tally = (values: string[]) => values.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});

/** Donut slices: each one starts where the last one ended. */
function donutSlices(slices: Slice[], total: number) {
  let offset = 0;
  return slices.filter(s => s.count > 0).map(s => {
    const length = (s.count / total) * CIRCUMFERENCE;
    const slice = { ...s, strokeDasharray: `${length} ${CIRCUMFERENCE}`, strokeDashoffset: -offset };
    offset += length;
    return slice;
  });
}

function Kpi({ title, icon, value, valueClass, note, noteClass }: { title: string; icon: React.ReactNode; value: React.ReactNode; valueClass: string; note: string; noteClass: string }) {
  return (
    <div className="bg-white p-3.5 rounded-xl border border-lira-border shadow-xs">
      <div className="flex items-center justify-between text-lira-muted mb-1">
        <span className="text-[11px] font-bold uppercase tracking-wider">{title}</span>
        {icon}
      </div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className={`text-[11px] mt-0.5 ${noteClass}`}>{note}</div>
    </div>
  );
}

function BreakdownBars({ rows, counts, total }: { rows: typeof STATUS_BARS; counts: Record<string, number>; total: number }) {
  return (
    <div className="space-y-3.5">
      {rows.map(row => {
        const count = counts[row.key] ?? 0;
        const share = pct(count, total);
        return (
          <div key={row.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-lira-text">{row.label}</span>
              <span className="text-lira-muted"><strong className={row.text}>{count}</strong> ({share}%)</span>
            </div>
            <div className={`w-full h-3 rounded-full ${row.barBg} overflow-hidden`}>
              <div className={`h-full ${row.color} rounded-full transition-all duration-500`} style={{ width: `${share}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChartTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${active ? 'bg-lira-blue text-white shadow-xs' : 'text-lira-muted hover:text-lira-text hover:bg-gray-100'}`}
    >
      {icon}{children}
    </button>
  );
}

export const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose, space, issues }) => {
  const [chartType, setChartType] = useState<'status' | 'priority'>('status');

  const m = useMemo(() => {
    const total = issues.length;
    const byStatus: Record<string, number> = { ...tally(issues.map(i => i.status)), blocked: issues.filter(i => i.blocked).length };
    const byPriority = tally(issues.map(i => i.priority));
    const points = (list: Issue[]) => list.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
    const totalPoints = points(issues);
    const donePoints = points(issues.filter(i => i.status === 'done'));
    const done = byStatus.done ?? 0;
    return {
      total, byStatus, byPriority, totalPoints, donePoints,
      done, inProgress: byStatus.inprogress ?? 0,
      completionRate: pct(done, total), inFlightRate: pct(byStatus.inprogress ?? 0, total), pointsRate: pct(donePoints, totalPoints),
      critical: (byPriority.highest ?? 0) + (byPriority.high ?? 0),
    };
  }, [issues]);

  const slices = (rows: readonly (readonly [string, string, string])[], counts: Record<string, number>) =>
    donutSlices(rows.map(([key, label, color]) => ({ key, label, color, count: counts[key] ?? 0 })), m.total);
  const activeSegments = m.total === 0 ? [] : chartType === 'status' ? slices(STATUS_DONUT, m.byStatus) : slices(PRIORITY_DONUT, m.byPriority);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Reports & Analytics · ${space?.name || 'Workspace'}`} size="xl">
      <div className="flex flex-col h-[600px] text-lira-text overflow-hidden">
        <div className="p-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50/60 border-b border-lira-border flex-shrink-0">
          <Kpi title="Total Work" icon={<Layers className="w-4 h-4 text-lira-blue" />} value={m.total} valueClass="text-lira-text" note="items in space" noteClass="text-lira-muted" />
          <Kpi title="Done" icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} value={m.done} valueClass="text-emerald-600" note={`${m.completionRate}% completed`} noteClass="text-emerald-700 font-semibold" />
          <Kpi title="In Progress" icon={<Clock className="w-4 h-4 text-lira-blue" />} value={m.inProgress} valueClass="text-lira-blue" note={`${m.inFlightRate}% active in flight`} noteClass="text-blue-700 font-semibold" />
          <Kpi
            title="Story Points" icon={<Award className="w-4 h-4 text-purple-600" />} valueClass="text-purple-700"
            value={<>{m.donePoints} <span className="text-sm font-normal text-lira-muted">/ {m.totalPoints}</span></>}
            note={`${m.pointsRate}% points delivered`} noteClass="text-purple-700 font-semibold"
          />
        </div>

        <div className="flex items-center justify-between px-6 py-2 border-b border-lira-border bg-white flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <ChartTab active={chartType === 'status'} onClick={() => setChartType('status')} icon={<PieChart className="w-3.5 h-3.5" />}>Status Breakdown</ChartTab>
            <ChartTab active={chartType === 'priority'} onClick={() => setChartType('priority')} icon={<BarChart3 className="w-3.5 h-3.5" />}>Priority Distribution</ChartTab>
          </div>
          <div className="text-xs text-lira-muted flex items-center gap-2">
            {m.critical > 0 && (
              <span className="text-red-600 font-semibold flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[11px]">
                <Flame className="w-3 h-3 text-red-500" /> {m.critical} high priority
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-gray-50/50 rounded-2xl border border-lira-border">
            <h4 className="text-xs font-bold text-lira-muted uppercase tracking-wider mb-4">{chartType === 'status' ? 'Status Ratio Donut' : 'Priority Distribution'}</h4>
            {m.total === 0 ? (
              <div className="py-12 text-center text-lira-muted text-xs">No issues on board</div>
            ) : (
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={RADIUS} fill="transparent" stroke="#E2E8F0" strokeWidth="12" />
                  {activeSegments.map(seg => (
                    <circle
                      key={seg.key} cx="50" cy="50" r={RADIUS} fill="transparent" stroke={seg.color} strokeWidth="12"
                      strokeDasharray={seg.strokeDasharray} strokeDashoffset={seg.strokeDashoffset} strokeLinecap="round" className="transition-all duration-500"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-2xl font-extrabold text-lira-text leading-none">{chartType === 'status' ? `${m.completionRate}%` : m.total}</span>
                  <span className="text-[10px] text-lira-muted uppercase font-semibold mt-1">{chartType === 'status' ? 'Complete' : 'Total Items'}</span>
                </div>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3 mt-4 text-[11px]">
              {activeSegments.map(seg => (
                <div key={seg.key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-lira-text font-medium">{seg.label}:</span>
                  <span className="font-bold text-lira-text">{seg.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-7 flex flex-col justify-center space-y-4">
            <h4 className="text-xs font-bold text-lira-muted uppercase tracking-wider mb-1">Detailed Breakdown</h4>
            {chartType === 'status'
              ? <BreakdownBars rows={STATUS_BARS} counts={m.byStatus} total={m.total} />
              : <BreakdownBars rows={PRIORITY_BARS} counts={m.byPriority} total={m.total} />}

            <div className="p-3 bg-blue-50/50 border border-blue-200/70 rounded-xl text-xs text-blue-900 mt-2 flex items-start gap-2.5">
              <TrendingUp className="w-4 h-4 text-lira-blue flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Project Progress: </span>
                {m.completionRate >= 75
                  ? 'Excellent velocity! Over 75% of scheduled work items have been marked as done.'
                  : m.completionRate >= 40
                  ? 'Steady progression. Active tasks are transitioning smoothly through development.'
                  : 'Early sprint phase. Focus on clearing In Progress bottlenecks to increase velocity.'}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-lira-border bg-gray-50 flex items-center justify-between text-xs flex-shrink-0">
          <span className="text-lira-muted text-[11px]">Aggregated from {m.total} issues in {space?.name || 'current space'}</span>
          <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
};
