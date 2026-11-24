import type { Issue } from '../types/issue';
import type { Space } from '../types/space';
import { send, type AuthResult } from './authApi';

/**
 * Calls to the hosted edition's API for spaces and tickets (api/src/spaces, api/src/tickets). The server is the source of truth:
 * every row it sends carries a `version`, and a change must name the version it was based on (a stale one gets a 409).
 * Nothing here stores anything; the caller decides what to keep in the browser's cache.
 */
export type Versioned<T> = T & { version: number };

const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'dueDate', 'startDate', 'resolvedAt', 'at']);
const ISO = /^\d{4}-\d{2}-\d{2}T/;

/** The API sends dates as text; the app works with Date objects. Only the fields that are dates are converted. */
function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reviveDates) as T;
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [name, inner] of Object.entries(value)) out[name] = DATE_FIELDS.has(name) && typeof inner === 'string' && ISO.test(inner) ? new Date(inner) : reviveDates(inner);
  return out as T;
}

/** The fields of a ticket the API accepts. Anything else on an older ticket stays in the browser's copy and is not sent. */
const TICKET_FIELDS = [
  'parentId', 'epicId', 'title', 'type', 'status', 'priority', 'assignee', 'assigneeInitials', 'rank', 'description', 'reporter', 'reporterInitials',
  'blocked', 'blockedByIds', 'blockedAt', 'dueDate', 'startDate', 'resolvedAt', 'labels', 'inheritedLabels', 'subtasks', 'comments', 'activity',
  'linkedIssues', 'watchers', 'timeEstimate', 'timeLogged', 'category', 'team', 'epicLink', 'storyPoints', 'sprint', 'sprintHistory', 'statusLog',
] as const;

/**
 * A ticket as the API wants it. Files are left out: they get their own endpoints and live in Blob Storage (ADR-0011), and
 * the server refuses a ticket that carries them. Until those endpoints are used, a file added to a ticket is not saved on the server.
 * For a change (`clearing`), a field that is present but undefined means "remove it", which the API wants as null.
 */
export function ticketToServer(issue: Partial<Issue>, clearing = false): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const name of TICKET_FIELDS) {
    if (issue[name] !== undefined) body[name] = issue[name];
    else if (clearing && name in issue) body[name] = null;
  }
  if (issue.comments) body.comments = issue.comments.map(({ attachments: _files, ...comment }) => comment);
  return body;
}

export const spaceToServer = (space: Pick<Space, 'key' | 'name' | 'icon' | 'color' | 'description'>) =>
  ({ key: space.key, name: space.name, icon: space.icon, color: space.color, ...(space.description ? { description: space.description } : {}) });

type Raw = Record<string, unknown>;
export const spaceFromServer = (raw: Raw): Versioned<Space> => {
  const { description, ...rest } = reviveDates(raw);
  return { ...rest, ...(description === null ? {} : { description }) } as unknown as Versioned<Space>;
};
export const ticketFromServer = (raw: Raw): Versioned<Issue> => reviveDates(raw) as unknown as Versioned<Issue>;

const map = async <T, R>(call: Promise<AuthResult<T>>, convert: (value: T) => R): Promise<AuthResult<R>> => {
  const result = await call;
  return result.ok ? { ok: true, data: convert(result.data) } : result;
};
const org = (orgId: string) => `/api/orgs/${encodeURIComponent(orgId)}`;

export interface KvData { shared: Record<string, string> | null; mine: Record<string, string> }
export type KvChanges = Record<string, string | null>;
/** The settings-style data (projects, roadmaps, dashboards, preferences). `shared` is null for a person who may not see the organisation's shared data. */
export const readKv = (orgId: string) => send<KvData>('GET', `${org(orgId)}/kv`);
export const writeKv = (orgId: string, changes: { shared?: KvChanges; mine?: KvChanges }) => send<void>('PUT', `${org(orgId)}/kv`, changes);

export type ObjectKind = 'project' | 'roadmap' | 'dashboard' | 'storybox' | 'mindmap';
export interface ServerObject { id: string; position: number; doc: Record<string, unknown>; version: number; level: 'view' | 'edit' | 'manage' }
/** Projects, roadmaps and dashboards, one row each, so access can be given to one and not another (ADR-0010). The list holds only what the person may view. */
export const listObjects = (orgId: string, kind: ObjectKind) => send<ServerObject[]>('GET', `${org(orgId)}/objects/${kind}`);
export const saveObject = (orgId: string, kind: ObjectKind, id: string, body: { doc: Record<string, unknown>; version?: number; position?: number }) =>
  send<ServerObject>('PUT', `${org(orgId)}/objects/${kind}/${encodeURIComponent(id)}`, body);
export const deleteObject = (orgId: string, kind: ObjectKind, id: string, version: number) => send<void>('DELETE', `${org(orgId)}/objects/${kind}/${encodeURIComponent(id)}`, { version });

export const listSpaces = (orgId: string) => map(send<Raw[]>('GET', `${org(orgId)}/spaces`), rows => rows.map(spaceFromServer));
export const createSpaceOnServer = (orgId: string, space: Parameters<typeof spaceToServer>[0]) => map(send<Raw>('POST', `${org(orgId)}/spaces`, spaceToServer(space)), spaceFromServer);
export const updateSpaceOnServer = (orgId: string, id: number, version: number, changes: Partial<Pick<Space, 'name' | 'icon' | 'color' | 'description'>>) =>
  map(send<Raw>('PATCH', `${org(orgId)}/spaces/${id}`, { version, ...changes }), spaceFromServer);
export const deleteSpaceOnServer = (orgId: string, id: number, version: number) => send<void>('DELETE', `${org(orgId)}/spaces/${id}`, { version });

export const listTickets = (orgId: string, spaceId: number) => map(send<Raw[]>('GET', `${org(orgId)}/spaces/${spaceId}/tickets`), rows => rows.map(ticketFromServer));
export const createTicketOnServer = (orgId: string, spaceId: number, issue: Partial<Issue>) =>
  map(send<Raw>('POST', `${org(orgId)}/spaces/${spaceId}/tickets`, ticketToServer(issue)), ticketFromServer);
export const updateTicketOnServer = (orgId: string, id: number, version: number, changes: Partial<Issue>) =>
  map(send<Raw>('PATCH', `${org(orgId)}/tickets/${id}`, { version, ...ticketToServer(changes, true) }), ticketFromServer);
export const deleteTicketOnServer = (orgId: string, id: number, version: number) => send<void>('DELETE', `${org(orgId)}/tickets/${id}`, { version });
