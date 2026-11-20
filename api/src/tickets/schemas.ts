import { z } from 'zod';

const text = (max: number) => z.string().max(max, `Use at most ${max} characters.`);
const short = text(100);
const when = z.iso.datetime({ offset: true });
const id = z.number().int().positive();

const subtask = z.strictObject({ id: short, title: text(500), completed: z.boolean(), createdAt: when });
const comment = z.strictObject({ id: short, author: short, authorInitials: text(10), content: text(100000), createdAt: when, updatedAt: when.optional() });
const activity = z.strictObject({
  id: short, type: z.enum(['comment', 'status_change', 'field_change', 'created', 'attachment']), author: short, authorInitials: text(10),
  description: text(2000), oldValue: text(2000).optional(), newValue: text(2000).optional(), createdAt: when,
});
const link = z.strictObject({ id: short, issueId: id, linkType: z.enum(['relates_to', 'blocks', 'blocked_by', 'duplicates', 'duplicated_by', 'cloned_by']) });
const statusChange = z.strictObject({ from: short, to: short, at: when });

/**
 * The fields of a ticket as the app sends them. Unknown fields are refused (mass assignment), so the id, the organisation,
 * the key, the version and the attachments can never be set from a request. Attachments have their own endpoints (ADR-0011).
 */
const fields = {
  parentId: id.optional(), epicId: id.optional(),
  title: z.string().trim().min(1, 'Enter a title.').max(500, 'Use at most 500 characters.'),
  type: z.enum(['task', 'bug', 'epic', 'subtask']),
  status: z.string().min(1).max(50),
  priority: z.enum(['highest', 'high', 'medium', 'low', 'lowest']),
  assignee: short.optional(), assigneeInitials: text(10).optional(),
  rank: z.number().finite(),
  description: text(200000), reporter: short, reporterInitials: text(10),
  blocked: z.boolean().optional(), blockedByIds: z.array(id).max(100).optional(), blockedAt: when.optional(),
  dueDate: when.optional(), startDate: when.optional(), resolvedAt: when.optional(),
  labels: z.array(text(50)).max(50), inheritedLabels: z.array(text(50)).max(50).optional(),
  subtasks: z.array(subtask).max(200), comments: z.array(comment).max(500), activity: z.array(activity).max(2000),
  linkedIssues: z.array(link).max(100), watchers: z.array(short).max(200),
  timeEstimate: z.number().int().min(0).optional(), timeLogged: z.number().int().min(0).optional(),
  category: short.optional(), team: short.optional(), epicLink: short.optional(), storyPoints: z.number().min(0).max(1000).optional(),
  sprint: text(20).optional(), sprintHistory: z.array(text(20)).max(100).optional(), statusLog: z.array(statusChange).max(500).optional(),
};

export const createTicketSchema = z.strictObject(fields);

/**
 * An update names the version the person saw and any of the fields. The space of a ticket cannot be changed here. A field that
 * may be left empty is cleared by sending null.
 */
const CLEARABLE = new Set(['parentId', 'epicId', 'assignee', 'assigneeInitials', 'blocked', 'blockedByIds', 'blockedAt', 'dueDate', 'startDate', 'resolvedAt', 'inheritedLabels', 'timeEstimate', 'timeLogged', 'category', 'team', 'epicLink', 'storyPoints', 'sprint', 'sprintHistory', 'statusLog']);
export const updateTicketSchema = z.strictObject({
  version: z.number().int().min(1),
  ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, (CLEARABLE.has(k) ? z.unknown().pipe(z.null().or(v)) : v).optional()])),
}).refine(v => Object.keys(v).some(k => k !== 'version'), { message: 'Nothing to change.' });

export const deleteTicketSchema = z.strictObject({ version: z.number().int().min(1) });

export type CreateTicket = z.infer<typeof createTicketSchema>;
/** Each value was checked by its own schema above; the service only moves them into columns and the document. */
export type UpdateTicket = { version: number } & Record<string, unknown>;

/** The fields that are columns; everything else goes in the JSON document. */
export const COLUMN_FIELDS = ['parentId', 'epicId', 'title', 'type', 'status', 'priority', 'assignee', 'rank'] as const;
