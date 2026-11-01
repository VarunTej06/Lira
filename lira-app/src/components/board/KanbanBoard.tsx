import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { BoardColumn } from './BoardColumn';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { moveIssue } from '../../hooks/useIssues';

interface KanbanBoardProps {
  issues: Issue[];
  space: Space | undefined;
  searchQuery: string;
  filterAssignee: boolean;
  onIssueClick: (issue: Issue) => void;
  onAddIssue: (status: string) => void;
}

const COLUMNS = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'To Do' },
  { id: 'inprogress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  issues,
  space,
  searchQuery,
  filterAssignee,
  onIssueClick,
  onAddIssue,
}) => {
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<number, string>>({});
  const boardRef = useRef<HTMLDivElement>(null);
  const isDraggingCardRef = useRef(false);
  const isPanningRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

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

    return filtered;
  }, [issues, searchQuery, filterAssignee]);

  const issuesByColumn = useMemo(() => {
    const columns: Record<string, Issue[]> = {};
    COLUMNS.forEach(col => {
      columns[col.id] = filteredIssues
        .filter(i => (optimisticUpdates[i.id!] || i.status) === col.id)
        .sort((a, b) => a.rank - b.rank);
    });
    return columns;
  }, [filteredIssues, optimisticUpdates]);

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
        if (match && match.status === prev[id]) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [issues]);

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

    const issueId = parseInt(draggableId);
    if (isNaN(issueId)) return;
    const newStatus = destination.droppableId;

    // Optimistically update status in memory immediately
    setOptimisticUpdates(prev => ({ ...prev, [issueId]: newStatus }));

    // Calculate new rank accurately (excluding the dragged issue itself from target column)
    const targetItems = (issuesByColumn[newStatus] || []).filter(i => i.id !== issueId);
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

    try {
      await moveIssue(issueId, newStatus, newRank);
    } catch (err) {
      console.error('Failed to move issue:', err);
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
    // Do not initiate board panning if clicking any card, drag handle, button, link, or input
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
            {COLUMNS.map(col => (
              <BoardColumn
                key={col.id}
                id={col.id}
                title={col.title}
                issues={issuesByColumn[col.id] || []}
                allIssues={issues}
                space={space}
                onIssueClick={onIssueClick}
                onAddIssue={onAddIssue}
                minHeight={calculatedMinHeight}
              />
            ))}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};

