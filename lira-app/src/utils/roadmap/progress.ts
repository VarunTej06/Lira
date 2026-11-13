import type { Issue } from '../../types/issue';
import { type RoadmapStatus, type Horizon, type RoadmapChild, type RoadmapItem  } from './types';
import { parseDay, daysBetween } from './dates';

/** Progress, status and horizon of an item, from its epic, tickets, checklist task and checklist. */
/** Roadmap status that matches an epic's board status. */
export function statusFromEpic(status?: string): RoadmapStatus {
  const s = (status || '').toLowerCase();
  if (s === 'done') return 'done';
  if (s === 'inprogress') return 'inprogress';
  return 'planned';
}

/** The board status a new epic gets for a roadmap status: Backlog, unless the work is already running or finished. */
export function epicStatusFor(status: RoadmapStatus): 'backlog' | 'inprogress' | 'done' {
  if (status === 'done') return 'done';
  if (status === 'inprogress') return 'inprogress';
  return 'backlog';
}

export const epicFor = (item: RoadmapItem, issues: Issue[]): Issue | undefined =>
  item.epicKey ? issues.find(i => i.type === 'epic' && i.key === item.epicKey) : undefined;

/** Tickets that belong to an epic (tasks and bugs; subtasks are counted through their parent). */
export const epicTickets = (epic: Issue | undefined, issues: Issue[]): Issue[] =>
  epic ? issues.filter(i => i.type !== 'epic' && i.type !== 'subtask' && (i.parentId === epic.id || i.epicId === epic.id)) : [];

/** The task that carries an item's checklist. */
const taskFor = (item: RoadmapItem, issues: Issue[]): Issue | undefined =>
  item.taskKey ? issues.find(i => i.key === item.taskKey && i.type !== 'epic') : undefined;

/** The checklist to show: the linked task's subtasks when there is a task (so ticking one on the ticket shows here), else the saved list. */
export function itemChecklist(item: RoadmapItem, issues: Issue[] = []): RoadmapChild[] {
  const task = taskFor(item, issues);
  return task ? (task.subtasks || []).map(s => ({ id: s.id, title: s.title, done: s.completed })) : item.children;
}

/**
 * Progress 0-100. With tickets under the epic, each ticket counts as done (1), or for the checklist task as the share of its
 * subtasks that are ticked. Then a finished epic, then the saved checklist, then the manual value.
 */
export function itemProgress(item: RoadmapItem, issues: Issue[] = []): number {
  const epic = epicFor(item, issues);
  const tickets = epicTickets(epic, issues);
  if (tickets.length > 0) {
    const share = (t: Issue) => {
      if (t.status?.toLowerCase() === 'done') return 1;
      if (t.key === item.taskKey && t.subtasks?.length) return t.subtasks.filter(s => s.completed).length / t.subtasks.length;
      return 0;
    };
    return Math.round((tickets.reduce((a, t) => a + share(t), 0) / tickets.length) * 100);
  }
  if (epic && epic.status?.toLowerCase() === 'done') return 100;
  const list = itemChecklist(item, issues);
  if (list.length > 0) return Math.round((list.filter(c => c.done).length / list.length) * 100);
  return Math.max(0, Math.min(100, item.progress));
}

/**
 * The status to show. With a linked epic, the epic's board status decides (Backlog/To do = Planned). Finished work is Done,
 * work past its end date that is not finished is At risk, and a manual Blocked / At risk flag is kept.
 */
export function effectiveStatus(item: RoadmapItem, progress: number, today = new Date(), epicStatus?: string): RoadmapStatus {
  const manual = item.status === 'blocked' || item.status === 'atrisk';
  const base = epicStatus !== undefined && !manual ? statusFromEpic(epicStatus) : item.status;
  if (base === 'done' || progress >= 100) return 'done';
  if (item.status === 'blocked') return 'blocked';
  if (parseDay(item.end) < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return 'atrisk';
  return base;
}

/** Everything the views need about one item: its epic, progress and the status to show. */
export function resolveItem(item: RoadmapItem, issues: Issue[], today = new Date()) {
  const epic = epicFor(item, issues);
  const progress = itemProgress(item, issues);
  const status = effectiveStatus(item, progress, today, epic?.status);
  // an epic that is switched to Blocked shows as Blocked on the roadmap (unless it is finished)
  return { epic, progress, status: epic?.blocked && status !== 'done' ? ('blocked' as RoadmapStatus) : status };
}

export function horizonOf(item: RoadmapItem, status: RoadmapStatus, today = new Date()): Horizon {
  if (status === 'done') return 'done';
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = parseDay(item.start);
  if (status === 'inprogress' || daysBetween(t, start) <= 7) return 'now'; // started, or starting this week
  return daysBetween(t, start) <= 62 ? 'next' : 'later';
}

/** Where a ticket sits on a calendar: its due date, else the first day of its sprint month (unscheduled). */
export function ticketDate(i: Issue): { date: Date; scheduled: boolean } {
  if (i.dueDate) { const d = new Date(i.dueDate); return { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), scheduled: true }; }
  if (i.sprint) return { date: parseDay(`${i.sprint}-01`), scheduled: false };
  const c = new Date(i.createdAt);
  return { date: new Date(c.getFullYear(), c.getMonth(), 1), scheduled: false };
}
