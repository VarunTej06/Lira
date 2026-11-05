import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { BoardColumn } from './BoardColumn';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { moveIssue, updateIssue } from '../../hooks/useIssues';

interface KanbanBoardProps {
  issues: Issue[];
  space: Space | undefined;
  searchQuery: string;
  filterAssignee: boolean;
  onIssueClick: (issue: Issue) => void;
  onAddIssue: (status: string) => void;
  activeFilters?: { priorities: string[]; labels: string[] };
  groupBy?: 'status' | 'assignee' | 'priority' | 'epic';
}

const STATUS_COLUMNS = [
  { id: 'backlog', title: 'Backlog', accentColor: '#6B778C' },
  { id: 'todo', title: 'To Do', accentColor: '#172B4D' },
  { id: 'inprogress', title: 'In Progress', accentColor: '#0052CC' },
  { id: 'done', title: 'Done', accentColor: '#006644' },
];

const PRIORITY_COLUMNS = [
  { id: 'highest', title: 'Highest', accentColor: '#FF0000' },
  { id: 'high', title: 'High', accentColor: '#FF5630' },
  { id: 'medium', title: 'Medium', accentColor: '#FF8B00' },
  { id: 'low', title: 'Low', accentColor: '#36B37E' },
  { id: 'lowest', title: 'Lowest', accentColor: '#00B8D9' },
];

function loadWipLimitsFromStorage(): Record<string, number> {
  try {
    const raw = localStorage.getItem('lira_wip_limits');
    if (!raw) return {};
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
    // Backward compatibility for boolean string
    if (raw === 'true') {
      const cfg = localStorage.getItem('lira_wip_config');
      if (cfg) return JSON.parse(cfg).limits || {};
    }
    return {};
  } catch {
    return {};
  }
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  issues,
  space,
  searchQuery,
  filterAssignee,
  onIssueClick,
  onAddIssue,
  activeFilters,
  groupBy = 'status',
}) => {
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<number, string>>({});
  const boardRef = useRef<HTMLDivElement>(null);
  const isDraggingCardRef = useRef(false);
  const isPanningRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // ── Read WIP Limits from localStorage `lira_wip_limits` ──
  const [wipLimits, setWipLimits] = useState<Record<string, number>>(() => loadWipLimitsFromStorage());

  useEffect(() => {
    const handler = () => {
      setWipLimits(loadWipLimitsFromStorage());
    };
    window.addEventListener('lira_wip_limits_changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('lira_wip_limits_changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const getColWipLimit = (colId: string, colTitle: string): number | undefined => {
    const keys = [
      colId,
      colId.toLowerCase(),
      colTitle,
      colTitle.toLowerCase(),
      colTitle.toLowerCase().replace(/\s+/g, ''),
    ];
    for (const k of keys) {
      if (typeof wipLimits[k] === 'number' && wipLimits[k] > 0) {
        return wipLimits[k];
      }
    }
    return undefined;
  };

  // ── Compute Columns based on groupBy ──
  const assigneeColumns = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => {
      const name = i.assignee?.trim();
      if (name) set.add(name);
    });

    if (!set.has('Varun Tej')) set.add('Varun Tej');
    set.add('Unassigned');

    const ASSIGNEE_COLORS = ['#0052CC', '#6554C0', '#00B8D9', '#36B37E', '#FF8B00', '#FF5630', '#8777D9'];
    return Array.from(set).map((assignee, idx) => ({
      id: assignee,
      title: assignee,
      accentColor: assignee === 'Unassigned' ? '#6B778C' : ASSIGNEE_COLORS[idx % ASSIGNEE_COLORS.length],
    }));
  }, [issues]);

  const epicColumns = useMemo(() => {
    const epics = issues.filter(i => i.type === 'epic');
    const cols = epics.map(e => ({
      id: `epic-${e.id}`,
      title: `${e.key}: ${e.title}`,
      accentColor: '#6554C0',
    }));
    cols.push({
      id: 'no-epic',
      title: 'No Epic / Standalone',
      accentColor: '#6B778C',
    });
    return cols;
  }, [issues]);

  const activeColumns = useMemo(() => {
    if (groupBy === 'priority') return PRIORITY_COLUMNS;
    if (groupBy === 'assignee') return assigneeColumns;
    if (groupBy === 'epic') return epicColumns;
    return STATUS_COLUMNS;
  }, [groupBy, assigneeColumns, epicColumns]);

  // ── Filtered Issues ──
  const filteredIssues = useMemo(() => {
    let filtered = issues;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.key.toLowerCase().includes(q) ||
        i.labels.some(l => l.toLowerCase().includes(q))
      );
    }

    if (filterAssignee) {
      filtered = filtered.filter(i => i.assigneeInitials === 'VY');
    }

    // Apply priority filters if any selected
    if (activeFilters?.priorities && activeFilters.priorities.length > 0) {
      filtered = filtered.filter(i => activeFilters.priorities.includes(i.priority));
    }

    // Apply label filters if any selected
    if (activeFilters?.labels && activeFilters.labels.length > 0) {
      filtered = filtered.filter(i => i.labels.some(l => activeFilters.labels.includes(l)));
    }

    return filtered;
  }, [issues, searchQuery, filterAssignee, activeFilters]);

  // ── Group Issues into Columns ──
  const issuesByColumn = useMemo(() => {
    const columnsMap: Record<string, Issue[]> = {};
    activeColumns.forEach(col => {
      columnsMap[col.id] = [];
    });

    filteredIssues.forEach(issue => {
      let colId: string;
      if (groupBy === 'priority') {
        colId = optimisticUpdates[issue.id!] || issue.priority || 'medium';
      } else if (groupBy === 'assignee') {
        colId = optimisticUpdates[issue.id!] || issue.assignee?.trim() || 'Unassigned';
      } else if (groupBy === 'epic') {
        const epicKey = issue.epicId ? `epic-${issue.epicId}` : 'no-epic';
        colId = optimisticUpdates[issue.id!] || epicKey;
      } else {
        colId = optimisticUpdates[issue.id!] || issue.status || 'todo';
      }

      if (columnsMap[colId]) {
        columnsMap[colId].push(issue);
      } else {
        if (!columnsMap[colId]) columnsMap[colId] = [];
        columnsMap[colId].push(issue);
      }
    });

    Object.keys(columnsMap).forEach(key => {
      columnsMap[key].sort((a, b) => a.rank - b.rank);
    });

    return columnsMap;
  }, [activeColumns, filteredIssues, groupBy, optimisticUpdates]);

  // Clean up optimistic update entries once real live query catches up
  useEffect(() => {
    setOptimisticUpdates(prev => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      keys.forEach(k => {
        const id = Number(k);
        const match = issues.find(i => i.id === id);
        if (match) {
          const currentVal = groupBy === 'priority'
            ? match.priority
            : groupBy === 'assignee'
            ? (match.assignee?.trim() || 'Unassigned')
            : match.status;
          if (currentVal === prev[id]) {
            delete next[id];
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [issues, groupBy]);

  const [boardContentHeight, setBoardContentHeight] = useState(700);

  // Measure board scroll height and client height dynamically
  useEffect(() => {
    const updateHeight = () => {
      if (boardRef.current) {
        const sh = boardRef.current.scrollHeight;
        const ch = boardRef.current.clientHeight;
        setBoardContentHeight(Math.max(sh - 40, ch - 40, 700));
      }
    };
    updateHeight();
    const timer = setTimeout(updateHeight, 50);
    const ro = new ResizeObserver(updateHeight);
    if (boardRef.current) ro.observe(boardRef.current);
    window.addEventListener('resize', updateHeight);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [issues, filteredIssues]);

  const maxIssuesCount = useMemo(() => {
    return Math.max(...Object.values(issuesByColumn).map(list => list.length), 3);
  }, [issuesByColumn]);

  const calculatedMinHeight = Math.max(boardContentHeight, maxIssuesCount * 175 + 100, 700);

  // Auto-scroll board when dragging a card near viewport edges
  useEffect(() => {
    let animId: number | null = null;
    let scrollSpeedX = 0;
    let scrollSpeedY = 0;

    const onPointerMove = (e: MouseEvent) => {
      if (!isDraggingCardRef.current || !boardRef.current) {
        scrollSpeedX = 0;
        scrollSpeedY = 0;
        return;
      }

      const rect = boardRef.current.getBoundingClientRect();
      const edgeThresholdY = 100;
      const edgeThresholdX = 80;
      const maxSpeed = 22;

      // Vertical auto-scroll (top / bottom edges)
      if (e.clientY < rect.top + edgeThresholdY && e.clientY >= rect.top - 60) {
        const distance = Math.max(0, e.clientY - rect.top);
        const intensity = 1 - distance / edgeThresholdY;
        scrollSpeedY = -Math.round(intensity * maxSpeed + 3);
      } else if (e.clientY > rect.bottom - edgeThresholdY && e.clientY <= rect.bottom + 60) {
        const distance = Math.max(0, rect.bottom - e.clientY);
        const intensity = 1 - distance / edgeThresholdY;
        scrollSpeedY = Math.round(intensity * maxSpeed + 3);
      } else {
        scrollSpeedY = 0;
      }

      // Horizontal auto-scroll (left / right edges)
      if (e.clientX < rect.left + edgeThresholdX && e.clientX >= rect.left - 60) {
        const distance = Math.max(0, e.clientX - rect.left);
        const intensity = 1 - distance / edgeThresholdX;
        scrollSpeedX = -Math.round(intensity * maxSpeed + 3);
      } else if (e.clientX > rect.right - edgeThresholdX && e.clientX <= rect.right + 60) {
        const distance = Math.max(0, rect.right - e.clientX);
        const intensity = 1 - distance / edgeThresholdX;
        scrollSpeedX = Math.round(intensity * maxSpeed + 3);
      } else {
        scrollSpeedX = 0;
      }
    };

    const step = () => {
      if (isDraggingCardRef.current && boardRef.current && (scrollSpeedX !== 0 || scrollSpeedY !== 0)) {
        if (scrollSpeedY !== 0) boardRef.current.scrollTop += scrollSpeedY;
        if (scrollSpeedX !== 0) boardRef.current.scrollLeft += scrollSpeedX;
      }
      animId = requestAnimationFrame(step);
    };

    const onWindowMouseUp = () => {
      scrollSpeedX = 0;
      scrollSpeedY = 0;
    };

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('mouseup', onWindowMouseUp, { passive: true });
    animId = requestAnimationFrame(step);

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  const handleDragEnd = async (result: DropResult) => {
    isDraggingCardRef.current = false;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const issueId = parseInt(draggableId, 10);
    if (isNaN(issueId)) return;
    const targetColId = destination.droppableId;

    // Optimistically update in memory immediately
    setOptimisticUpdates(prev => ({ ...prev, [issueId]: targetColId }));

    try {
      if (groupBy === 'priority') {
        await updateIssue(issueId, { priority: targetColId as Issue['priority'] });
      } else if (groupBy === 'assignee') {
        if (targetColId === 'Unassigned') {
          await updateIssue(issueId, { assignee: undefined, assigneeInitials: undefined });
        } else {
          const initials = targetColId === 'Varun Tej'
            ? 'VY'
            : targetColId.split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2);
          await updateIssue(issueId, { assignee: targetColId, assigneeInitials: initials });
        }
      } else if (groupBy === 'epic') {
        const epicId = targetColId === 'no-epic' ? undefined : parseInt(targetColId.replace('epic-', ''), 10);
        await updateIssue(issueId, { epicId });
      } else {
        // Standard status movement
        const targetItems = (issuesByColumn[targetColId] || []).filter(i => i.id !== issueId);
        let newRank: number;

        if (targetItems.length === 0) {
          newRank = 1000;
        } else if (destination.index <= 0) {
          newRank = (targetItems[0]?.rank ?? 1000) - 100;
        } else if (destination.index >= targetItems.length) {
          newRank = (targetItems[targetItems.length - 1]?.rank ?? 1000) + 100;
        } else {
          const before = targetItems[destination.index - 1]?.rank ?? 1000;
          const after = targetItems[destination.index]?.rank ?? (before + 200);
          newRank = Math.floor((before + after) / 2);
          if (newRank === before || newRank === after) {
            newRank = before + 0.5;
          }
        }

        await moveIssue(issueId, targetColId, newRank);
      }
    } catch (err) {
      console.error('Failed to move/update issue:', err);
      // Revert optimistic update on failure
      setOptimisticUpdates(prev => {
        const next = { ...prev };
        delete next[issueId];
        return next;
      });
    }
  };

  // Mouse pan/drag handlers on board background
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingCardRef.current) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-rfd-draggable-id]') ||
      target.closest('[data-rfd-drag-handle-draggable-id]') ||
      target.closest('[data-rbd-draggable-id]') ||
      target.closest('.shadow-card') ||
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('[role="button"]')
    ) {
      return;
    }
    if (boardRef.current) {
      isPanningRef.current = true;
      startPosRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: boardRef.current.scrollLeft,
        scrollTop: boardRef.current.scrollTop,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current || !boardRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    boardRef.current.scrollLeft = startPosRef.current.scrollLeft - dx;
    boardRef.current.scrollTop = startPosRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.altKey && boardRef.current) {
      boardRef.current.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      <DragDropContext
        onDragStart={() => { isDraggingCardRef.current = true; }}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={boardRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full overflow-y-auto overflow-x-auto p-4 pr-5 lira-board-scrollbar"
        >
          <div className="flex gap-5 items-stretch min-w-max pb-36">
            {activeColumns.map(col => (
              <BoardColumn
                key={col.id}
                id={col.id}
                title={col.title}
                issues={issuesByColumn[col.id] || []}
                allIssues={issues}
                space={space}
                onIssueClick={onIssueClick}
                onAddIssue={(status) => {
                  if (groupBy === 'priority' || groupBy === 'assignee' || groupBy === 'epic') {
                    onAddIssue('todo');
                  } else {
                    onAddIssue(status);
                  }
                }}
                accentColor={col.accentColor}
                minHeight={calculatedMinHeight}
                wipLimit={getColWipLimit(col.id, col.title)}
              />
            ))}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};
