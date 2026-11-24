import type { Vote } from '../utils/storybox';
import { send } from './authApi';

const base = (org: string, box: string) => `/api/orgs/${encodeURIComponent(org)}/objects/storybox/${encodeURIComponent(box)}/votes`;

/** Everyone's points in a story box (hosted edition). */
export const listVotes = (org: string, box: string) => send<Vote[]>('GET', base(org, box));
/** The person's own points for a ticket; `null` takes them back. The server refuses it for a closed box or a ticket they may not see. */
export const putVote = (org: string, box: string, ticketId: number, points: number | null) => send<void>('PUT', `${base(org, box)}/${ticketId}`, { points });
