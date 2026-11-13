import React from 'react';
import { Filter, X } from 'lucide-react';
import { FilterMultiSelect } from '../common/FilterMultiSelect';
import type { Space } from '../../types/space';
import { BLOCKED_META, STATUS_LIST } from '../../utils/status';
import { EMPTY_FILTER, type SprintFilterValue } from './sprintFilterDefaults';

/** The four statuses, and Blocked (a switch on the ticket, so it can be filtered like a status). */
const STATUSES = [...STATUS_LIST.map(s => ({ value: s.id as string, label: s.label, color: s.color })), { value: 'blocked', label: 'Blocked', color: BLOCKED_META.color }];

interface SprintFilterProps {
  spaces: Space[];
  value: SprintFilterValue;
  onChange: (v: SprintFilterValue) => void;
}

const flip = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter(v => v !== x) : [...xs, x]);

/**
 * Narrows the ticket list of a sprint: a Status dropdown and a Space dropdown side by side. Each lists its values with a
 * checkbox (several can be chosen); Space also has a search box. Nothing ticked = no filter.
 */
export const SprintFilter: React.FC<SprintFilterProps> = ({ spaces, value, onChange }) => {
  const count = value.statuses.length + value.spaceIds.length;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter tickets" data-testid="sprint-filter">
      <span className="flex items-center gap-1 text-xs font-semibold text-lira-muted"><Filter className="w-3.5 h-3.5" aria-hidden /> Filter</span>
      <FilterMultiSelect
        label="Status"
        options={STATUSES}
        selected={value.statuses}
        onToggle={v => onChange({ ...value, statuses: flip(value.statuses, v) })}
        onClear={() => onChange({ ...value, statuses: [] })}
      />
      <FilterMultiSelect
        label="Space"
        options={spaces.filter(s => s.id).map(s => ({ value: String(s.id), label: s.name }))}
        selected={value.spaceIds.map(String)}
        onToggle={v => onChange({ ...value, spaceIds: flip(value.spaceIds, Number(v)) })}
        onClear={() => onChange({ ...value, spaceIds: [] })}
        searchable
        searchPlaceholder="Search or type a space"
        emptyText="No spaces"
      />
      {count > 0 && (
        <button type="button" onClick={() => onChange(EMPTY_FILTER)} className="flex items-center gap-1 text-xs font-medium text-lira-muted hover:text-red-500 cursor-pointer" data-testid="sprint-filter-clear">
          <X className="w-3 h-3" /> Clear filter
        </button>
      )}
    </div>
  );
};
