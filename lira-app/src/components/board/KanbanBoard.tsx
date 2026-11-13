import React, { useState, useMemo, useEffect } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { BoardColumn } from './BoardColumn';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { moveIssue, updateIssue } from '../../hooks/useIssues';
import type { SpaceFilters } from '../../utils/spaceFilters';
import { columnIdFor, columnsFor, filterBoardIssues, groupIntoColumns, loadWipLimits, rankForDrop, wipLimitFor, type GroupBy } from './boardColumns';
import { useBoardScroll } from './useBoardScroll';
import { useResetWhen } from '../../hooks/useResetWhen';

interface KanbanBoardProps {
  issues: Issue[];
  space: Space | undefined;
  searchQuery: string;
  filterAssignee: boolean;
  onIssueClick: (issue: Issue) => void;
  onAddIssue: (status: string) => void;
  activeFilters?: SpaceFilters;
  groupBy?: GroupBy;
}

const initialsOf = (name: string) => (name === 'Varun Tej' ? 'VY' : name.split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2));

/** Saves a card dropped in `columnId`: what that means depends on what the board is grouped by. */
async function saveDrop(issueId: number, columnId: string, groupBy: GroupBy, siblings: Issue[], index: number) {
  if (groupBy === 'priority') return updateIssue(issueId, { priority: columnId as Issue['priority'] });
  if (groupBy === 'assignee') {
    return columnId === 'Unassigned'
      ? updateIssue(issueId, { assignee: undefined, assigneeInitials: undefined })
      : updateIssue(issueId, { assignee: columnId, assigneeInitials: initialsOf(columnId) });
  }
  if (groupBy === 'epic') return updateIssue(issueId, { epicId: columnId === 'no-epic' ? undefined : parseInt(columnId.replace('epic-', ''), 10) });
  return moveIssue(issueId, columnId, rankForDrop(siblings, index));
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  issues, space, searchQuery, filterAssignee, onIssueClick, onAddIssue, activeFilters, groupBy = 'status',
}) => {
  const { boardRef, startDrag, stopDrag, boardProps } = useBoardScroll();
  // Where a card was just dropped, until the database catches up (so it does not jump back for a moment)
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<number, string>>({});
  const [wipLimits, setWipLimits] = useState(loadWipLimits);
  const [boardContentHeight, setBoardContentHeight] = useState(700);

  useEffect(() => {
    const reload = () => setWipLimits(loadWipLimits());
    window.addEventListener('lira_wip_limits_changed', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('lira_wip_limits_changed', reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const activeColumns = useMemo(() => columnsFor(groupBy, issues), [groupBy, issues]);
  const filteredIssues = useMemo(() => filterBoardIssues(issues, searchQuery, filterAssignee, activeFilters), [issues, searchQuery, filterAssignee, activeFilters]);
  const issuesByColumn = useMemo(() => groupIntoColumns(activeColumns, filteredIssues, groupBy, optimisticUpdates), [activeColumns, filteredIssues, groupBy, optimisticUpdates]);

  // Forget a drop once the real data shows the ticket in its new column
  useResetWhen([issues, groupBy], () => {
    setOptimisticUpdates(prev => {
      const caughtUp = Object.keys(prev).map(Number).filter(id => {
        const match = issues.find(i => i.id === id);
        return match && columnIdFor(match, groupBy) === prev[id];
      });
      if (caughtUp.length === 0) return prev;
      const next = { ...prev };
      caughtUp.forEach(id => delete next[id]);
      return next;
    });
  });

  // The columns are at least as tall as the board and as the fullest column
  useEffect(() => {
    const measure = () => {
      const el = boardRef.current;
      if (el) setBoardContentHeight(Math.max(el.scrollHeight - 40, el.clientHeight - 40, 700));
    };
    measure();
    const timer = setTimeout(measure, 50);
    const observer = new ResizeObserver(measure);
    if (boardRef.current) observer.observe(boardRef.current);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [boardRef, issues, filteredIssues]);

  const fullest = Math.max(...Object.values(issuesByColumn).map(list => list.length), 3);
  const columnMinHeight = Math.max(boardContentHeight, fullest * 175 + 100, 700);

  const handleDragEnd = async ({ destination, source, draggableId }: DropResult) => {
    stopDrag();
    const issueId = parseInt(draggableId, 10);
    if (!destination || isNaN(issueId)) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const columnId = destination.droppableId;
    setOptimisticUpdates(prev => ({ ...prev, [issueId]: columnId }));
    try {
      await saveDrop(issueId, columnId, groupBy, (issuesByColumn[columnId] || []).filter(i => i.id !== issueId), destination.index);
    } catch (err) {
      console.error('Failed to move/update issue:', err);
      setOptimisticUpdates(({ [issueId]: _undone, ...rest }) => rest);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      <DragDropContext onDragStart={startDrag} onDragEnd={handleDragEnd}>
        <div ref={boardRef} {...boardProps} className="w-full h-full overflow-y-auto overflow-x-auto p-4 pr-5 lira-board-scrollbar">
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
                // A new ticket from a column of any other grouping always starts as To Do
                onAddIssue={status => onAddIssue(groupBy === 'status' ? status : 'todo')}
                accentColor={col.accentColor}
                minHeight={columnMinHeight}
                wipLimit={wipLimitFor(wipLimits, col.id, col.title)}
              />
            ))}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};
