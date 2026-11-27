import { send } from './authApi';

/** Hosted edition: people, teams, access and invitations of the signed-in person's organisation (api/src/people, api/src/invitations). */
export type Level = 'view' | 'edit' | 'manage';
export type AssignableRole = 'admin' | 'member' | 'viewer' | 'guest';
export type ObjectKind = 'space' | 'project' | 'roadmap' | 'dashboard' | 'storybox' | 'mindmap';

export interface Member { userId: string; name: string; email: string; role: string; manageAccess: boolean; teamIds: string[] }
export interface Team { id: string; name: string; memberIds: string[] }
export interface Grant { id: string; subjectType: 'user' | 'team'; subjectId: string; kind: ObjectKind; objectId: string; level: Level }
/** What else of a space, besides its tickets, an invited person sees. */
export interface Shares { projects: boolean; roadmaps: boolean; dashboards: boolean; sprints: boolean }
export interface Invitation { id: string; email: string; role: string; teamId: string | null; spaceId: number | null; level: Level | null; shares: Shares | null; expiresAt: string }
export interface SpaceShare extends Shares { userId: string; name: string; email: string }
export interface CreatedInvitation extends Invitation { token: string; emailed: boolean }

const org = (orgId: string) => `/api/orgs/${encodeURIComponent(orgId)}`;

export const myAccess = (orgId: string) => send<{ role: string; canManageAccess: boolean }>('GET', `${org(orgId)}/access`);

export const listMembers = (orgId: string) => send<Member[]>('GET', `${org(orgId)}/members`);
export const updateMember = (orgId: string, userId: string, changes: { role?: AssignableRole; manageAccess?: boolean }) => send<void>('PATCH', `${org(orgId)}/members/${userId}`, changes);
export const removeMember = (orgId: string, userId: string) => send<void>('DELETE', `${org(orgId)}/members/${userId}`);

export const listTeams = (orgId: string) => send<Team[]>('GET', `${org(orgId)}/teams`);
export const createTeam = (orgId: string, name: string) => send<Team>('POST', `${org(orgId)}/teams`, { name });
export const deleteTeam = (orgId: string, teamId: string) => send<void>('DELETE', `${org(orgId)}/teams/${teamId}`);
export const setTeamMembers = (orgId: string, teamId: string, userIds: string[]) => send<void>('PUT', `${org(orgId)}/teams/${teamId}/members`, { userIds });

export const listGrants = (orgId: string, kind: ObjectKind, objectId: string) =>
  send<Grant[]>('GET', `${org(orgId)}/grants?kind=${kind}&objectId=${encodeURIComponent(objectId)}`);
/** Every grant of the organisation, for the page that shows what one person or team can reach. Owner and permitted Admins only. */
export const listAllGrants = (orgId: string) => send<Grant[]>('GET', `${org(orgId)}/grants`);
export const setGrant = (orgId: string, grant: Omit<Grant, 'id'>) => send<Grant>('POST', `${org(orgId)}/grants`, grant);
export const revokeGrant = (orgId: string, grantId: string) => send<void>('DELETE', `${org(orgId)}/grants/${grantId}`);

export const listInvitations = (orgId: string) => send<Invitation[]>('GET', `${org(orgId)}/invitations`);
export const invite = (orgId: string, body: { email: string; role: AssignableRole; teamId?: string; spaceId?: number; level?: Level; shares?: Partial<Shares> }) => send<CreatedInvitation>('POST', `${org(orgId)}/invitations`, body);
export const listSpaceShares = (orgId: string, spaceId: string) => send<SpaceShare[]>('GET', `${org(orgId)}/spaces/${encodeURIComponent(spaceId)}/shares`);
export const setSpaceShares = (orgId: string, spaceId: string, userId: string, changes: Partial<Shares>) =>
  send<void>('PUT', `${org(orgId)}/spaces/${encodeURIComponent(spaceId)}/shares/${userId}`, changes);
export const revokeInvitation = (orgId: string, id: string) => send<void>('DELETE', `${org(orgId)}/invitations/${id}`);
export const acceptInvitation = (token: string) => send<{ orgId: string; orgName: string }>('POST', '/api/invitations/accept', { token });

/** The address a person opens to accept an invitation. */
export const inviteLink = (token: string, origin: string): string => `${origin}/invite?token=${token}`;
