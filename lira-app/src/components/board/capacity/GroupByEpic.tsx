import { Zap } from 'lucide-react';
import type { CapacityState } from './useCapacityState';

/** Workload grouped by epic. */
export function GroupByEpic(s: CapacityState) {
  const {  onIssueClick, groupBy, epicGroups } = s;
  return (
    <>
      {/* ─────────────────── 4. GROUP BY EPIC ─────────────────── */}
      {groupBy === 'epic' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {epicGroups.map(({ epic, children, done, progress, points }) => (
            <div
              key={epic.id}
              className="bg-white rounded-xl border border-lira-border shadow-xs p-5 space-y-4 hover:border-lira-blue transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <Zap className="w-3 h-3" /> {epic.key}
                  </span>
                  <h3 className="text-sm font-bold text-lira-text truncate max-w-sm">{epic.title}</h3>
                </div>
                <span className="text-xs font-bold text-purple-700">{progress}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="text-xs text-lira-muted flex justify-between font-medium">
                <span>{done} of {children.length} child tasks done · {points} pts</span>
                <span className="capitalize">{epic.status}</span>
              </div>

              {/* Child items */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {children.map(child => (
                  <div
                    key={child.id}
                    onClick={() => onIssueClick?.(child)}
                    className="flex items-center justify-between p-2 rounded-lg border border-lira-border hover:bg-gray-50 transition-all cursor-pointer text-xs group"
                  >
                    <span className="font-mono font-bold text-lira-blue mr-2 group-hover:underline">{child.key}</span>
                    <span className="truncate flex-1 text-lira-text">{child.title}</span>
                    <span className="text-[10px] uppercase font-semibold text-gray-500 ml-2">
                      {child.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
