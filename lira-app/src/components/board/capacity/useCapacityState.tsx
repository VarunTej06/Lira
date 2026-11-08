import { useMemo, useState } from 'react';
import type { Issue } from '../../../types/issue';
import type { Space } from '../../../types/space';

export interface CapacityViewProps {
  issues: Issue[];
  space: Space | undefined;
  onIssueClick?: (issue: Issue) => void;
  searchQuery?: string;
  filterAssignee?: boolean;
  activeFilters?: { priorities: string[]; labels: string[] };
  groupBy?: 'status' | 'assignee' | 'priority' | 'epic';
}

export interface MemberWorkload {
  name: string;
  initials: string;
  avatarColor: string;
  total: number;
  backlog: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
  storyPoints: number;
  issues: Issue[];
}

/** Workload per person, filters and grouping of the capacity view. */
export function useCapacityState(props: CapacityViewProps) {
  const {
    issues,
    space,
    onIssueClick,
    searchQuery = '',
    filterAssignee = false,
    activeFilters,
    groupBy = 'assignee',
  } = props;
  const [localQuickFilter, setLocalQuickFilter] = useState<'all' | 'vy' | 'inprogress' | 'high' | 'overdue'>('all');
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string | null>(null);

  // 1. Apply Active Filters & Quick Filters
  const filteredIssues = useMemo(() => {
    let list = issues;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.key.toLowerCase().includes(q) ||
        i.labels?.some(l => l.toLowerCase().includes(q))
      );
    }

    // Top-bar Assignee toggle
    if (filterAssignee) {
      list = list.filter(i => i.assigneeInitials === 'VY' || i.assignee === 'Varun Tej');
    }

    // Priority filter from popover
    if (activeFilters?.priorities && activeFilters.priorities.length > 0) {
      list = list.filter(i => activeFilters.priorities.includes(i.priority));
    }

    // Label filter from popover
    if (activeFilters?.labels && activeFilters.labels.length > 0) {
      list = list.filter(i => i.labels?.some(l => activeFilters.labels.includes(l)));
    }

    // In-view member filter
    if (selectedAssigneeFilter) {
      list = list.filter(i => (i.assigneeInitials || i.assignee) === selectedAssigneeFilter);
    }

    // Quick filter chips inside Capacity view
    if (localQuickFilter === 'vy') {
      list = list.filter(i => i.assigneeInitials === 'VY' || i.assignee === 'Varun Tej');
    } else if (localQuickFilter === 'inprogress') {
      list = list.filter(i => i.status === 'inprogress');
    } else if (localQuickFilter === 'high') {
      list = list.filter(i => i.priority === 'high' || i.priority === 'highest');
    } else if (localQuickFilter === 'overdue') {
      const now = new Date();
      list = list.filter(i => i.status !== 'done' && i.dueDate && new Date(i.dueDate) < now);
    }

    return list;
  }, [issues, searchQuery, filterAssignee, activeFilters, selectedAssigneeFilter, localQuickFilter]);

  // 2. Compute Workloads & Metrics
  const { workloads, teamTotal, teamDone, teamInProgress, teamPoints, totalOverdue } = useMemo(() => {
    const memberMap: Record<string, MemberWorkload> = {};
    const now = new Date();
    let totalOverdue = 0;

    filteredIssues.forEach(issue => {
      const initials = issue.assigneeInitials || (issue.assignee ? issue.assignee.slice(0, 2).toUpperCase() : 'UN');
      const name = issue.assignee || 'Unassigned';

      if (!memberMap[initials]) {
        memberMap[initials] = {
          name,
          initials,
          avatarColor: initials === 'VY' ? '#0052CC' : initials === 'UN' ? '#6B778C' : '#00875A',
          total: 0,
          backlog: 0,
          todo: 0,
          inProgress: 0,
          done: 0,
          overdue: 0,
          storyPoints: 0,
          issues: [],
        };
      }

      const m = memberMap[initials];
      m.total += 1;
      m.storyPoints += issue.storyPoints || 1;
      m.issues.push(issue);

      if (issue.status === 'done') m.done += 1;
      else if (issue.status === 'inprogress') m.inProgress += 1;
      else if (issue.status === 'todo') m.todo += 1;
      else m.backlog += 1;

      if (issue.status !== 'done' && issue.dueDate && new Date(issue.dueDate) < now) {
        m.overdue += 1;
        totalOverdue += 1;
      }
    });

    const workloads = Object.values(memberMap).sort((a, b) => b.total - a.total);
    const teamTotal = filteredIssues.length;
    const teamDone = filteredIssues.filter(i => i.status === 'done').length;
    const teamInProgress = filteredIssues.filter(i => i.status === 'inprogress').length;
    const teamPoints = filteredIssues.reduce((acc, i) => acc + (i.storyPoints || 1), 0);

    return { workloads, teamTotal, teamDone, teamInProgress, teamPoints, totalOverdue };
  }, [filteredIssues]);

  // 3. Status Grouping
  const statusGroups = useMemo(() => {
    const statuses = [
      { id: 'backlog', label: 'Backlog Pool', desc: 'Items awaiting refinement & sprint commitment', dot: '#6B778C', color: 'border-slate-200 bg-white' },
      { id: 'todo', label: 'Ready (To Do)', desc: 'Prioritized & groomed items ready for active pickup', dot: '#172B4D', color: 'border-blue-200 bg-white' },
      { id: 'inprogress', label: 'In Flight (In Progress)', desc: 'Active development and implementation', dot: '#FFAB00', color: 'border-amber-200 bg-white' },
      { id: 'done', label: 'Completed (Done)', desc: 'Verified, tested, and resolved work items', dot: '#36B37E', color: 'border-emerald-200 bg-white' },
    ];
    return statuses.map(s => {
      const items = filteredIssues.filter(i => i.status === s.id);
      const points = items.reduce((sum, i) => sum + (i.storyPoints || 1), 0);
      const pct = teamPoints > 0 ? Math.round((points / teamPoints) * 100) : 0;
      return { ...s, items, points, pct };
    });
  }, [filteredIssues, teamPoints]);

  // 4. Priority Grouping
  const priorityGroups = useMemo(() => {
    const groups = [
      { id: 'highest', label: 'Highest Priority', dot: '#EF4444', color: 'border-red-200 bg-white', badge: 'bg-red-50 text-red-700' },
      { id: 'high', label: 'High Priority', dot: '#F97316', color: 'border-orange-200 bg-white', badge: 'bg-orange-50 text-orange-700' },
      { id: 'medium', label: 'Medium Priority', dot: '#FBBF24', color: 'border-amber-200 bg-white', badge: 'bg-amber-50 text-amber-700' },
      { id: 'low', label: 'Low / Lowest Priority', dot: '#34D399', color: 'border-emerald-200 bg-white', badge: 'bg-emerald-50 text-emerald-700' },
    ];
    return groups.map(g => {
      const items = filteredIssues.filter(i =>
        g.id === 'low' ? (i.priority === 'low' || i.priority === 'lowest') : i.priority === g.id
      );
      const points = items.reduce((a, b) => a + (b.storyPoints || 1), 0);
      return { ...g, items, points };
    });
  }, [filteredIssues]);

  // 5. Epic Grouping
  const epicGroups = useMemo(() => {
    const epics = issues.filter(i => i.type === 'epic');
    return epics.map(epic => {
      const children = filteredIssues.filter(i => i.parentId === epic.id || i.epicId === epic.id);
      const done = children.filter(c => c.status === 'done').length;
      const progress = children.length > 0 ? Math.round((done / children.length) * 100) : (epic.status === 'done' ? 100 : 0);
      const points = children.reduce((sum, c) => sum + (c.storyPoints || 1), 0);
      return { epic, children, done, progress, points };
    }).filter(eg => eg.children.length > 0 || issues.some(i => i.id === eg.epic.id));
  }, [issues, filteredIssues]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filterAssignee ||
    (activeFilters?.priorities && activeFilters.priorities.length > 0) ||
    (activeFilters?.labels && activeFilters.labels.length > 0) ||
    selectedAssigneeFilter !== null ||
    localQuickFilter !== 'all';

  return {
    issues,
    space,
    onIssueClick,
    searchQuery,
    filterAssignee,
    activeFilters,
    groupBy,
    localQuickFilter,
    setLocalQuickFilter,
    selectedAssigneeFilter,
    setSelectedAssigneeFilter,
    filteredIssues,
    statusGroups,
    priorityGroups,
    epicGroups,
    hasActiveFilters,
    workloads,
    teamTotal,
    teamDone,
    teamInProgress,
    teamPoints,
    totalOverdue,
  };
}

export type CapacityState = ReturnType<typeof useCapacityState>;
