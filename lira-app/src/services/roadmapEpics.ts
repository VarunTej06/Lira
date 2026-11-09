/**
 * Roadmap items are epics. This keeps the two in step:
 *  - adding a roadmap item creates an epic in the roadmap's space, in the Backlog
 *  - an item's checklist lives on ONE task under that epic: each checklist entry is a subtask of the task
 *  - changing an item's title, description or dates updates its epic (and task)
 *  - moving a ticket on the planner updates its due date and (monthly) sprint
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db';
import { getNextIssueKey } from '../hooks/useIssues';
import { readRoadmaps, writeRoadmaps } from '../hooks/useRoadmaps';
import { triggerDiskSync } from './localDiskSync';
import { moveIssuesToSprint, getIssueSprint, sprintKey } from '../utils/sprintUtils';
import { epicStatusFor, parseDay, type Roadmap, type RoadmapChild, type RoadmapItem } from '../utils/roadmapUtils';
import type { Issue, Subtask } from '../types/issue';
import type { Space } from '../types/space';
import { currentUser } from '../utils/currentUser';

/** Initials of the person using Lira: the author, reporter and watcher of what is created here. */
const ME = () => currentUser().initials;

export const spaceForRoadmap = (rm: Roadmap, spaces: Space[]) => spaces.find(s => s.key === rm.spaceKey);

const created = (text: string) => ({
  id: uuidv4(), type: 'created' as const, author: ME(), authorInitials: ME(), description: text, createdAt: new Date(),
});

/** Creates the epic for a roadmap item (Backlog, unless the item is already running or done). Returns the epic key. */
export async function createEpicForItem(item: RoadmapItem, space: Space, roadmapName: string): Promise<string> {
  const key = await getNextIssueKey(space.key);
  const now = new Date();
  await db.issues.add({
    spaceId: space.id!,
    key,
    title: item.title,
    description: item.description || '',
    type: 'epic',
    status: epicStatusFor(item.status),
    priority: 'medium',
    assignee: item.owner || ME(),
    assigneeInitials: (item.owner || ME()).slice(0, 2).toUpperCase(),
    reporter: ME(),
    reporterInitials: ME(),
    startDate: parseDay(item.start),
    dueDate: parseDay(item.end),
    labels: ['roadmap'],
    subtasks: [],
    comments: [],
    activity: [created(`created this epic from the roadmap "${roadmapName}"`)],
    attachments: [],
    linkedIssues: [],
    rank: Date.now(),
    createdAt: now,
    updatedAt: now,
    watchers: [ME()],
  } as Omit<Issue, 'id'>);
  triggerDiskSync();
  return key;
}

const toSubtasks = (list: RoadmapChild[], existing: Subtask[] = []): Subtask[] =>
  list.map(c => ({ id: c.id, title: c.title, completed: c.done, createdAt: existing.find(s => s.id === c.id)?.createdAt ?? new Date() }));

/**
 * Creates the single task that carries an item's checklist, under the item's epic. Its subtasks are the checklist entries.
 * Like the epic, it starts in the Backlog (unless the item is already running or done). Returns the task key.
 */
async function createTaskForItem(item: RoadmapItem, epic: Issue, roadmapName: string): Promise<string> {
  const space = await db.spaces.get(epic.spaceId);
  if (!space) throw new Error('The epic’s space no longer exists.');
  const key = await getNextIssueKey(space.key);
  const now = new Date();
  await db.issues.add({
    spaceId: epic.spaceId,
    key,
    parentId: epic.id,
    epicId: epic.id,
    epicLink: epic.title,
    title: `Deliver: ${item.title}`,
    description: `Checklist for the roadmap item "${item.title}" (${roadmapName}). Each subtask is a step on the roadmap.`,
    type: 'task',
    status: epicStatusFor(item.status),
    priority: 'medium',
    assignee: item.owner || ME(),
    assigneeInitials: (item.owner || ME()).slice(0, 2).toUpperCase(),
    reporter: ME(),
    reporterInitials: ME(),
    startDate: parseDay(item.start),
    dueDate: parseDay(item.end),
    labels: ['roadmap'],
    subtasks: toSubtasks(item.children),
    comments: [],
    activity: [created(`created this task from the roadmap "${roadmapName}"`)],
    attachments: [],
    linkedIssues: [],
    // no sprint stamp: a roadmap task far in the future must not create a sprint for that month. It belongs to the month it
    // was created in until someone plans it (the planner moves it with its date).
    rank: Date.now(),
    createdAt: now,
    updatedAt: now,
    watchers: [ME()],
  } as Omit<Issue, 'id'>);
  triggerDiskSync();
  return key;
}

interface EnsureResult { items: RoadmapItem[]; created: string[]; tasks: string[]; error?: string }

/** An item with a checklist needs one task, unless its task still exists. */
const needsTask = (item: RoadmapItem, existingTasks: Set<string>): boolean => item.children.length > 0 && (!item.taskKey || !existingTasks.has(item.taskKey));

/** What to tell the person when epics cannot be created because the roadmap's space is missing. */
export const noSpaceMessage = (rm: Roadmap): string =>
  rm.spaceKey ? `Space ${rm.spaceKey} was not found, so epics could not be created.` : 'This roadmap has no space, so epics could not be created.';

/** A recreated epic adopts the checklist task that belonged to the deleted one. */
async function adoptOrphanTask(item: RoadmapItem): Promise<void> {
  const [epic, task] = await Promise.all([
    db.issues.where('key').equals(item.epicKey!).first(),
    db.issues.where('key').equals(item.taskKey!).first(),
  ]);
  if (epic?.id && task?.id) await db.issues.update(task.id, { parentId: epic.id, epicId: epic.id, epicLink: epic.title });
}

/**
 * Gives every item an epic, and every item that has a checklist its single checklist task. Safe to call repeatedly:
 * things that already exist are left alone, things that were deleted are recreated.
 */
export async function ensureEpics(rm: Roadmap, spaces: Space[]): Promise<EnsureResult> {
  const space = spaceForRoadmap(rm, spaces);
  const all = await db.issues.toArray();
  const existing = new Set(all.filter(i => i.type === 'epic').map(i => i.key));
  const existingTasks = new Set(all.filter(i => i.type !== 'epic').map(i => i.key));
  const missingEpic = rm.items.filter(i => !i.epicKey || !existing.has(i.epicKey));
  if (missingEpic.length === 0 && !rm.items.some(i => needsTask(i, existingTasks))) return { items: rm.items, created: [], tasks: [] };
  if (!space) return { items: rm.items, created: [], tasks: [], error: noSpaceMessage(rm) };

  const epicKeys = new Map<string, string>();
  for (const item of missingEpic) epicKeys.set(item.id, await createEpicForItem(item, space, rm.name));
  let items = rm.items.map(i => (epicKeys.has(i.id) ? { ...i, epicKey: epicKeys.get(i.id) } : i));

  for (const item of items) {
    if (epicKeys.has(item.id) && item.taskKey && existingTasks.has(item.taskKey)) await adoptOrphanTask(item);
  }

  const taskKeys = new Map<string, string>();
  for (const item of items.filter(i => needsTask(i, existingTasks))) {
    const epic = await db.issues.where('key').equals(item.epicKey!).first();
    if (epic) taskKeys.set(item.id, await createTaskForItem(item, epic, rm.name));
  }
  items = items.map(i => (taskKeys.has(i.id) ? { ...i, taskKey: taskKeys.get(i.id) } : i));
  return { items, created: Array.from(epicKeys.values()), tasks: Array.from(taskKeys.values()) };
}

/** Pushes an item's title, description and dates to its epic and task. Pass status to also move the epic's board status. */
export async function syncEpicFromItem(item: RoadmapItem, opts: { status?: boolean } = {}): Promise<void> {
  if (!item.epicKey) return;
  const epic = await db.issues.where('key').equals(item.epicKey).first();
  if (!epic?.id) return;
  const patch: Partial<Issue> = {
    title: item.title,
    description: item.description || epic.description,
    startDate: parseDay(item.start),
    dueDate: parseDay(item.end),
    updatedAt: new Date(),
  };
  if (opts.status && (item.status === 'planned' || item.status === 'inprogress' || item.status === 'done')) patch.status = epicStatusFor(item.status);
  await db.issues.update(epic.id, patch);
  await syncTaskFromItem(item, false);
  triggerDiskSync();
}

/**
 * Makes the item's task match the item: title and dates, and the checklist as subtasks. Existing subtasks keep their
 * creation time; ticking is whatever the checklist says.
 */
export async function syncTaskFromItem(item: RoadmapItem, checklist = true): Promise<void> {
  if (!item.taskKey) return;
  const task = await db.issues.where('key').equals(item.taskKey).first();
  if (!task?.id) return;
  const patch: Partial<Issue> = {
    title: `Deliver: ${item.title}`,
    startDate: parseDay(item.start),
    dueDate: parseDay(item.end),
    updatedAt: new Date(),
  };
  if (checklist) patch.subtasks = toSubtasks(item.children, task.subtasks);
  await db.issues.update(task.id, patch);
  triggerDiskSync();
}

/** Sets a ticket's due date. Tickets belong to monthly sprints, so the sprint follows the month. */
export async function setTicketDate(issue: Issue, date: Date): Promise<void> {
  if (!issue.id) return;
  const fresh = await db.issues.get(issue.id);
  if (!fresh) return;
  const from = fresh.dueDate ? new Date(fresh.dueDate).toLocaleDateString('en-GB') : 'no date';
  await db.issues.update(issue.id, {
    dueDate: date,
    updatedAt: new Date(),
    activity: [...(fresh.activity || []), {
      id: uuidv4(), type: 'field_change', author: ME(), authorInitials: ME(),
      description: 'changed the due date from the roadmap planner', oldValue: from, newValue: date.toLocaleDateString('en-GB'), createdAt: new Date(),
    }],
  });
  const target = sprintKey(date);
  if (fresh.type !== 'epic' && getIssueSprint(fresh) !== target) await moveIssuesToSprint([fresh], target);
  else triggerDiskSync();
}

/** Quick-add a task under an epic (used by the planner). */
export async function addTicketToEpic(epic: Issue, title: string, date?: Date): Promise<void> {
  const space = await db.spaces.get(epic.spaceId);
  if (!space) return;
  const key = await getNextIssueKey(space.key);
  const now = new Date();
  await db.issues.add({
    spaceId: epic.spaceId, key, parentId: epic.id, epicId: epic.id, epicLink: epic.title,
    title: title.trim(), description: '', type: 'task', status: 'todo', priority: 'medium',
    assignee: ME(), assigneeInitials: ME(), reporter: ME(), reporterInitials: ME(),
    dueDate: date, labels: [], subtasks: [], comments: [],
    activity: [created('created this issue from the roadmap planner')],
    attachments: [], linkedIssues: [], sprint: date ? sprintKey(date) : sprintKey(now),
    rank: Date.now(), createdAt: now, updatedAt: now, watchers: [ME()],
  } as Omit<Issue, 'id'>);
  triggerDiskSync();
}

/** Creates the checklist task for one item if it has an epic but no task yet. Returns the (new or existing) task key. */
export async function ensureTaskForItem(item: RoadmapItem, roadmapName: string): Promise<string | undefined> {
  if (item.taskKey && await db.issues.where('key').equals(item.taskKey).first()) return item.taskKey;
  if (!item.epicKey) return undefined;
  const epic = await db.issues.where('key').equals(item.epicKey).first();
  return epic ? createTaskForItem(item, epic, roadmapName) : undefined;
}

/**
 * After a roadmap's schedule changed (see migrateLiraSchedule), makes its epics and checklist tasks follow: their dates move,
 * and a checklist task that was filed under a far-away month goes back into the sprint of its new end month.
 * Runs once at start-up; returns how many items were brought up to date.
 */
export async function syncPendingRoadmaps(): Promise<number> {
  const list = readRoadmaps();
  const pending = list.filter(r => r.pendingTicketSync);
  if (pending.length === 0) return 0;
  let touched = 0;
  for (const rm of pending) {
    for (const item of rm.items) {
      if (!item.epicKey) continue;
      await syncEpicFromItem(item); // epic and task title / dates
      if (item.taskKey) {
        const task = await db.issues.where('key').equals(item.taskKey).first();
        const target = sprintKey(parseDay(item.end));
        if (task && getIssueSprint(task) !== target) await moveIssuesToSprint([task], target);
      }
      touched++;
    }
  }
  writeRoadmaps(list.map(r => (r.pendingTicketSync ? { ...r, pendingTicketSync: false } : r)));
  return touched;
}
