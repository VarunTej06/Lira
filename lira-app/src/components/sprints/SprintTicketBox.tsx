import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { keepPlace } from '../../utils/keepPlace';
import { sprintName } from '../../utils/sprintUtils';
import { SprintFilter } from './SprintFilter';
import { type SprintFilterValue } from './sprintFilterDefaults';
import { TicketRow } from './sprintParts';
import { boxColor, boxTitle, byStatusOrder, toggledId, visibleTickets, withIds } from './ticketBoxRules';

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

function EmptyBox({ sprint, scope, phase }: Pick<Props, 'sprint' | 'scope' | 'phase'>) {
  return (
    <div className="bg-white border border-dashed border-lira-border rounded-lg py-12 text-center text-sm text-lira-muted">
      No tickets in {sprintName(sprint)}{scope !== 'all' ? ' for this space' : ''}.
      {phase !== 'past' && ' Create one, or move tickets here from another sprint.'}
    </div>
  );
}

interface HeadingProps {
  title: string;
  color: string | undefined;
  count: string;
  doneNote: boolean;
  collapsed: boolean;
  allSelected: boolean;
  someSelected: boolean;
  nothingToSelect: boolean;
  filterSpaces: Space[];
  filter: SprintFilterValue;
  onToggleCollapsed: () => void;
  onToggleAll: () => void;
  onFilterChange: (value: SprintFilterValue) => void;
}

/** The heading row: fold button, select-all checkbox (half ticked for some), the title, the count and the filters. It keeps its place on screen when a filter changes the list. */
function BoxHeading({ title, color, count, doneNote, collapsed, allSelected, someSelected, nothingToSelect, filterSpaces, filter, onToggleCollapsed, onToggleAll, onFilterChange }: HeadingProps) {
  const selectAll = useRef<HTMLInputElement>(null);
  const head = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = someSelected; }, [someSelected]);
  return (
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
        onChange={onToggleAll}
        disabled={nothingToSelect}
        aria-label={allSelected ? 'Deselect all tickets' : 'Select all tickets'}
        title={allSelected ? 'Deselect all' : 'Select all'}
        data-testid="select-all"
        className="cursor-pointer"
      />
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color }} data-testid="ticket-box-title">{title}</h3>
      <span className="text-xs text-lira-muted" data-testid="filter-count">{count}</span>
      {doneNote && <span className="text-3xs text-lira-muted">stays in this sprint when it closes</span>}
      <div className="ml-auto">
        <SprintFilter spaces={filterSpaces} value={filter} onChange={v => (head.current ? keepPlace(head.current, () => onFilterChange(v)) : onFilterChange(v))} />
      </div>
    </div>
  );
}

/**
 * All the sprint's tickets in one box. The heading row has the select-all checkbox, a title that follows the Status filter,
 * and the Status and Space filters. The heading stays where it is on the screen when a filter changes the list.
 */
export function SprintTicketBox({ sprint, scope, keys, list, filterSpaces, spaceById, filter, onFilterChange, selected, setSelected, collapsed, onToggleCollapsed, phase, onIssueClick }: Props) {
  const visible = useMemo(() => visibleTickets(list, filter), [list, filter]);
  const shown = useMemo(() => byStatusOrder(visible), [visible]);
  const shownSelected = shown.filter(i => selected.has(i.id!)).length;
  const allSelected = shown.length > 0 && shownSelected === shown.length;
  const filtered = filter.statuses.length > 0 || filter.spaceIds.length > 0;

  if (list.length === 0) return <EmptyBox sprint={sprint} scope={scope} phase={phase} />;

  return (
    <div className="bg-white border border-lira-border rounded-lg overflow-hidden" data-testid="ticket-box">
      <BoxHeading
        title={boxTitle(filter.statuses)} color={boxColor(filter.statuses)} count={`${visible.length}${filtered ? ` of ${list.length}` : ''}`}
        doneNote={filter.statuses.length === 1 && filter.statuses[0] === 'done'} collapsed={collapsed}
        allSelected={allSelected} someSelected={shownSelected > 0 && shownSelected < shown.length} nothingToSelect={visible.length === 0}
        filterSpaces={filterSpaces} filter={filter} onToggleCollapsed={onToggleCollapsed} onFilterChange={onFilterChange}
        onToggleAll={() => setSelected(prev => withIds(prev, shown.map(i => i.id!), allSelected))}
      />
      {!collapsed && (visible.length === 0
        ? <p className="px-4 py-8 text-center text-sm text-lira-muted">No tickets match this filter.</p>
        : shown.map(i => (
          <TicketRow key={i.id} issue={i} space={spaceById.get(i.spaceId)} showSpace={scope === 'all'} sprintOptions={keys} selected={selected.has(i.id!)} onToggleSelect={x => setSelected(prev => toggledId(prev, x.id!))} onClick={onIssueClick} />
        )))}
    </div>
  );
}
