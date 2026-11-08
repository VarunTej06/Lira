import { sprintLink } from '../../utils/links';
import React, { useMemo } from 'react';
import { CalendarClock, Plus, AlertTriangle, TrendingUp, Layers, Target, ArrowRight } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import {
  allSprintKeys, currentSprintKey, daysLeft, getIssueSprint, getSprintMeta, isDone, issuesInSprint,
  sprintDays, sprintEnd, sprintKindLabel, sprintLabel, sprintName, sprintPhase, sprintStart, sprintStats,
} from '../../utils/sprintUtils';
import { PhaseBadge } from './sprintParts';
import { AnimatedValue, CountUp, GrowBar } from '../common/motion';

interface SprintsOverviewProps {
  spaces: Space[];
  issues: Issue[];
  onOpenSprint: (key: string) => void;
  onCreateSprint: () => void;
  onOpenAllTickets: () => void;
}

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** All sprints at a glance: headline metrics, a sortable-by-time table, velocity and a per-space matrix. */
export const SprintsOverview: React.FC<SprintsOverviewProps> = ({ spaces, issues, onOpenSprint, onCreateSprint, onOpenAllTickets }) => {
  const work = useMemo(() => issues.filter(i => i.type !== 'epic'), [issues]);
  const keys = useMemo(() => allSprintKeys(work), [work]);
  const cur = currentSprintKey();

  const rows = useMemo(() => [...keys].reverse().map(k => {
    const list = issuesInSprint(work, k);
    return { key: k, list, stats: sprintStats(list), phase: sprintPhase(k), goal: getSprintMeta('all', k).goal };
  }), [keys, work]);

  const active = rows.find(r => r.key === cur);
  const closed = rows.filter(r => r.phase === 'past' && r.stats.total > 0);
  const avgCompletion = closed.length ? Math.round(closed.reduce((a, r) => a + r.stats.percent, 0) / closed.length) : 0;
  const avgVelocity = closed.length ? Math.round(closed.reduce((a, r) => a + r.stats.done, 0) / closed.length) : 0;
  const stranded = work.filter(i => !isDone(i) && sprintPhase(getIssueSprint(i)) === 'past').length;
  // sprints that ended with unfinished work and were never closed: the month-end "carry them over?" prompt
  const toClose = rows.filter(r => r.phase === 'past' && !getSprintMeta('all', r.key).completedAt && r.stats.open > 0).slice(0, 3);
  const carried = work.filter(i => (i.sprintHistory || []).length > 0).length;

  const lastSix = rows.filter(r => r.phase !== 'upcoming').slice(0, 6).reverse();
  const maxTotal = Math.max(1, ...lastSix.map(r => r.stats.total));

  const tiles = [
    { label: 'Active sprint', value: active ? `${active.stats.percent}%` : '—', sub: active ? `${active.stats.done}/${active.stats.total} done · ${daysLeft(cur)}d left` : 'No tickets', icon: <CalendarClock className="w-4 h-4" />, tone: 'text-teal-600 bg-teal-50' },
    { label: 'Avg completion', value: `${avgCompletion}%`, sub: `over ${closed.length} finished sprints`, icon: <Target className="w-4 h-4" />, tone: 'text-lira-blue bg-blue-50' },
    { label: 'Avg velocity', value: avgVelocity, sub: 'tickets done / sprint', icon: <TrendingUp className="w-4 h-4" />, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Carried over', value: carried, sub: `${stranded} stuck in ended sprints`, icon: <AlertTriangle className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg">
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        {toClose.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 space-y-2" role="status" data-testid="overview-rollover">
            {toClose.map(r => (
              <div key={r.key} className="flex items-center gap-3 text-sm text-blue-900">
                <span className="flex-1">
                  {sprintName(r.key)} ended with <strong>{r.stats.open}</strong> unfinished ticket{r.stats.open === 1 ? '' : 's'}. Carry {r.stats.open === 1 ? 'it' : 'them'} over?
                </span>
                <button onClick={() => onOpenSprint(r.key)} {...sprintLink(r.key)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">Review</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-lira-text flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-lira-blue" /> Sprints overview
            </h1>
            <p className="text-xs text-lira-muted mt-0.5">Monthly, weekly, bi-weekly or a set number of days. Pick one to plan it, move tickets, or close it.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onOpenAllTickets} className="text-sm px-3 py-1.5 border border-lira-border rounded-xl bg-white text-lira-text hover:bg-gray-50 cursor-pointer">All tickets</button>
            <button onClick={onCreateSprint} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-xl bg-lira-blue text-white hover:bg-lira-blue-hover cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> New sprint
            </button>
          </div>
        </div>

        {/* Headline metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map(t => (
            <div key={t.label} className="bg-white border border-lira-border rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${t.tone}`}>{t.icon}</span>
              <div className="min-w-0">
                <div className="text-2xl font-semibold text-lira-text leading-none"><AnimatedValue value={t.value} /></div>
                <div className="text-[11px] text-lira-muted mt-1">{t.label}</div>
                <div className="text-[10px] text-lira-muted truncate">{t.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Velocity */}
        <section className="bg-white border border-lira-border rounded-2xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-lira-text">Velocity — last sprints</h2>
            <div className="flex gap-3 text-[10px] text-lira-muted">
              <span><span className="inline-block w-2 h-2 bg-gray-300 mr-1 rounded-sm" />Committed</span>
              <span><span className="inline-block w-2 h-2 bg-green-500 mr-1 rounded-sm" />Done</span>
            </div>
          </div>
          <div className="flex items-end gap-4 h-32">
            {lastSix.map(r => (
              <button key={r.key} onClick={() => onOpenSprint(r.key)} {...sprintLink(r.key)} title={`${sprintName(r.key)}: ${r.stats.done}/${r.stats.total}`}
                className="flex-1 flex flex-col items-center justify-end h-full gap-1 cursor-pointer">
                <div className="w-full flex items-end justify-center gap-1 flex-1">
                  <div className="w-1/3 bg-gray-300 rounded-t-md" style={{ height: `${(r.stats.total / maxTotal) * 100}%` }} />
                  <div className="w-1/3 bg-green-500 rounded-t-md" style={{ height: `${(r.stats.done / maxTotal) * 100}%` }} />
                </div>
                <span className={`text-[10px] ${r.key === cur ? 'font-bold text-lira-blue' : 'text-lira-muted'}`}>{sprintLabel(r.key, true)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Sprints table */}
        <section className="bg-white border border-lira-border rounded-2xl overflow-hidden">
          <header className="px-4 py-3 border-b border-lira-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-lira-text flex items-center gap-2"><Layers className="w-4 h-4 text-lira-muted" /> All sprints</h2>
            <span className="text-xs text-lira-muted">{rows.length} sprints</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-lira-muted">
                <tr>
                  {['Sprint', 'Status', 'Dates', 'Tickets', 'To do', 'In progress', 'Blocked', 'Done', 'Progress', 'Points', 'Carried', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-lira-border">
                {rows.map(r => (
                  <tr key={r.key} onClick={() => onOpenSprint(r.key)} {...sprintLink(r.key)} className="hover:bg-gray-50 cursor-pointer transition-colors group">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-lira-text whitespace-nowrap">{sprintName(r.key)}</div>
                      {r.goal && <div className="text-[10px] text-lira-muted truncate max-w-[200px]"><Target className="inline w-3 h-3 mr-1 -mt-0.5" />{r.goal}</div>}
                    </td>
                    <td className="px-3 py-2.5"><PhaseBadge sprint={r.key} /></td>
                    <td className="px-3 py-2.5 text-lira-muted whitespace-nowrap">{fmt(sprintStart(r.key))} – {fmt(sprintEnd(r.key))} <span className="opacity-60">({sprintKindLabel(r.key)}, {sprintDays(r.key)}d)</span></td>
                    <td className="px-3 py-2.5 font-semibold text-lira-text">{r.stats.total}</td>
                    <td className="px-3 py-2.5 text-lira-muted">{r.stats.todo + r.stats.backlog}</td>
                    <td className="px-3 py-2.5 text-lira-blue">{r.stats.inprogress}</td>
                    <td className="px-3 py-2.5 text-red-600">{r.stats.blocked || '—'}</td>
                    <td className="px-3 py-2.5 text-emerald-600 font-medium">{r.stats.done}</td>
                    <td className="px-3 py-2.5 w-36">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"><GrowBar className="h-full bg-green-500" percent={r.stats.percent} /></div>
                        <span className="w-8 text-right text-lira-text"><CountUp value={r.stats.percent} suffix="%" /></span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-lira-muted whitespace-nowrap">{r.stats.donePoints}/{r.stats.points}</td>
                    <td className="px-3 py-2.5 text-amber-600">{r.stats.carriedIn || '—'}</td>
                    <td className="px-3 py-2.5 text-lira-blue opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-3.5 h-3.5" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Per-space matrix */}
        <section className="bg-white border border-lira-border rounded-2xl overflow-hidden">
          <header className="px-4 py-3 border-b border-lira-border">
            <h2 className="text-sm font-semibold text-lira-text">Done / total by space</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-lira-muted">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Space</th>
                  {lastSix.map(r => (
                    <th key={r.key} className="px-3 py-2.5 font-semibold text-center whitespace-nowrap">
                      <button onClick={() => onOpenSprint(r.key)} {...sprintLink(r.key)} className="hover:text-lira-blue cursor-pointer">{sprintLabel(r.key, true)}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-lira-border">
                {spaces.map(s => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 text-lira-text whitespace-nowrap">{s.icon} {s.name}</td>
                    {lastSix.map(r => {
                      const l = r.list.filter(i => i.spaceId === s.id);
                      const d = l.filter(isDone).length;
                      return (
                        <td key={r.key} className="px-3 py-2 text-center">
                          {l.length === 0 ? <span className="text-lira-muted opacity-50">—</span> : (
                            <span className={d === l.length ? 'text-emerald-600 font-semibold' : 'text-lira-text'}>{d}/{l.length}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
