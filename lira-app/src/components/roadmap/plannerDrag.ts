import type { Issue } from '../../types/issue';
import { fmtShort, movedDate, resizeItem, shiftItem, ticketDate, type RoadmapItem } from '../../utils/roadmapUtils';

export interface Drag {
  kind: 'epic' | 'ticket';
  id: string | number;
  mode: 'move' | 'start' | 'end';
  originX: number;
  originScroll: number;
  delta: number;
  moved: boolean;
  x: number;
  y: number;
}

/** The epic as it looks while it is being dragged: moved or resized by the distance so far. */
export function liveItem(item: RoadmapItem, drag: Drag | null): RoadmapItem {
  if (!drag || drag.kind !== 'epic' || drag.id !== item.id || drag.delta === 0) return item;
  return drag.mode === 'move' ? shiftItem(item, drag.delta) : resizeItem(item, drag.mode, drag.delta);
}

/** The small label that follows the pointer while dragging: the new dates, or null before anything has moved. */
export function dragTip(drag: Drag | null, items: RoadmapItem[], issues: Issue[]): string | null {
  if (!drag || !drag.moved) return null;
  if (drag.kind === 'epic') {
    const base = items.find(i => i.id === drag.id);
    if (!base) return null;
    const v = liveItem(base, { ...drag, delta: drag.delta || 0 });
    return `${fmtShort(v.start)} → ${fmtShort(v.end)}`;
  }
  const t = issues.find(i => i.id === drag.id);
  return t ? movedDate(ticketDate(t).date, drag.delta).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null;
}

export type DropAction =
  | { type: 'openItem'; id: string }
  | { type: 'openIssue'; issue: Issue }
  | { type: 'changeItem'; item: RoadmapItem }
  | { type: 'moveTicket'; issue: Issue; date: Date };

/** What letting go of the pointer means: a click opens the item, a real move reschedules it. */
export function dropAction(d: Drag, items: RoadmapItem[], issues: Issue[]): DropAction | null {
  const clicked = !d.moved || d.delta === 0;
  if (d.kind === 'epic') {
    if (clicked) return { type: 'openItem', id: String(d.id) };
    const base = items.find(i => i.id === d.id);
    return base ? { type: 'changeItem', item: d.mode === 'move' ? shiftItem(base, d.delta) : resizeItem(base, d.mode, d.delta) } : null;
  }
  const ticket = issues.find(i => i.id === d.id);
  if (!ticket) return null;
  return clicked ? { type: 'openIssue', issue: ticket } : { type: 'moveTicket', issue: ticket, date: movedDate(ticketDate(ticket).date, d.delta) };
}
