import { PALETTE } from '../theme/palette';
export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';
export type IssueType = 'task' | 'bug' | 'epic' | 'subtask';
export type IssueStatus = 'backlog' | 'todo' | 'inprogress' | 'done' | string;

export const ISSUE_TYPE_CONFIG: Record<IssueType, { label: string; color: string; bg: string }> = {
  epic:    { label: 'Epic',    color: PALETTE.purple, bg: '#EAE6FF' },
  task:    { label: 'Task',    color: PALETTE.brand, bg: PALETTE.brandBg },
  bug:     { label: 'Bug',     color: PALETTE.critical, bg: PALETTE.criticalBg },
  subtask: { label: 'Subtask', color: PALETTE.textMuted, bg: PALETTE.surfaceMuted },
};
// The picture for each type is drawn by TypeIcon (components/common/Icons.tsx).

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

export interface Comment {
  id: string;
  author: string;
  authorInitials: string;
  content: string; // HTML written by the comment editor (older comments are plain text)
  createdAt: Date;
  updatedAt?: Date;
  attachments?: Attachment[]; // files and pictures added inside the comment
}

export interface ActivityEntry {
  id: string;
  type: 'comment' | 'status_change' | 'field_change' | 'created' | 'attachment';
  author: string;
  authorInitials: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  createdAt: Date;
}

/** Where an attachment comes from: a file stored in the ticket, or a link to one online. */
export type AttachmentSource = 'file' | 'drive' | 'onedrive' | 'dropbox' | 'link';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string; // base64 for images
  data?: ArrayBuffer; // binary for non-images
  createdAt: Date;
  url?: string; // a link to the file, when it is not stored in the ticket
  source?: AttachmentSource;
}

export interface LinkedIssue {
  id: string;
  issueId: number;
  linkType: 'relates_to' | 'blocks' | 'blocked_by' | 'duplicates' | 'cloned_by';
}

export interface Issue {
  id?: number;
  spaceId: number;
  key: string; // e.g., "CERT-1"
  parentId?: number;  // ID of parent issue (Task→Epic, Subtask→Task)
  epicId?: number;    // Quick reference to root epic ID
  title: string;
  description: string;
  type: IssueType;
  status: IssueStatus;
  /** Blocked is a flag, not a status: the ticket keeps its status and shows it is waiting on another ticket. */
  blocked?: boolean;
  /** The tickets it is waiting on (their ids). Each link is also kept in linkedIssues as 'blocked_by'. */
  blockedByIds?: number[];
  /** When it was switched to Blocked (ISO time). Dashboards show how long it has been blocked. */
  blockedAt?: string;
  priority: Priority;
  assignee?: string;
  assigneeInitials?: string;
  reporter: string;
  reporterInitials: string;
  dueDate?: Date;
  startDate?: Date;
  labels: string[];
  subtasks: Subtask[];
  comments: Comment[];
  activity: ActivityEntry[];
  attachments: Attachment[];
  linkedIssues: LinkedIssue[];
  timeEstimate?: number; // minutes
  timeLogged?: number; // minutes
  category?: string;
  team?: string;
  rank: number; // for ordering within column
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  epicLink?: string;
  storyPoints?: number;
  watchers: string[];
  sprint?: string;          // monthly sprint key, e.g. "2026-11"
  sprintHistory?: string[]; // earlier sprints this ticket was carried over from
  /** Every status change, oldest first. Feeds cumulative flow and cycle time. */
  statusLog?: { from: string; to: string; at: Date }[];
}
