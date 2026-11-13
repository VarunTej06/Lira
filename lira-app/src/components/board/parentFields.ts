import type { Issue } from '../../types/issue';

/** The parent a ticket could be moved to: the parent's id, the epic it belongs to, and its name. */
export const parentFields = (p: Issue) => ({ parentId: p.id, epicId: p.type === 'epic' ? p.id : (p.epicId || undefined) });
