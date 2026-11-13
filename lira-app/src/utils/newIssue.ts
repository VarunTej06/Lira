import { v4 as uuidv4 } from 'uuid';
import type { Attachment, Issue, IssueType, Priority } from '../types/issue';
import { currentUser } from './currentUser';

export interface NewIssueInput {
  spaceId: number;
  key: string;
  title: string;
  description: string;
  type: IssueType;
  status: string;
  priority: Priority;
  /** `YYYY-MM-DD` from the date field, or empty. */
  dueDate: string;
  /** Comma-separated labels as typed. */
  labels: string;
  /** Left out for a ticket that is not planned into a sprint. */
  sprint?: string;
  parentId?: number;
  attachments: Attachment[];
  /** Everyone's tickets in the space, to look up the parent's epic and name. */
  spaceIssues: Issue[];
  /** Initials of the person creating it. */
  me?: string;
  /** Who it is assigned to; the creator when left out. */
  assignee?: { name?: string; initials?: string };
  now?: Date;
}

/** The statuses a new ticket may start in. Moving it further is done on the ticket itself, once it exists. */
export const NEW_TICKET_STATUSES = [['backlog', 'Backlog'], ['todo', 'To Do']] as const;

/** Where a new ticket starts: Backlog when that was asked for, To Do for anything else (for example "+ Add" in the Done column). */
export const newTicketStatus = (wanted: string | undefined): 'backlog' | 'todo' => (wanted === 'backlog' ? 'backlog' : 'todo');

/** The ticket to save for the Create form: parent and epic links, labels, a "created" activity entry, and the creator as assignee and watcher. */
export function buildNewIssue(i: NewIssueInput): Omit<Issue, 'id'> {
  const me = i.me ?? currentUser().initials;
  const now = i.now ?? new Date();
  const parent = i.parentId ? i.spaceIssues.find(p => p.id === i.parentId) : undefined;
  return {
    spaceId: i.spaceId,
    key: i.key,
    parentId: i.parentId || undefined,
    epicId: parent ? (parent.type === 'epic' ? i.parentId : parent.epicId) : undefined,
    epicLink: parent?.title,
    title: i.title.trim(),
    description: i.description.trim(),
    type: i.type,
    status: newTicketStatus(i.status),
    priority: i.priority,
    assignee: i.assignee ? i.assignee.name : me,
    assigneeInitials: i.assignee ? i.assignee.initials : me,
    reporter: me,
    reporterInitials: me,
    dueDate: i.dueDate ? new Date(i.dueDate) : undefined,
    labels: i.labels.split(',').map(l => l.trim()).filter(Boolean),
    subtasks: [],
    comments: [],
    activity: [{ id: uuidv4(), type: 'created', author: me, authorInitials: me, description: 'created this issue', createdAt: now }],
    attachments: i.attachments,
    linkedIssues: [],
    sprint: i.type === 'epic' ? undefined : i.sprint, // an epic is not planned into a sprint
    rank: now.getTime(),
    createdAt: now,
    updatedAt: now,
    watchers: [me],
  };
}
