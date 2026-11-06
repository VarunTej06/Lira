import type { Issue } from '../../types/issue';
import { type RoadmapItem } from './types';
import { epicFor, epicTickets, ticketDate } from './progress';

/** Planner rows: lane > epic > tickets. */
export const PLANNER_LANE_H = 34;

export const PLANNER_EPIC_H = 42;

export const PLANNER_TICKET_H = 32;

export type PlannerRow =
  | { kind: 'lane'; lane: string; y: number; h: number; count: number }
  | { kind: 'epic'; item: RoadmapItem; epic?: Issue; tickets: Issue[]; expanded: boolean; y: number; h: number }
  | { kind: 'ticket'; issue: Issue; item: RoadmapItem; y: number; h: number };

/** Rows for the planner: a header per lane, each item's epic, then that epic's tickets (unless collapsed). */
export function buildPlannerRows(
  items: RoadmapItem[], lanes: string[], issues: Issue[], collapsedLanes: string[] = [], collapsedEpics: string[] = [],
): { rows: PlannerRow[]; height: number } {
  const rows: PlannerRow[] = [];
  let y = 0;
  const allLanes = [...lanes, ...Array.from(new Set(items.map(i => i.lane))).filter(l => !lanes.includes(l))];
  for (const lane of allLanes) {
    const inLane = items.filter(i => i.lane === lane).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    if (inLane.length === 0 && !lanes.includes(lane)) continue;
    rows.push({ kind: 'lane', lane, y, h: PLANNER_LANE_H, count: inLane.length });
    y += PLANNER_LANE_H;
    if (collapsedLanes.includes(lane)) continue;
    for (const item of inLane) {
      const epic = epicFor(item, issues);
      const tickets = epicTickets(epic, issues).sort((a, b) => ticketDate(a).date.getTime() - ticketDate(b).date.getTime() || a.key.localeCompare(b.key, undefined, { numeric: true }));
      const expanded = !collapsedEpics.includes(item.id);
      rows.push({ kind: 'epic', item, epic, tickets, expanded, y, h: PLANNER_EPIC_H });
      y += PLANNER_EPIC_H;
      if (!expanded) continue;
      for (const issue of tickets) {
        rows.push({ kind: 'ticket', issue, item, y, h: PLANNER_TICKET_H });
        y += PLANNER_TICKET_H;
      }
    }
  }
  return { rows, height: y };
}

/** Date a drag lands on: the original date moved by a whole number of days. */
export const movedDate = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
