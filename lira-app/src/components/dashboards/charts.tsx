import React, { useState } from 'react';
import { motion } from '../common/motion';
import type { Group } from '../../utils/dashboards/metrics';

/** Small chart pieces for the dashboard widgets. Plain SVG and HTML, no chart library. */

export const Empty: React.FC<{ text?: string }> = ({ text = 'Nothing to show for these filters.' }) => (
  <div className="h-full min-h-[80px] flex items-center justify-center text-xs text-lira-muted text-center px-4">{text}</div>
);

/** Horizontal bars with a label and a value, in each group's colour. Click a bar to open its tickets. */
export const BarRows: React.FC<{ groups: Group[]; measure?: 'count' | 'points'; onPick?: (g: Group) => void }> = ({ groups, measure = 'count', onPick }) => {
  const max = Math.max(1, ...groups.map(g => g.value));
  if (!groups.length || groups.every(g => g.value === 0)) return <Empty />;
  return (
    <ul className="space-y-2" data-testid="bar-rows">
      {groups.map(g => (
        <li key={g.key}>
          <button
            type="button"
            disabled={!onPick || g.issues.length === 0}
            onClick={() => onPick?.(g)}
            className="w-full text-left group disabled:cursor-default cursor-pointer"
            title={`${g.label}: ${g.value}${measure === 'points' ? ' points' : ''}${onPick ? '. Click to see the tickets.' : ''}`}
          >
            <div className="flex items-baseline justify-between gap-2 text-xs mb-0.5">
              <span className="truncate text-lira-text group-hover:text-lira-blue">{g.label}</span>
              <span className="font-semibold text-lira-text tabular-nums">{g.value}{measure === 'points' ? ' pts' : ''}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ backgroundColor: g.color }} initial={{ width: 0 }} animate={{ width: `${(g.value / max) * 100}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
};

/** A ring split into slices, with the total in the middle and a legend beside it. */
export const Donut: React.FC<{ groups: Group[]; total: number; measure?: 'count' | 'points'; onPick?: (g: Group) => void }> = ({ groups, total, measure = 'count', onPick }) => {
  const [hover, setHover] = useState<string | null>(null);
  const live = groups.filter(g => g.value > 0);
  if (!live.length) return <Empty />;
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;
  const hovered = live.find(g => g.key === hover);
  return (
    <div className="flex items-center gap-4 h-full" data-testid="donut">
      <div className="relative w-[120px] h-[120px] flex-shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" role="img" aria-label="Share of tickets">
          <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeWidth="14" className="text-gray-100" />
          {live.map(g => {
            const len = (g.value / total) * C;
            const el = (
              <motion.circle
                key={g.key} cx="60" cy="60" r={R} fill="none" stroke={g.color} strokeWidth={hover === g.key ? 17 : 14}
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
                initial={{ opacity: 0 }} animate={{ opacity: hover && hover !== g.key ? 0.35 : 1 }}
                onMouseEnter={() => setHover(g.key)} onMouseLeave={() => setHover(null)}
                onClick={() => onPick?.(g)} className={onPick ? 'cursor-pointer' : ''}
              >
                <title>{`${g.label}: ${g.value}`}</title>
              </motion.circle>
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-lira-text leading-none">{hovered ? hovered.value : total}</span>
          <span className="text-[10px] text-lira-muted mt-0.5 max-w-[70px] truncate">{hovered ? hovered.label : measure === 'points' ? 'points' : 'tickets'}</span>
        </div>
      </div>
      <ul className="flex-1 min-w-0 space-y-1.5">
        {live.map(g => (
          <li key={g.key}>
            <button type="button" onClick={() => onPick?.(g)} onMouseEnter={() => setHover(g.key)} onMouseLeave={() => setHover(null)} className="w-full flex items-center gap-2 text-xs text-left cursor-pointer hover:text-lira-blue">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: g.color }} />
              <span className="flex-1 truncate text-lira-text">{g.label}</span>
              <span className="font-semibold tabular-nums text-lira-text">{g.value}</span>
              <span className="text-lira-muted tabular-nums w-9 text-right">{Math.round((g.value / total) * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

interface Series { name: string; color: string; values: number[]; dashed?: boolean }

const W = 480, H = 200, PAD = { l: 34, r: 12, t: 12, b: 26 };

function niceMax(v: number) {
  if (v <= 5) return Math.max(1, Math.ceil(v));
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
}

const Axes: React.FC<{ max: number; labels: string[]; every?: number }> = ({ max, labels, every = 1 }) => {
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const ticks = [0, 0.5, 1].map(f => Math.round(max * f));
  const x = (i: number) => PAD.l + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  return (
    <g className="text-lira-muted" fontSize="10">
      {ticks.map(t => { const y = PAD.t + ih - (t / max) * ih; return <g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.15" /><text x={PAD.l - 6} y={y + 3} textAnchor="end" fill="currentColor">{t}</text></g>; })}
      {labels.map((l, i) => (i % every === 0 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fill="currentColor">{l}</text> : null))}
    </g>
  );
};

/** Lines over a shared set of labels (weeks or days). */
export const LineChart: React.FC<{ labels: string[]; series: Series[]; ariaLabel: string }> = ({ labels, series, ariaLabel }) => {
  const max = niceMax(Math.max(1, ...series.flatMap(s => s.values)));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  if (!labels.length) return <Empty />;
  return (
    <div className="h-full flex flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full flex-1 min-h-0" role="img" aria-label={ariaLabel} data-testid="line-chart">
        <Axes max={max} labels={labels} every={Math.ceil(labels.length / 8)} />
        {series.map(s => (
          <g key={s.name}>
            <motion.polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"
              strokeDasharray={s.dashed ? '5 4' : undefined}
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeInOut' }}
            />
            {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.6" fill={s.color}><title>{`${s.name}, ${labels[i]}: ${v}`}</title></circle>)}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-lira-muted pt-1">
        {series.map(s => <span key={s.name} className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: s.color }} />{s.name}</span>)}
      </div>
    </div>
  );
};

/** Vertical columns, one per label. */
export const Columns: React.FC<{ labels: string[]; values: number[]; color: string; ariaLabel: string; average?: boolean }> = ({ labels, values, color, ariaLabel, average }) => {
  const max = niceMax(Math.max(1, ...values));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const slot = iw / Math.max(1, labels.length);
  const bw = Math.min(34, slot * 0.6);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  if (!labels.length) return <Empty />;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" role="img" aria-label={ariaLabel} data-testid="columns">
      <Axes max={max} labels={[]} />
      {labels.map((l, i) => {
        const h = (values[i] / max) * ih;
        const cx = PAD.l + slot * i + slot / 2;
        return (
          <g key={i}>
            <motion.rect x={cx - bw / 2} width={bw} rx="3" fill={color} initial={{ y: PAD.t + ih, height: 0 }} animate={{ y: PAD.t + ih - h, height: h }} transition={{ duration: 0.6, delay: i * 0.03 }}><title>{`${l}: ${values[i]}`}</title></motion.rect>
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" className="fill-current text-lira-muted">{l}</text>
            <text x={cx} y={PAD.t + ih - h - 4} textAnchor="middle" fontSize="10" className="fill-current text-lira-text">{values[i] || ''}</text>
          </g>
        );
      })}
      {average && avg > 0 && <g><line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih - (avg / max) * ih} y2={PAD.t + ih - (avg / max) * ih} stroke="#E2740B" strokeDasharray="5 4" strokeWidth="1.5" /><text x={W - PAD.r} y={PAD.t + ih - (avg / max) * ih - 4} textAnchor="end" fontSize="10" fill="#E2740B">{`average ${avg.toFixed(1)}`}</text></g>}
    </svg>
  );
};

/** Layers stacked on top of each other over the days (cumulative flow). Layer 0 is at the bottom. */
export const AreaStack: React.FC<{ labels: string[]; layers: Series[]; ariaLabel: string }> = ({ labels, layers, ariaLabel }) => {
  const totals = labels.map((_, i) => layers.reduce((a, l) => a + (l.values[i] ?? 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  if (!labels.length) return <Empty text="The sprint has not started yet." />;
  const polys = layers.map((l, idx) => {
    const below = (i: number) => layers.slice(0, idx).reduce((a, s) => a + (s.values[i] ?? 0), 0);
    const top = labels.map((_, i) => `${x(i)},${y(below(i) + (l.values[i] ?? 0))}`);
    const bottom = labels.map((_, i) => `${x(i)},${y(below(i))}`).reverse();
    return { l, pts: [...top, ...bottom].join(' ') };
  });
  return (
    <div className="h-full flex flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full flex-1 min-h-0" role="img" aria-label={ariaLabel} data-testid="area-stack">
        <Axes max={max} labels={labels} every={Math.ceil(labels.length / 8)} />
        <motion.g initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }} transition={{ duration: 1, ease: 'easeInOut' }}>
          {polys.map(p => <polygon key={p.l.name} points={p.pts} fill={p.l.color} opacity="0.9"><title>{p.l.name}</title></polygon>)}
        </motion.g>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-lira-muted pt-1">
        {[...layers].reverse().map(l => <span key={l.name} className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />{l.name}</span>)}
      </div>
    </div>
  );
};
