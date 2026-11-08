import { Users } from 'lucide-react';
import type { CapacityState } from './useCapacityState';

/** Headline numbers. */
export function CapacityBanner(s: CapacityState) {
  const { space, groupBy, teamTotal, teamDone, teamInProgress, teamPoints } = s;
  return (
    <>
      {/* ── Top Analytical Banner ── */}
      <div className="bg-white border border-lira-border rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200 shadow-2xs flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-lira-text leading-tight">
                Team Capacity &amp; Workload Allocation
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200">
                Group: {groupBy === 'priority' ? 'Priority' : groupBy === 'epic' ? 'Epic' : groupBy === 'status' ? 'Status' : 'Assignee'}
              </span>
            </div>
            <p className="text-xs text-lira-muted mt-1">
              Bandwidth allocation, sprint delivery distribution, and capacity planning for{' '}
              <strong className="text-lira-text font-semibold">{space?.name || 'Workspace'}</strong>
            </p>
          </div>
        </div>

        {/* Global Metrics Bar */}
        <div className="flex items-center gap-4 bg-gray-50/80 px-4 py-2.5 rounded-xl border border-lira-border flex-shrink-0">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase text-lira-muted tracking-wider">
              Sprint Story Points
            </div>
            <div className="text-xl font-extrabold text-lira-text">
              {teamPoints} pts <span className="text-xs font-normal text-lira-muted">({teamTotal} items)</span>
            </div>
          </div>

          <div className="h-8 w-px bg-lira-border" />

          <div className="text-right">
            <div className="text-[10px] font-bold uppercase text-lira-muted tracking-wider">
              Sprint Progress
            </div>
            <div className="text-xl font-extrabold text-emerald-600">
              {teamTotal > 0 ? Math.round((teamDone / teamTotal) * 100) : 0}% Done
            </div>
          </div>

          <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border-2 border-blue-500 shadow-2xs">
            {teamInProgress} In Prog
          </div>
        </div>
      </div>
    </>
  );
}
