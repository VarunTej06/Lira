import type { Issue } from '../types/issue';

/** How many tickets there are, how many are done (any capitalisation), and the done share as a whole percent (0 with none). */
export function projectProgress(tickets: Issue[]): { total: number; done: number; percent: number } {
  const done = tickets.filter(i => i.status.toLowerCase() === 'done').length;
  return { total: tickets.length, done, percent: tickets.length > 0 ? Math.round((done / tickets.length) * 100) : 0 };
}
