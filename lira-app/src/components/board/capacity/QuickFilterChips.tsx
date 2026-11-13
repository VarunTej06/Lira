import type { CapacityState } from './useCapacityState';

/** All / mine / in flight / high priority / overdue. */
export function QuickFilterChips(s: CapacityState) {
  const { issues, localQuickFilter, setLocalQuickFilter, setSelectedAssigneeFilter, hasActiveFilters, totalOverdue } = s;
  return (
    <>
      {/* ── Quick Filter Chips Row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-lira-border shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-lira-muted uppercase mr-1">Quick Filter:</span>
          {[
            { id: 'all' as const, label: `All Items (${issues.length})` },
            { id: 'vy' as const, label: 'Assigned to VY' },
            { id: 'inprogress' as const, label: 'In Flight Only' },
            { id: 'blocked' as const, label: 'Blocked' },
            { id: 'high' as const, label: 'High Priority' },
            { id: 'overdue' as const, label: `Overdue (${totalOverdue})` },
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setLocalQuickFilter(chip.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                localQuickFilter === chip.id
                  ? 'bg-lira-blue text-lira-on-blue shadow-2xs'
                  : 'bg-gray-100 text-lira-text hover:bg-gray-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setLocalQuickFilter('all');
              setSelectedAssigneeFilter(null);
            }}
            className="text-xs text-lira-blue font-semibold hover:underline cursor-pointer"
          >
            Clear Capacity Filters
          </button>
        )}
      </div>
    </>
  );
}
