import type { Issue } from '../types/issue';

export type NotificationKind = 'created' | 'edited' | 'closed';
export interface Notification {
  id: string;
  issue: Issue;
  author: string;
  category: NotificationKind;
  actionText: string;
  createdAt: Date | string;
}

const MINUTE = 60000;
const when = (d?: Date | string) => (d ? new Date(d).getTime() : 0);

/** What an activity entry on a ticket means for the bell: its kind, and the sentence to show. */
function describeActivity(issue: Issue, act: { text?: string; description?: string; type?: string }): { category: NotificationKind; actionText: string } {
  const text = act.text || act.description || 'updated ticket details';
  if (act.type === 'created') return { category: 'created', actionText: `created this ${issue.type}` };
  if (act.type !== 'status_change') return { category: 'edited', actionText: text };
  return text.toLowerCase().includes('done')
    ? { category: 'closed', actionText: 'transitioned ticket to Done' }
    : { category: 'edited', actionText: `changed status to ${act.description || 'in progress'}` };
}

type RawActivity = { text?: string; description?: string; author?: string; type?: string; createdAt?: Date | string; timestamp?: Date | string };

/** The "closed" entry of a finished ticket. */
const closedEntry = (issue: Issue): Notification => ({
  id: `${issue.key}-closed`, issue, author: issue.assigneeInitials || issue.assignee || 'VY', category: 'closed',
  actionText: 'closed ticket and transitioned to Done', createdAt: issue.resolvedAt || issue.updatedAt || issue.createdAt,
});

/** One entry for each activity line of the ticket. */
const activityEntries = (issue: Issue): Notification[] => (issue.activity ?? []).map((raw, idx) => {
  const act = raw as RawActivity;
  return {
    id: `${issue.key}-act-${idx}`, issue, author: act.author || issue.assigneeInitials || 'VY',
    ...describeActivity(issue, act),
    createdAt: act.createdAt || act.timestamp || issue.updatedAt || issue.createdAt,
  };
});

/** For a ticket with no activity: when it was created, and a later edit if it was changed more than a minute after. */
function fallbackEntries(issue: Issue): Notification[] {
  const created: Notification = { id: `${issue.key}-created`, issue, author: issue.reporter || 'VY', category: 'created', actionText: `created ${issue.type}`, createdAt: issue.createdAt };
  const edited = !!issue.updatedAt && when(issue.updatedAt) > when(issue.createdAt) + MINUTE && issue.status !== 'done';
  if (!edited) return [created];
  return [created, { id: `${issue.key}-edited`, issue, author: issue.assigneeInitials || 'VY', category: 'edited', actionText: `edited priority to ${issue.priority} & updated fields`, createdAt: issue.updatedAt! }];
}

/** Everything on one ticket that belongs in the bell: finished, activity entries, and creation and edits when there is no activity. */
function notificationsFor(issue: Issue): Notification[] {
  return [
    ...(issue.status === 'done' ? [closedEntry(issue)] : []),
    ...activityEntries(issue),
    ...(issue.activity?.length ? [] : fallbackEntries(issue)),
  ];
}

/** The latest 20 happenings across the tickets: finished tickets, activity entries, and (for tickets with no activity) their creation and later edits. */
export function buildNotifications(issues: Issue[]): Notification[] {
  return issues.flatMap(notificationsFor).sort((a, b) => when(b.createdAt) - when(a.createdAt)).slice(0, 20);
}
