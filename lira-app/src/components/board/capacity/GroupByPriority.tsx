import { statusLabel } from '../../../utils/status';
import { ColorDot } from '../../common/Icons';
import { WorkItemCard } from './WorkItemCard';
import type { CapacityState } from './useCapacityState';

/** Workload grouped by priority. */
export function GroupByPriority(s: CapacityState) {
  const {  onIssueClick, groupBy, priorityGroups } = s;
  return (
    <>
      {/* ─────────────────── 3. GROUP BY PRIORITY ─────────────────── */}
      {groupBy === 'priority' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {priorityGroups.map(group => (
            <div
              key={group.id}
              className={`rounded-xl border ${group.color} shadow-xs p-5 space-y-4 flex flex-col hover:border-lira-blue transition-all`}
            >
              <div className="flex items-center justify-between border-b border-lira-border pb-3">
                <div className="flex items-center gap-2">
                  <ColorDot color={group.dot} className="w-3 h-3" />
                  <h3 className="text-sm font-bold text-lira-text">{group.label}</h3>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${group.badge}`}>
                  {group.items.length}
                </span>
              </div>

              <div className="text-xs text-lira-muted flex justify-between">
                <span>Story Point Load:</span>
                <span className="font-bold text-lira-text">{group.points} pts</span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-96 pr-1">
                {group.items.length === 0 ? (
                  <p className="text-xs text-lira-muted py-6 text-center bg-gray-50 rounded-lg">
                    No work items in this priority level.
                  </p>
                ) : (
                  group.items.map(issue => (
                    <WorkItemCard key={issue.id} issue={issue} compact onOpen={onIssueClick}
                      tag={<span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-gray-100 font-semibold text-gray-600">{statusLabel(issue.status)}</span>} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
