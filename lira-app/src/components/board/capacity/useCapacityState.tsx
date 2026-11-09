import { type SpaceFilters } from '../../../utils/spaceFilters';
import { useMemo, useState } from 'react';
import type { Issue } from '../../../types/issue';
import type { Space } from '../../../types/space';
import { currentTime } from '../../../utils/clock';
import {
  buildWorkloads, filterCapacityIssues, groupByEpic, groupByPriority, groupByStatus, hasCapacityFilters, teamTotals,
  type CapacityFilter, type QuickFilter,
} from '../../../utils/capacity';

export interface CapacityViewProps {
  issues: Issue[];
  space: Space | undefined;
  onIssueClick?: (issue: Issue) => void;
  searchQuery?: string;
  filterAssignee?: boolean;
  activeFilters?: SpaceFilters;
  groupBy?: 'status' | 'assignee' | 'priority' | 'epic';
}

/** Workload per person, filters and grouping of the capacity view. */
export function useCapacityState(props: CapacityViewProps) {
  const { issues, space, onIssueClick, searchQuery = '', filterAssignee = false, activeFilters, groupBy = 'assignee' } = props;
  const [localQuickFilter, setLocalQuickFilter] = useState<QuickFilter>('all');
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string | null>(null);
  const filter: CapacityFilter = { searchQuery, mineOnly: filterAssignee, active: activeFilters, assignee: selectedAssigneeFilter, quick: localQuickFilter };

  const filteredIssues = useMemo(
    () => filterCapacityIssues(issues, { searchQuery, mineOnly: filterAssignee, active: activeFilters, assignee: selectedAssigneeFilter, quick: localQuickFilter }, currentTime()),
    [issues, searchQuery, filterAssignee, activeFilters, selectedAssigneeFilter, localQuickFilter],
  );
  const { workloads, totalOverdue } = useMemo(() => buildWorkloads(filteredIssues, currentTime()), [filteredIssues]);
  const totals = useMemo(() => teamTotals(filteredIssues), [filteredIssues]);
  const statusGroups = useMemo(() => groupByStatus(filteredIssues, totals.teamPoints), [filteredIssues, totals.teamPoints]);
  const priorityGroups = useMemo(() => groupByPriority(filteredIssues), [filteredIssues]);
  const epicGroups = useMemo(() => groupByEpic(issues, filteredIssues), [issues, filteredIssues]);

  return {
    issues, space, onIssueClick, searchQuery, filterAssignee, activeFilters, groupBy,
    localQuickFilter, setLocalQuickFilter, selectedAssigneeFilter, setSelectedAssigneeFilter,
    filteredIssues, statusGroups, priorityGroups, epicGroups, hasActiveFilters: hasCapacityFilters(filter),
    workloads, totalOverdue, ...totals,
  };
}

export type CapacityState = ReturnType<typeof useCapacityState>;
