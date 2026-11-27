import { ArrowRight, Boxes, CheckCheck, Layers, Plus, Target, Timer } from 'lucide-react';
import type { Space } from '../../types/space';
import { cardSlot, chartRows, headline, type BoxRow } from '../../utils/storyOverview';
import { minutesOf } from '../../utils/storyRound';
import { scopeLabel } from '../../utils/storybox';
import { AnimatedValue, CountUp, GrowBar, GrowColumn } from '../common/motion';

interface Props { rows: readonly BoxRow[]; spaces: readonly Space[]; canManage: boolean; onOpen: (boxId: string) => void; onCreate: () => void }

const dateOf = (iso: string): string => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const newest = (a: BoxRow, b: BoxRow) => b.box.createdAt.localeCompare(a.box.createdAt);

function StatusBadge({ open }: { open: boolean }) {
  return <span className={`text-3xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{open ? 'Open' : 'Closed'}</span>;
}

/** One current box as a card: where it is, how far along, and what it has sized. */
function BoxCard({ row, spaces, onOpen, slot }: { row: BoxRow; spaces: readonly Space[]; onOpen: (id: string) => void; slot: { column: number; row: number } }) {
  const minutes = minutesOf(row.box);
  return (
    <button type="button" onClick={() => onOpen(row.box.id)} style={{ gridColumn: slot.column, gridRow: slot.row }} className="text-left bg-white border border-lira-border rounded-2xl p-4 space-y-3 hover:border-lira-blue transition-colors cursor-pointer">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-lira-blue-light text-lira-blue"><Layers className="w-5 h-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-lira-text truncate">{row.box.name}</div>
          <div className="text-2xs text-lira-muted truncate">{scopeLabel(row.box.scope, spaces)}</div>
        </div>
        <ArrowRight className="w-4 h-4 text-lira-blue flex-shrink-0 mt-1" />
      </div>
      <div>
        <div className="flex items-center justify-between text-2xs text-lira-muted mb-1"><span>{row.sized} of {row.total} tickets sized</span><span className="font-semibold text-lira-text">{row.percent}%</span></div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><GrowBar percent={row.percent} className="h-full rounded-full bg-lira-blue" /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-3xs">
        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{row.points} points boxed</span>
        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{minutes} min to vote</span>
        <span className="ml-auto text-lira-muted">Made by {row.box.createdBy}, {dateOf(row.box.createdAt)}</span>
      </div>
    </button>
  );
}

/** Points boxed in each recent box, next to how many tickets it holds, like the velocity chart of the sprints. */
function BoxChart({ rows }: { rows: readonly BoxRow[] }) {
  const shown = chartRows(rows);
  const max = Math.max(1, ...shown.map(r => Math.max(r.total, r.sized)));
  return (
    <section aria-label="Points boxed per story box" className="bg-white border border-lira-border rounded-2xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-lira-text">Points boxed in the last story boxes</h2>
        <div className="flex gap-3 text-3xs text-lira-muted">
          <span><span className="inline-block w-2 h-2 bg-gray-300 mr-1 rounded-sm" />Tickets in the box</span>
          <span><span className="inline-block w-2 h-2 bg-green-500 mr-1 rounded-sm" />Sized</span>
        </div>
      </div>
      {shown.length === 0 ? <p className="text-xs text-lira-muted py-6 text-center">Nothing has been sized yet. Open a story box and put a ticket up for voting.</p> : (
        <div className="flex items-end gap-4 h-32">
          {shown.map((r, n) => (
            <div key={r.box.id} title={`${r.box.name}: ${r.sized} of ${r.total} sized, ${r.points} points`} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
              <span className="text-3xs font-semibold text-lira-text">{r.points} pts</span>
              <div className="w-full flex items-end justify-center gap-1 flex-1">
                <GrowColumn className="w-1/3 bg-gray-300 rounded-t-md" delay={n * 0.08} heightPercent={(r.total / max) * 100} />
                <GrowColumn className="w-1/3 bg-green-500 rounded-t-md" delay={n * 0.08 + 0.1} heightPercent={(r.sized / max) * 100} />
              </div>
              <span className="text-3xs text-lira-muted truncate max-w-full">{r.box.name}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BoxTable({ rows, spaces, onOpen }: { rows: readonly BoxRow[]; spaces: readonly Space[]; onOpen: (id: string) => void }) {
  return (
    <section aria-label="All story boxes" className="bg-white border border-lira-border rounded-2xl overflow-hidden">
      <header className="px-4 py-3 border-b border-lira-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-lira-text flex items-center gap-2"><Layers className="w-4 h-4 text-lira-muted" /> All story boxes</h2>
        <span className="text-xs text-lira-muted">{rows.length} {rows.length === 1 ? 'box' : 'boxes'}</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-lira-muted">
            <tr>{['Story box', 'Status', 'About', 'Made by', 'Date', 'Vote time', 'Sized', 'Progress', 'Points', ''].map(h => <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-lira-border">
            {rows.map(r => (
              <tr key={r.box.id} onClick={() => onOpen(r.box.id)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-3 py-2.5 font-semibold text-lira-text whitespace-nowrap"><button type="button" onClick={e => { e.stopPropagation(); onOpen(r.box.id); }} className="cursor-pointer text-left">{r.box.name}</button></td>
                <td className="px-3 py-2.5"><StatusBadge open={r.box.status === 'open'} /></td>
                <td className="px-3 py-2.5 text-lira-muted whitespace-nowrap">{scopeLabel(r.box.scope, spaces)}</td>
                <td className="px-3 py-2.5 text-lira-muted whitespace-nowrap">{r.box.createdBy}</td>
                <td className="px-3 py-2.5 text-lira-muted whitespace-nowrap">{dateOf(r.box.createdAt)}</td>
                <td className="px-3 py-2.5 text-lira-muted whitespace-nowrap">{minutesOf(r.box)} min</td>
                <td className="px-3 py-2.5 font-semibold text-lira-text whitespace-nowrap">{r.sized}/{r.total}</td>
                <td className="px-3 py-2.5 min-w-[120px]">
                  <div className="flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden"><GrowBar percent={r.percent} className="h-full rounded-full bg-lira-blue" /></div><span className="w-9 text-right text-lira-text">{r.percent}%</span></div>
                </td>
                <td className="px-3 py-2.5 font-semibold text-lira-text">{r.points}</td>
                <td className="px-3 py-2.5 text-lira-blue"><ArrowRight className="w-3.5 h-3.5" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** All story boxes at a glance: headline numbers, points boxed per box, the boxes being worked on, and every box with the older ones as history. */
export function StoryBoxesOverview({ rows, spaces, canManage, onOpen, onCreate }: Props) {
  const head = headline(rows);
  const current = rows.filter(r => r.box.status === 'open').sort(newest);
  const tiles = [
    { label: 'Open boxes', value: head.open, sub: 'being estimated now', icon: <Boxes className="w-4 h-4" />, tone: 'text-teal-600 bg-teal-50' },
    { label: 'Closed boxes', value: head.closed, sub: 'kept as history', icon: <CheckCheck className="w-4 h-4" />, tone: 'text-lira-blue bg-lira-blue-light' },
    { label: 'Tickets sized', value: head.sized, sub: 'across every box', icon: <Target className="w-4 h-4" />, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Points boxed', value: head.points, sub: 'story points confirmed', icon: <Timer className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-50' },
  ];
  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg">
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-lira-text flex items-center gap-2"><Layers className="w-5 h-5 text-lira-blue" /> Story boxes</h1>
            <p className="text-xs text-lira-muted mt-0.5">Estimate story points together. Put a ticket up, everyone votes within the time, reveal, and confirm the points.</p>
          </div>
          {canManage && <button type="button" onClick={onCreate} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-xl bg-lira-blue text-lira-on-blue hover:bg-lira-blue-hover cursor-pointer"><Plus className="w-3.5 h-3.5" /> New story box</button>}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map(t => (
            <div key={t.label} className="bg-white border border-lira-border rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${t.tone}`}>{t.icon}</span>
              <div className="min-w-0">
                <div className="text-2xl font-semibold text-lira-text leading-none"><AnimatedValue value={<CountUp value={t.value} />} /></div>
                <div className="text-2xs text-lira-muted mt-1">{t.label}</div>
                <div className="text-3xs text-lira-muted truncate">{t.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <BoxChart rows={rows} />

        <section aria-label="Current story boxes" className="space-y-2">
          <h2 className="text-sm font-semibold text-lira-text">Current story boxes</h2>
          {current.length === 0 ? (
            <div className="bg-white border border-lira-border rounded-2xl px-4 py-8 text-center text-xs text-lira-muted">
              {rows.length === 0 ? (canManage ? 'Make a story box to start estimating together.' : 'Nobody has made a story box you can see yet.') : 'No story box is open. Make a new one, or reopen one from the list below.'}
            </div>
          ) : <div className="bg-white border border-lira-border rounded-2xl p-3"><div className="grid grid-rows-2 auto-cols-[85%] md:auto-cols-[calc((100%-1.5rem)/3)] gap-3 overflow-x-auto pb-3">{current.map((r, i) => <BoxCard key={r.box.id} row={r} spaces={spaces} onOpen={onOpen} slot={cardSlot(i)} />)}</div></div>}
        </section>

        {rows.length > 0 && <BoxTable rows={[...rows].sort(newest)} spaces={spaces} onOpen={onOpen} />}
      </div>
    </div>
  );
}
