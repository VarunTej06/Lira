import React from 'react';
import { burndown, sprintLabel, sprintName } from '../../utils/sprintUtils';
import { GrowColumn } from '../common/motion';
import { motion } from '../common/motionPresets';
import { PALETTE } from '../../theme/palette';

interface Velocity {
  rows: { key: string; done: number; total: number }[];
  max: number;
  avg: number;
}

/** Remaining work against the ideal line, day by day. */
export const BurndownChart: React.FC<{ data: ReturnType<typeof burndown>; total: number }> = ({ data, total }) => {
  const W = 420, H = 150, P = { l: 28, r: 8, t: 8, b: 20 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const n = data.length;
  const x = (d: number) => P.l + ((d - 1) / Math.max(1, n - 1)) * iw;
  const y = (v: number) => P.t + ih - (total ? (v / total) * ih : 0);
  const ideal = data.map(p => `${x(p.day)},${y(p.ideal)}`).join(' ');
  const actualPts = data.filter(p => p.actual !== null);
  const actual = actualPts.map(p => `${x(p.day)},${y(p.actual!)}`).join(' ');
  if (total === 0) return <p className="text-xs text-lira-muted py-10 text-center">No tickets to chart.</p>;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36" role="img" aria-label="Burndown chart">
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={y(total * f)} y2={y(total * f)} stroke={PALETTE.border} strokeWidth="1" />
            <text x={P.l - 4} y={y(total * f) + 3} fontSize="9" textAnchor="end" fill={PALETTE.textMuted}>{Math.round(total * f)}</text>
          </g>
        ))}
        {[1, Math.ceil(n / 2), n].map(d => (
          <text key={d} x={x(d)} y={H - 6} fontSize="9" textAnchor="middle" fill={PALETTE.textMuted}>{d}</text>
        ))}
        <motion.polyline points={ideal} fill="none" stroke={PALETTE.textFaint} strokeWidth="1.5" strokeDasharray="4 3" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} />
        {actualPts.length > 0 && <motion.polyline points={actual} fill="none" stroke={PALETTE.brand} strokeWidth="2" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: 'easeInOut', delay: 0.15 }} />}
      </svg>
      <div className="flex gap-3 text-3xs text-lira-muted">
        <span><span className="inline-block w-3 border-t-2 border-dashed border-gray-400 mr-1 align-middle" />Ideal</span>
        <span><span className="inline-block w-3 border-t-2 border-lira-blue mr-1 align-middle" />Remaining</span>
      </div>
    </div>
  );
};

/** Committed against done for the last sprints. Click a column pair to open that sprint. */
export const VelocityChart: React.FC<{ velocity: Velocity; sprint: string; onPick: (sprint: string) => void }> = ({ velocity, sprint, onPick }) => (
  <>
    <div className="flex items-baseline justify-between mb-2">
      <h3 className="text-sm font-semibold text-lira-text">Velocity (last sprints)</h3>
      <span className="text-2xs text-lira-muted">avg {velocity.avg} done / closed sprint</span>
    </div>
    <div className="flex items-end gap-3 h-32">
      {velocity.rows.map((r, n) => (
        <button key={r.key} onClick={() => onPick(r.key)} className="flex-1 flex flex-col items-center justify-end h-full gap-1 cursor-pointer group" title={`${sprintName(r.key)}: ${r.done}/${r.total} done`}>
          <div className="w-full flex items-end justify-center gap-0.5 flex-1">
            <GrowColumn className="w-1/2 bg-gray-300 rounded-t" delay={n * 0.08} heightPercent={(r.total / velocity.max) * 100} />
            <GrowColumn className="w-1/2 bg-green-500 rounded-t" delay={n * 0.08 + 0.1} heightPercent={(r.done / velocity.max) * 100} />
          </div>
          <span className={`text-3xs ${r.key === sprint ? 'font-bold text-lira-blue' : 'text-lira-muted'}`}>{sprintLabel(r.key, true)}</span>
        </button>
      ))}
    </div>
    <div className="flex gap-3 text-3xs text-lira-muted mt-2">
      <span><span className="inline-block w-2 h-2 bg-gray-300 mr-1" />Committed</span>
      <span><span className="inline-block w-2 h-2 bg-green-500 mr-1" />Done</span>
    </div>
  </>
);
