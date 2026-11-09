import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { Issue } from '../../types/issue';
import { updateIssue } from '../../hooks/useIssues';
import { parseDueDateKey } from '../../utils/calendarGrid';

/**
 * The calendar's tickets by day, and dragging a ticket onto a day to set its due date.
 * A dropped ticket shows on its new day at once, until the saved data catches up.
 */
export function useCalendarDrag(issues: Issue[]) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropped, setDropped] = useState<Record<number, string>>({});

  const { byDay, unscheduled } = useMemo(() => {
    const byDay = new Map<string, Issue[]>();
    const unscheduled: Issue[] = [];
    for (const issue of issues) {
      const key = (issue.id ? dropped[issue.id] : undefined) ?? parseDueDateKey(issue.dueDate);
      if (!key) unscheduled.push(issue);
      else byDay.set(key, [...(byDay.get(key) ?? []), issue]);
    }
    return { byDay, unscheduled };
  }, [issues, dropped]);

  // Forget a drop once the saved ticket shows the same day
  useEffect(() => {
    setDropped(prev => {
      const settled = Object.keys(prev).map(Number).filter(id => {
        const match = issues.find(i => i.id === id);
        return match && parseDueDateKey(match.dueDate) === prev[id];
      });
      if (settled.length === 0) return prev;
      const next = { ...prev };
      settled.forEach(id => delete next[id]);
      return next;
    });
  }, [issues]);

  const onDragStart = (e: DragEvent, issue: Issue) => {
    if (!issue.id) return;
    e.dataTransfer.setData('text/plain', String(issue.id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(issue.id);
  };
  const onDragEnd = () => { setDraggingId(null); setDragOverKey(null); };

  const dayProps = (key: string) => ({
    onDragOver: (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverKey !== key) setDragOverKey(key); },
    onDragLeave: (e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOverKey === key) setDragOverKey(null); },
    onDrop: async (e: DragEvent) => {
      e.preventDefault();
      setDragOverKey(null);
      setDraggingId(null);
      const issueId = Number(e.dataTransfer.getData('text/plain'));
      const [y, m, d] = key.split('-').map(Number);
      if (!issueId || !y || !m || !d) return;
      setDropped(prev => ({ ...prev, [issueId]: key }));
      try {
        await updateIssue(issueId, { dueDate: new Date(y, m - 1, d, 12, 0, 0) });
      } catch (err) {
        console.error('Failed to update issue dueDate on calendar drop:', err);
        setDropped(({ [issueId]: _undone, ...rest }) => rest);
      }
    },
  });

  return { byDay, unscheduled, draggingId, dragOverKey, onDragStart, onDragEnd, dayProps };
}
