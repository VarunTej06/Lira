import type { Person, Round } from '../utils/storyRound';
import type { Vote } from '../utils/storybox';
import { send } from './authApi';

const base = (org: string, box: string) => `/api/orgs/${encodeURIComponent(org)}/objects/storybox/${encodeURIComponent(box)}`;

/** What the server sends for the room. `votes` holds everyone's points only for tickets already revealed, and otherwise only the caller's own. */
export interface RoomReply { now: string; rounds: Round[]; votes: Vote[]; people: Person[]; activeTicketId: number | null }

export const getRoom = (org: string, box: string) => send<RoomReply>('GET', `${base(org, box)}/room`);
/** Put a ticket in front of everyone, redo it, put it back, reveal everyone's points, or confirm the final points. Refused for anyone who may not run the box. */
export const roundAction = (org: string, box: string, ticketId: number, action: 'start' | 'reveal' | 'revote' | 'cancel') => send<void>('POST', `${base(org, box)}/rounds/${ticketId}/${action}`);
export const confirmRound = (org: string, box: string, ticketId: number, points: number) => send<void>('POST', `${base(org, box)}/rounds/${ticketId}/confirm`, { points });
/** The person's own points for the ticket being voted on; `null` takes them back. The server refuses it once the time is up or the points are revealed. */
export const putVote = (org: string, box: string, ticketId: number, points: number | null) => send<void>('PUT', `${base(org, box)}/votes/${ticketId}`, { points });

/** How many tickets each story box the person may view has sized, and their points together, for the overview. */
export const getSummary = (org: string) => send<{ boxId: string; sized: number; points: number }[]>('GET', `/api/orgs/${encodeURIComponent(org)}/storybox-summary`);
