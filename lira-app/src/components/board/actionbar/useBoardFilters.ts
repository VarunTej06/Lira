import { useState } from 'react';
import type { SpaceFilters } from '../../../utils/spaceFilters';

type Group = "priorities" | "labels" | "statuses";
const add = (list: string[], value: string) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

/** The priority, label and status choices of a space's filter bar. Every change is also reported to the page, which does the filtering. */
export function useBoardFilters(onFilterChange?: (filters: SpaceFilters) => void, onClearFilters?: () => void) {
  const [filters, setFilters] = useState<Required<SpaceFilters>>({ priorities: [], labels: [], statuses: [] });

  const change = (next: Required<SpaceFilters>) => { setFilters(next); onFilterChange?.(next); };
  return {
    priorities: filters.priorities, labels: filters.labels, statuses: filters.statuses,
    activeCount: filters.priorities.length + filters.labels.length + filters.statuses.length,
    toggle: (group: Group, value: string) => change({ ...filters, [group]: add(filters[group], value) }),
    /** Clears one dropdown, keeping the other filters. */
    clearGroup: (group: Group) => change({ ...filters, [group]: [] }),
    clearAll: () => { change({ priorities: [], labels: [], statuses: [] }); onClearFilters?.(); },
  };
}
