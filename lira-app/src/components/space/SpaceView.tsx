import { EMPTY_SPACE_FILTERS, type SpaceFilters } from '../../utils/spaceFilters';
import { Construction } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BoardActionBar } from '../board/BoardActionBar';
import { KanbanBoard } from '../board/KanbanBoard';
import { SummaryView } from '../board/SummaryView';
import { CapacityView } from '../board/CapacityView';
import { ListView } from '../layout/ListView';
import { CalendarView } from '../layout/CalendarView';
import { SprintsPage } from '../sprints/SprintsPage';
import { SprintFilterBar } from '../sprints/sprintParts';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { spacePath } from '../../routes';

type GroupBy = 'status' | 'assignee' | 'priority' | 'epic';

interface SpaceViewProps {
  space: Space;
  spaces: Space[];
  tab: string;                                   // Summary | Board | List | Calendar | Sprints | Capacity | ...
  onTabChange: (tab: string) => void;
  /** This space's tickets, narrowed by the sprint filter. */
  issues: Issue[];
  allIssues: Issue[];
  sprintKeys: string[];
  sprintFilter: string;
  onSprintFilterChange: (key: string) => void;
  onIssueClick: (issue: Issue) => void;
  onAddIssue: (status: string, opts?: { sprint?: string; spaceId?: number; chooseSpace?: boolean }) => void;
  onOpenAllTickets: () => void;
  isHidden: boolean;
  isArchived: boolean;
  onToggleHide: () => void;
  onToggleArchive: () => void;
  onEditSpace: () => void;
}

/** One space: the action bar with its tabs, and the view of the chosen tab (board, list, calendar, summary, sprints, capacity). */
export function SpaceView(p: SpaceViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SpaceFilters>(EMPTY_SPACE_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const { space, tab, issues } = p;

  const availableLabels = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => i.labels?.forEach(l => set.add(l)));
    return Array.from(set);
  }, [issues]);

  const known = ['Board', 'List', 'Calendar', 'Summary', 'Capacity', 'Sprints'];

  return (
    <>
      <BoardActionBar
        space={space}
        issues={issues}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterAssignee={filterAssignee}
        onFilterAssigneeToggle={() => setFilterAssignee(f => !f)}
        activeTab={tab}
        onTabChange={p.onTabChange}
        onFilterChange={setActiveFilters}
        onGroupChange={setGroupBy}
        onClearFilters={() => setActiveFilters(EMPTY_SPACE_FILTERS)}
        availableLabels={availableLabels}
        isSpaceHidden={p.isHidden}
        isSpaceArchived={p.isArchived}
        onToggleHideSpace={p.onToggleHide}
        onToggleArchiveSpace={p.onToggleArchive}
        onEditSpace={p.onEditSpace}
      />

      {['Board', 'List', 'Calendar', 'Summary'].includes(tab) && (
        <SprintFilterBar value={p.sprintFilter} options={p.sprintKeys} onChange={p.onSprintFilterChange} onManage={() => p.onTabChange('Sprints')} />
      )}

      {tab === 'Sprints' && (
        <SprintsPage
          key={space.id}
          spaces={p.spaces}
          issues={p.allIssues}
          lockedSpaceId={space.id}
          onIssueClick={p.onIssueClick}
          onAddIssue={p.onAddIssue}
          onOpenAllTickets={p.onOpenAllTickets}
        />
      )}

      {tab === 'Board' && (
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          <KanbanBoard
            issues={issues}
            space={space}
            searchQuery={searchQuery}
            filterAssignee={filterAssignee}
            onIssueClick={p.onIssueClick}
            onAddIssue={p.onAddIssue}
            activeFilters={activeFilters}
            groupBy={groupBy}
          />
        </div>
      )}

      {tab === 'List' && (
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          <ListView issues={issues} space={space} onSelectIssue={p.onIssueClick} searchQuery={searchQuery} activeFilters={activeFilters} />
        </div>
      )}

      {tab === 'Calendar' && (
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          <CalendarView issues={issues} space={space} onSelectIssue={p.onIssueClick} />
        </div>
      )}

      {tab === 'Summary' && <SummaryView issues={issues} space={space} onIssueClick={p.onIssueClick} />}

      {tab === 'Capacity' && (
        <CapacityView
          issues={issues}
          space={space}
          onIssueClick={p.onIssueClick}
          searchQuery={searchQuery}
          filterAssignee={filterAssignee}
          activeFilters={activeFilters}
          groupBy={groupBy}
        />
      )}

      {!known.includes(tab) && (
        <div className="flex-1 flex items-center justify-center bg-lira-bg">
          <div className="text-center space-y-3">
            <Construction className="w-12 h-12 mx-auto text-lira-muted" />
            <p className="text-lira-muted text-sm font-medium">{tab} view — coming soon</p>
            <Link to={spacePath(space.key, 'Board')} className="text-lira-blue text-sm hover:underline cursor-pointer">Back to Board</Link>
          </div>
        </div>
      )}
    </>
  );
}
