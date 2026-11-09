import type { Issue } from '../types/issue';
import { loadProfile } from './userPrefs';

/** How tickets made before the profile existed spell the owner's name. They still count as "mine". */
const EARLIER_SPELLINGS = ['Varun Tej'];

/** The person using Lira, from Settings → Profile. */
export function currentUser() {
  const { name, initials } = loadProfile();
  return { name, initials, aliases: [name, initials, ...EARLIER_SPELLINGS] };
}

/** True when the ticket is assigned to the person using Lira (by initials, name, or an earlier spelling). */
export function isMine(issue: Pick<Issue, 'assignee' | 'assigneeInitials'>): boolean {
  const { aliases } = currentUser();
  return aliases.includes(issue.assigneeInitials ?? '\u0000') || aliases.includes(issue.assignee ?? '\u0000');
}
