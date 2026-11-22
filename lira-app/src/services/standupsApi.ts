import type { CallScopeType } from '../utils/callScopes';
import type { Repeat } from '../utils/standupSchedule';
import { send } from './authApi';

/** Hosted edition: stand-up calls (api/src/standups). Owner and Admin schedule them; people who are invited see them and open the link. */
export interface Invitee { type: 'user' | 'team'; id: string }
export interface Standup {
  scopeType: CallScopeType; scopeId: string; scopeName: string;
  id: string; title: string; startsAt: string; durationMinutes: number; link: string; linkSource: 'pasted' | 'meet';
  repeat: Repeat; repeatUntil: string | null; timeZone: string; invitees: Invitee[] | null;
}
export interface CreatedStandup extends Standup { emailed: { sent: number; total: number } }
export interface Audience { people: { id: string; name: string; email: string }[]; teams: { id: string; name: string }[]; canMakeMeetLink: boolean }
/** No `link` means: make a Google Meet link (when Google is connected). */
export interface StandupInput { scopeType?: CallScopeType; scopeId?: string; scopeName?: string; title: string; startsAt: string; durationMinutes: number; timeZone: string; link?: string; repeat?: Repeat; repeatUntil?: string; invitees: Invitee[] }
export interface GoogleStatus { configured: boolean; connected: boolean; email: string | null }

/** The call services a link may point to; the server checks the same list. */
const MEETING_HOSTS = ['meet.google.com', 'teams.microsoft.com', 'teams.live.com'];

/** True for an https link to Google Meet or Microsoft Teams. Used before a link is shown as something to click. */
export function isMeetingLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && MEETING_HOSTS.includes(url.hostname.toLowerCase());
  } catch { return false; }
}

const base = (orgId: string) => `/api/orgs/${encodeURIComponent(orgId)}/standups`;

export const listStandups = (orgId: string) => send<Standup[]>('GET', base(orgId));
export const standupAudience = (orgId: string) => send<Audience>('GET', `${base(orgId)}/audience`);
export const createStandup = (orgId: string, input: StandupInput) => send<CreatedStandup>('POST', base(orgId), input);
export const updateStandup = (orgId: string, id: string, input: Partial<StandupInput>) => send<Standup>('PATCH', `${base(orgId)}/${id}`, input);
export const googleStatus = (orgId: string) => send<GoogleStatus>('GET', `/api/orgs/${encodeURIComponent(orgId)}/google`);
/** Where to send the Owner to sign in at Google and agree. */
export const startGoogleConnect = (orgId: string) => send<{ url: string }>('POST', `/api/orgs/${encodeURIComponent(orgId)}/google/connect`);
export const disconnectGoogle = (orgId: string) => send<void>('DELETE', `/api/orgs/${encodeURIComponent(orgId)}/google`);

export const deleteStandup = (orgId: string, id: string) => send<void>('DELETE', `${base(orgId)}/${id}`);
