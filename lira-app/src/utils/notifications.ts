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

/** The latest 20 happenings across the tickets: finished tickets, activity entries, and (for tickets with no activity) their creation and later edits. */
export function buildNotifications(issues: Issue[]): Notification[] {
  const all: Notification[] = [];
  for (const issue of issues) {
    if (issue.status === 'done') {
      all.push({ id: `${issue.key}-closed`, issue, author: issue.assigneeInitials || issue.assignee || 'VY', category: 'closed', actionText: 'closed ticket and transitioned to Done', createdAt: issue.resolvedAt || issue.updatedAt || issue.createdAt });
    }
    (issue.activity ?? []).forEach((raw, idx) => {
      const act = raw as { text?: string; description?: string; author?: string; type?: string; createdAt?: Date | string; timestamp?: Date | string };
      all.push({
        id: `${issue.key}-act-${idx}`, issue, author: act.author || issue.assigneeInitials || 'VY',
        ...describeActivity(issue, act),
        createdAt: act.createdAt || act.timestamp || issue.updatedAt || issue.createdAt,
      });
    });
    if (!issue.activity || issue.activity.length === 0) {
      all.push({ id: `${issue.key}-created`, issue, author: issue.reporter || 'VY', category: 'created', actionText: `created ${issue.type}`, createdAt: issue.createdAt });
      if (issue.updatedAt && when(issue.updatedAt) > when(issue.createdAt) + MINUTE && issue.status !== 'done') {
        all.push({ id: `${issue.key}-edited`, issue, author: issue.assigneeInitials || 'VY', category: 'edited', actionText: `edited priority to ${issue.priority} & updated fields`, createdAt: issue.updatedAt });
      }
    }
  }
  return all.sort((a, b) => when(b.createdAt) - when(a.createdAt)).slice(0, 20);
}
