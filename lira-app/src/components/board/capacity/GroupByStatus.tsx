import type { CapacityState } from './useCapacityState';

/** Workload grouped by status. */
export function GroupByStatus(s: CapacityState) {
  const {  onIssueClick, groupBy, statusGroups } = s;
  return (
    <>
      {/* ─────────────────── 1. GROUP BY STATUS ─────────────────── */}
      {groupBy === 'status' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {statusGroups.map(stage => (
            <div
              key={stage.id}
              className={`rounded-xl border ${stage.color} shadow-xs p-5 space-y-4 flex flex-col hover:border-lira-blue transition-all`}
            >
              <div className="flex items-center justify-between border-b border-lira-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.dot }} />
                  <h3 className="text-sm font-bold text-lira-text">{stage.label}</h3>
                </div>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-lira-text">
                  {stage.items.length}
                </span>
              </div>

              {/* Story Point & Velocity Metrics */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-lira-muted">
                  <span>Capacity Load</span>
                  <span className="font-bold text-lira-text">{stage.points} pts ({stage.pct}%)</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${stage.pct}%`, backgroundColor: stage.dot }}
                  />
                </div>
                <p className="text-[11px] text-lira-muted pt-1">{stage.desc}</p>
              </div>

              {/* Item Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto max-h-96 pr-1">
                {stage.items.length === 0 ? (
                  <p className="text-xs text-lira-muted py-6 text-center bg-gray-50 rounded-lg">
                    No items in {stage.label.toLowerCase()}.
                  </p>
                ) : (
                  stage.items.map(issue => (
                    <div
                      key={issue.id}
                      onClick={() => onIssueClick?.(issue)}
                      className="p-3 rounded-lg border border-lira-border hover:border-lira-blue hover:bg-blue-50/20 transition-all cursor-pointer text-xs space-y-1.5 bg-white group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-lira-blue group-hover:underline">
                          {issue.key}
                        </span>
                        <span className="text-[10px] uppercase font-semibold text-gray-500">
                          {issue.priority}
                        </span>
                      </div>
                      <div className="font-medium text-lira-text line-clamp-2 leading-snug">
                        {issue.title}
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[10px] text-lira-muted border-t border-gray-100">
                        <span>{issue.assignee || 'Unassigned'}</span>
                        <span className="font-bold text-lira-text">{issue.storyPoints || 1} pts</span>
                      </div>
                    </div>
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
