/**
 * The statuses a ticket can have, in one place: label, colours and order.
 *
 * "Blocked" is not a status. It is a switch on the ticket (`blocked`, with `blockedByIds` for the tickets it waits on).
 * A blocked ticket keeps its status and stays in its board column; it shows a Blocked badge, and Blocked can be used
 * as a filter and is counted on the summary, sprint, project and capacity screens.
 */
import type { Issue } from '../types/issue';
import { PALETTE } from '../theme/palette';

const STATUS_IDS = ['backlog', 'todo', 'inprogress', 'done'] as const;
type KnownStatus = (typeof STATUS_IDS)[number];

interface StatusMeta { id: KnownStatus; label: string; color: string; bg: string }

export const STATUS_META: Record<KnownStatus, StatusMeta> = {
  backlog: { id: 'backlog', label: 'Backlog', color: '#5E6C84', bg: '#EBECF0' },
  todo: { id: 'todo', label: 'To Do', color: PALETTE.textStrong, bg: PALETTE.border },
  inprogress: { id: 'inprogress', label: 'In Progress', color: PALETTE.brand, bg: PALETTE.brandBg },
  done: { id: 'done', label: 'Done', color: '#006644', bg: '#E3FCEF' },
};

/** How a blocked ticket is coloured. */
export const BLOCKED_META = { label: 'Blocked', color: '#BF2600', bg: PALETTE.criticalBg } as const;

/** Every status, in the order they are listed in dropdowns and filters. */
export const STATUS_LIST: StatusMeta[] = STATUS_IDS.map(id => STATUS_META[id]);

/** True when the ticket is switched to Blocked. */
export const isBlocked = (issue: Pick<Issue, 'blocked'> | undefined | null) => !!issue?.blocked;

/** The label of a status, or the status itself for a custom one. */
export const statusLabel = (status: string | undefined) => (status && (STATUS_META as Record<string, StatusMeta>)[status]?.label) || status || '';
