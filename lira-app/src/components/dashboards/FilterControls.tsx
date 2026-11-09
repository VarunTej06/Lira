import React, { useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { FilterMultiSelect } from '../common/FilterMultiSelect';
import { allSprintKeys, currentSprintKey, sprintName } from '../../utils/sprintUtils';
import { DEFAULT_FILTERS, type DashboardFilters, type DateRange } from '../../utils/dashboards/types';

const RANGES: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All time' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }, { value: '90d', label: 'Last 90 days' },
];
const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'].map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }));
const TYPES = [{ value: 'task', label: 'Tasks' }, { value: 'bug', label: 'Bugs' }, { value: 'subtask', label: 'Subtasks' }, { value: 'epic', label: 'Epics' }];

const countFilters = (f: DashboardFilters) =>
  (f.spaceIds.length ? 1 : 0) + (f.sprint !== 'all' ? 1 : 0) + (f.range !== 'all' ? 1 : 0) + (f.assignee !== 'all' ? 1 : 0) + (f.priorities.length ? 1 : 0) + (f.labels.length ? 1 : 0) + (f.types.length ? 1 : 0);

interface Props {
  value: DashboardFilters;
  onChange: (f: DashboardFilters) => void;
  issues: Issue[];
  spaces: Space[];
  /** Show the "clear" button. */
  clearable?: boolean;
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

/** The dropdowns that decide which tickets a dashboard (or one widget) looks at. */
export const FilterControls: React.FC<Props> = ({ value, onChange, issues, spaces, clearable = true }) => {
  const sprintOptions = useMemo(() => {
    const keys = allSprintKeys(issues).slice().reverse();
    return [{ value: 'all', label: 'All sprints' }, { value: 'current', label: `Current (${sprintName(currentSprintKey())})` }, ...keys.map(k => ({ value: k, label: sprintName(k) }))];
  }, [issues]);
  const assignees = useMemo(() => {
    const names = [...new Set(issues.map(i => i.assignee).filter((n): n is string => !!n))].sort();
    return [{ value: 'all', label: 'Everyone' }, { value: 'me', label: 'Me' }, { value: 'unassigned', label: 'Unassigned' }, ...names.map(n => ({ value: n, label: n }))];
  }, [issues]);
  const labels = useMemo(() => [...new Set(issues.flatMap(i => i.labels || []))].sort().map(l => ({ value: l, label: l })), [issues]);
  const set = (patch: Partial<DashboardFilters>) => onChange({ ...value, ...patch });
  const nameOf = (opts: { value: string; label: string }[], v: string) => opts.find(o => o.value === v)?.label ?? v;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="dashboard-filters">
      <span className="flex items-center gap-1 text-xs font-semibold text-lira-muted mr-1"><Filter className="w-3.5 h-3.5" /> Scope</span>
      <FilterMultiSelect
        label="Spaces" options={spaces.filter(s => s.id).map(s => ({ value: String(s.id), label: `${s.icon} ${s.name}` }))}
        selected={value.spaceIds.map(String)} onToggle={v => set({ spaceIds: toggle(value.spaceIds, Number(v)) })} onClear={() => set({ spaceIds: [] })} emptyText="No spaces"
      />
      <FilterMultiSelect single label="Sprint" active={value.sprint !== 'all'} valueLabel={nameOf(sprintOptions, value.sprint)} options={sprintOptions} selected={[value.sprint]} onToggle={v => set({ sprint: v })} />
      <FilterMultiSelect single label="Period" active={value.range !== 'all'} valueLabel={nameOf(RANGES, value.range)} options={RANGES} selected={[value.range]} onToggle={v => set({ range: v as DateRange })} />
      <FilterMultiSelect single label="People" active={value.assignee !== 'all'} valueLabel={nameOf(assignees, value.assignee)} options={assignees} selected={[value.assignee]} onToggle={v => set({ assignee: v })} />
      <FilterMultiSelect label="Priority" options={PRIORITIES} selected={value.priorities} onToggle={v => set({ priorities: toggle(value.priorities, v) })} onClear={() => set({ priorities: [] })} />
      <FilterMultiSelect label="Type" options={TYPES} selected={value.types} onToggle={v => set({ types: toggle(value.types, v) })} onClear={() => set({ types: [] })} />
      <FilterMultiSelect label="Labels" options={labels} selected={value.labels} onToggle={v => set({ labels: toggle(value.labels, v) })} onClear={() => set({ labels: [] })} searchable searchPlaceholder="Search labels" emptyText="No labels yet" />
      {clearable && countFilters(value) > 0 && (
        <button type="button" onClick={() => onChange({ ...DEFAULT_FILTERS })} className="flex items-center gap-1 text-xs font-medium text-lira-muted hover:text-red-500 cursor-pointer" data-testid="dash-clear-filters">
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
};
