import { Zap } from 'lucide-react';
import type { FiltersState } from './useFiltersState';

/** The filters in use, as removable chips. */
export function ActiveFilterChips(s: FiltersState) {
  const { onSelectSpace, selectedSpaces, setSelectedSpaces, selectedStatuses, setSelectedStatuses, selectedPriorities, setSelectedPriorities, selectedTypes, setSelectedTypes, selectedAssignees, setSelectedAssignees, selectedLabels, setSelectedLabels, selectedTeam, setSelectedTeam, isRecentOnly, setIsRecentOnly, clearAllFilters, spaceMap, activeFiltersCount } = s;
  return (
    <>
        {/* Active Filters Removable Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5 px-1">
            <span className="text-2xs text-lira-muted font-medium">Applied:</span>

            {isRecentOnly && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-2xs font-medium">
                <Zap className="w-3 h-3 text-amber-600" />
                Updated in last 7 days
                <button onClick={() => setIsRecentOnly(false)} className="hover:text-amber-950 ml-0.5">×</button>
              </span>
            )}

            {selectedSpaces.map(id => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-lira-blue-light text-lira-text border border-lira-border rounded-md text-2xs font-medium"
              >
                <button
                  type="button"
                  onClick={() => onSelectSpace?.(id)}
                  className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                  title={`Open ${spaceMap[id]?.name || id} board`}
                >
                  <span>{spaceMap[id]?.icon || '📁'}</span>
                  <span>{spaceMap[id]?.name || id}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSpaces(prev => prev.filter(x => x !== id));
                  }}
                  className="hover:text-lira-text ml-0.5 text-lira-blue font-bold cursor-pointer"
                  title="Remove filter"
                >
                  ×
                </button>
              </span>
            ))}

            {selectedStatuses.map(st => (
              <span key={st} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-800 border border-gray-300 rounded-md text-2xs font-medium capitalize">
                Status: {st}
                <button onClick={() => setSelectedStatuses(prev => prev.filter(x => x !== st))} className="hover:text-black ml-0.5">×</button>
              </span>
            ))}

            {selectedPriorities.map(p => (
              <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-800 border border-orange-200 rounded-md text-2xs font-medium capitalize">
                Priority: {p}
                <button onClick={() => setSelectedPriorities(prev => prev.filter(x => x !== p))} className="hover:text-orange-950 ml-0.5">×</button>
              </span>
            ))}

            {selectedTypes.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-md text-2xs font-medium capitalize">
                Type: {t}
                <button onClick={() => setSelectedTypes(prev => prev.filter(x => x !== t))} className="hover:text-purple-950 ml-0.5">×</button>
              </span>
            ))}

            {selectedAssignees.map(a => (
              <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-2xs font-medium">
                Assignee: {a}
                <button onClick={() => setSelectedAssignees(prev => prev.filter(x => x !== a))} className="hover:text-emerald-950 ml-0.5">×</button>
              </span>
            ))}

            {selectedLabels.map(l => (
              <span key={l} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-md text-2xs font-mono">
                #{l}
                <button onClick={() => setSelectedLabels(prev => prev.filter(x => x !== l))} className="hover:text-indigo-950 ml-0.5">×</button>
              </span>
            ))}

            {selectedTeam !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-md text-2xs font-medium">
                Team: {selectedTeam}
                <button onClick={() => setSelectedTeam('all')} className="hover:text-teal-950 ml-0.5">×</button>
              </span>
            )}

            <button
              onClick={clearAllFilters}
              className="text-2xs text-lira-blue hover:underline ml-1 cursor-pointer font-medium"
            >
              Clear all
            </button>
          </div>
        )}
    </>
  );
}
