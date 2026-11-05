export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';
export type IssueType = 'task' | 'bug' | 'epic' | 'subtask';
export type IssueStatus = 'backlog' | 'todo' | 'inprogress' | 'done' | string;

export const ISSUE_TYPE_CONFIG: Record<IssueType, { label: string; color: string; bg: string; symbol: string }> = {
  epic:    { label: 'Epic',    color: '#6554C0', bg: '#EAE6FF', symbol: '⚡' },
  task:    { label: 'Task',    color: '#0052CC', bg: '#DEEBFF', symbol: '✅' },
  bug:     { label: 'Bug',     color: '#DE350B', bg: '#FFEBE6', symbol: '🐛' },
  subtask: { label: 'Subtask', color: '#6B778C', bg: '#F4F5F7', symbol: '↳' },
};

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
  content: string;
  createdAt: Date;
  updatedAt?: Date;
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

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string; // base64 for images
  data?: ArrayBuffer; // binary for non-images
  createdAt: Date;
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
}
