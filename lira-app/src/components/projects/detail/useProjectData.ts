import { useMemo, useState } from 'react';
import type { Project } from '../../../types/project';
import type { Issue } from '../../../types/issue';
import { allSprintKeys, getIssueSprint } from '../../../utils/sprintUtils';
import type { TicketSubTab } from './types';

/** The project's tickets and everything derived from them: stats, priorities, recent activity, board and ticket-list filters. */
export function useProjectData(project: Project, issues: Issue[]) {
  // Filter issues for this project: match spaceId or issue key prefix
  const projectIssues = useMemo(() => {
    return issues.filter(i => {
      if (project.spaceId && i.spaceId === project.spaceId) return true;
      if (project.key && i.key.startsWith(`${project.key}-`)) return true;
      return false;
    });
  }, [issues, project.spaceId, project.key]);

  // Project progress & stats calculation
  const stats = useMemo(() => {
    const total = projectIssues.length;
    const done = projectIssues.filter(i => i.status.toLowerCase() === 'done').length;
    const inProgress = projectIssues.filter(i => i.status.toLowerCase() === 'inprogress').length;
    const todo = projectIssues.filter(i => i.status.toLowerCase() === 'todo').length;
    const backlog = projectIssues.filter(i => i.status.toLowerCase() === 'backlog').length;
    const open = backlog + todo + inProgress;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, todo, backlog, open, percent };
  }, [projectIssues]);

  // Project initials for icon
  const projectInitials = useMemo(() => {
    const words = project.name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return project.name.slice(0, 2).toUpperCase() || project.key.slice(0, 2).toUpperCase() || 'PR';
  }, [project.name, project.key]);

  // Priority counts for Tab 1
  const priorityCounts = useMemo(() => {
    const counts = { highest: 0, high: 0, medium: 0, low: 0, lowest: 0 };
    projectIssues.forEach(i => {
      const p = (i.priority || 'medium').toLowerCase() as keyof typeof counts;
      if (counts[p] !== undefined) {
        counts[p]++;
      } else {
        counts.medium++;
      }
    });
    return counts;
  }, [projectIssues]);

  // Recent 5 activity issues for Tab 1
  const recentIssues = useMemo(() => {
    const copy = [...projectIssues];
    copy.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    });
    return copy.slice(0, 5);
  }, [projectIssues]);

  // ── Tab 2: Board Filters ──
  const [boardSearchQuery, setBoardSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState(false);
  const [boardPriorityFilter, setBoardPriorityFilter] = useState('');

  const boardActiveFilters = useMemo(() => ({
    priorities: boardPriorityFilter ? [boardPriorityFilter] : [],
    labels: [],
  }), [boardPriorityFilter]);

  // ── Tab 3: Tickets View State ──
  const [ticketSubTab, setTicketSubTab] = useState<TicketSubTab>('all');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketSprint, setTicketSprint] = useState('all');
  const [boardSprint, setBoardSprint] = useState('all');
  const boardIssues = useMemo(
    () => boardSprint === 'all' ? projectIssues : projectIssues.filter(i => i.type === 'epic' || getIssueSprint(i) === boardSprint),
    [projectIssues, boardSprint]
  );
  const sprintKeys = useMemo(() => allSprintKeys(projectIssues), [projectIssues]);

  const ticketCounts = useMemo(() => {
    return {
      all: projectIssues.length,
      open: projectIssues.filter(i => ['backlog', 'todo', 'inprogress'].includes(i.status.toLowerCase())).length,
      completed: projectIssues.filter(i => i.status.toLowerCase() === 'done').length,
      high_priority: projectIssues.filter(i => ['highest', 'high'].includes(i.priority?.toLowerCase())).length,
      my_tasks: projectIssues.filter(i => {
        const a = (i.assignee || '').toLowerCase();
        const init = (i.assigneeInitials || '').toUpperCase();
        return a.includes('varun') || a.includes('tej') || init === 'VY' || a === 'vy';
      }).length,
    };
  }, [projectIssues]);

  const ticketsToDisplay = useMemo(() => {
    let list = projectIssues;
    switch (ticketSubTab) {
      case 'open':
        list = list.filter(i => ['backlog', 'todo', 'inprogress'].includes(i.status.toLowerCase()));
        break;
      case 'completed':
        list = list.filter(i => i.status.toLowerCase() === 'done');
        break;
      case 'high_priority':
        list = list.filter(i => ['highest', 'high'].includes(i.priority?.toLowerCase()));
        break;
      case 'my_tasks':
        list = list.filter(i => {
          const a = (i.assignee || '').toLowerCase();
          const init = (i.assigneeInitials || '').toUpperCase();
          return a.includes('varun') || a.includes('tej') || init === 'VY' || a === 'vy';
        });
        break;
      case 'all':
      default:
        break;
    }

    if (ticketSprint !== 'all') {
      list = list.filter(i => i.type !== 'epic' && getIssueSprint(i) === ticketSprint);
    }

    if (ticketSearch.trim()) {
      const q = ticketSearch.toLowerCase();
      list = list.filter(i =>
        i.key.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        (i.assignee && i.assignee.toLowerCase().includes(q))
      );
    }

    return list;
  }, [projectIssues, ticketSubTab, ticketSearch, ticketSprint]);

  return {
    projectIssues,
    stats,
    projectInitials,
    priorityCounts,
    recentIssues,
    boardSearchQuery,
    setBoardSearchQuery,
    filterAssignee,
    setFilterAssignee,
    boardPriorityFilter,
    setBoardPriorityFilter,
    boardActiveFilters,
    ticketSubTab,
    setTicketSubTab,
    ticketSearch,
    setTicketSearch,
    ticketSprint,
    setTicketSprint,
    boardSprint,
    setBoardSprint,
    boardIssues,
    sprintKeys,
    ticketCounts,
    ticketsToDisplay,
  };
}

export type ProjectData = ReturnType<typeof useProjectData>;
