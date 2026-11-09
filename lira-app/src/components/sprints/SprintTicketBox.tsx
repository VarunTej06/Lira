import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { keepPlace } from '../../utils/keepPlace';
import { matchesStatusFilter } from '../../utils/spaceFilters';
import { BLOCKED_META } from '../../utils/status';
import { sprintName } from '../../utils/sprintUtils';
import { SprintFilter, type SprintFilterValue } from './SprintFilter';
import { STATUS_META, TicketRow } from './sprintParts';

const STATUS_ORDER = ['inprogress', 'todo', 'backlog', 'done'];
const META = STATUS_META as Record<string, { label: string; color: string }>;
const statusMeta = (status: string) => (status === 'blocked' ? BLOCKED_META : META[status]);

interface Props {
  sprint: string;
  scope: 'all' | number;
  keys: string[];
  /** Every ticket in the sprint. The filter narrows what is shown here only. */
  list: Issue[];
  /** The spaces the filter can offer. */
  filterSpaces: Space[];
  spaceById: Map<number, Space>;
  filter: SprintFilterValue;
  onFilterChange: (value: SprintFilterValue) => void;
  selected: Set<number>;
  setSelected: Dispatch<SetStateAction<Set<number>>>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  phase: string;
  onIssueClick: (issue: Issue) => void;
}

/**
 * All the sprint's tickets in one box. The heading row has the select-all checkbox, a title that follows the Status filter,
 * and the Status and Space filters. The heading stays where it is on the screen when a filter changes the list.
 */
export function SprintTicketBox({ sprint, scope, keys, list, filterSpaces, spaceById, filter, onFilterChange, selected, setSelected, collapsed, onToggleCollapsed, phase, onIssueClick }: Props) {
  const visible = useMemo(
    () => list.filter(i => matchesStatusFilter(i, filter.statuses.map(s => s.toLowerCase())) && (!filter.spaceIds.length || filter.spaceIds.includes(i.spaceId))),
    [list, filter],
  );
  const shown = useMemo(() => [...visible].sort((x, y) => STATUS_ORDER.indexOf(x.status?.toLowerCase()) - STATUS_ORDER.indexOf(y.status?.toLowerCase())), [visible]);

  const title = filter.statuses.length === 0 ? 'All tickets' : filter.statuses.map(s => statusMeta(s)?.label ?? s).join(' + ');
  const color = filter.statuses.length === 1 ? statusMeta(filter.statuses[0])?.color : undefined;
  const shownSelected = shown.filter(i => selected.has(i.id!)).length;
  const allSelected = shown.length > 0 && shownSelected === shown.length;
  const filtered = filter.statuses.length > 0 || filter.spaceIds.length > 0;

  const selectAll = useRef<HTMLInputElement>(null);
  const head = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = shownSelected > 0 && shownSelected < shown.length; }, [shownSelected, shown.length]);

  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev);
    shown.forEach(i => (allSelected ? next.delete(i.id!) : next.add(i.id!)));
    return next;
  });
  const toggleOne = (i: Issue) => setSelected(prev => {
    const next = new Set(prev);
    if (!next.delete(i.id!)) next.add(i.id!);
    return next;
  });

  if (list.length === 0) {
    return (
      <div className="bg-white border border-dashed border-lira-border rounded-lg py-12 text-center text-sm text-lira-muted">
        No tickets in {sprintName(sprint)}{scope !== 'all' ? ' for this space' : ''}.
        {phase !== 'past' && ' Create one, or move tickets here from another sprint.'}
      </div>
    );
  }

  return (
    <div className="bg-white border border-lira-border rounded-lg overflow-hidden" data-testid="ticket-box">
      <div ref={head} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 bg-gray-50 border-b border-lira-border">
        <button
          type="button"
          aria-label={collapsed ? 'Show the tickets' : 'Hide the tickets'}
          aria-expanded={!collapsed}
          onClick={e => keepPlace(e.currentTarget, onToggleCollapsed)}
          className="p-0.5 rounded hover:bg-gray-200 cursor-pointer"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
        </button>
        <input
          ref={selectAll}
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          disabled={visible.length === 0}
          aria-label={allSelected ? 'Deselect all tickets' : 'Select all tickets'}
          title={allSelected ? 'Deselect all' : 'Select all'}
          data-testid="select-all"
          className="cursor-pointer"
        />
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color }} data-testid="ticket-box-title">{title}</h3>
        <span className="text-xs text-lira-muted" data-testid="filter-count">{visible.length}{filtered ? ` of ${list.length}` : ''}</span>
        {filter.statuses.length === 1 && filter.statuses[0] === 'done' && <span className="text-[10px] text-lira-muted">stays in this sprint when it closes</span>}
        <div className="ml-auto">
          <SprintFilter spaces={filterSpaces} value={filter} onChange={v => (head.current ? keepPlace(head.current, () => onFilterChange(v)) : onFilterChange(v))} />
        </div>
      </div>
      {!collapsed && (visible.length === 0
        ? <p className="px-4 py-8 text-center text-sm text-lira-muted">No tickets match this filter.</p>
        : shown.map(i => (
          <TicketRow key={i.id} issue={i} space={spaceById.get(i.spaceId)} showSpace={scope === 'all'} sprintOptions={keys} selected={selected.has(i.id!)} onToggleSelect={toggleOne} onClick={onIssueClick} />
        )))}
    </div>
  );
}
