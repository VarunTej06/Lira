import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../types/issue';
import {
  createSpaceOnServer, createTicketOnServer, deleteTicketOnServer, listSpaces, listTickets, spaceFromServer, spaceToServer, ticketFromServer, ticketToServer,
  updateTicketOnServer,
} from './workspaceApi';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const stubFetch = (reply: () => Response) => { const f = vi.fn(async (_url: string, _init?: RequestInit) => reply()); vi.stubGlobal('fetch', f); return f; };
afterEach(() => vi.unstubAllGlobals());

const at = '2026-11-20T10:00:00.000Z';
const file = { id: 'f', name: 'a.png', size: 1, type: 'image/png', createdAt: new Date(at) };
const issue = {
  id: 4, key: 'LIRA-4', spaceId: 1, title: 'Fix', description: '<p>x</p>', type: 'task', status: 'todo', priority: 'medium', rank: 10, labels: [],
  reporter: 'A', reporterInitials: 'A', subtasks: [], activity: [], linkedIssues: [], watchers: [], createdAt: new Date(at), updatedAt: new Date(at), version: 3,
  attachments: [file],
  comments: [{ id: 'c', author: 'A', authorInitials: 'A', content: 'hi', createdAt: new Date(at), attachments: [file] }],
  legacyField: 'old', unknownThing: 1,
} as unknown as Issue;

describe('ticketToServer', () => {
  it('sends only the fields the API accepts: no id, key, space, version, dates the server owns, files or unknown fields', () => {
    const body = ticketToServer(issue);
    for (const name of ['id', 'key', 'spaceId', 'version', 'createdAt', 'updatedAt', 'attachments', 'legacyField', 'unknownThing']) expect(body, name).not.toHaveProperty(name);
    expect(body).toMatchObject({ title: 'Fix', status: 'todo', rank: 10, description: '<p>x</p>' });
  });

  it('leaves files inside comments out too', () => {
    const [comment] = ticketToServer(issue).comments as object[];
    expect(comment).not.toHaveProperty('attachments');
    expect(comment).toMatchObject({ id: 'c', content: 'hi' });
  });

  it('turns a field that was removed into null for a change, but not for a new ticket', () => {
    expect(ticketToServer({ assignee: undefined, title: 'x' }, true)).toEqual({ assignee: null, title: 'x' });
    expect(ticketToServer({ assignee: undefined, title: 'x' })).toEqual({ title: 'x' });
  });
});

describe('what comes back', () => {
  it('turns date text into Date objects in the ticket, its comments and its status log, and leaves other text alone', () => {
    const t = ticketFromServer({ id: 1, title: at, createdAt: at, dueDate: at, blockedAt: at, comments: [{ createdAt: at }], statusLog: [{ from: 'a', to: 'b', at }] });
    expect(t.createdAt).toBeInstanceOf(Date);
    expect(t.dueDate).toBeInstanceOf(Date);
    expect(t.comments[0].createdAt).toBeInstanceOf(Date);
    expect(t.statusLog![0].at).toBeInstanceOf(Date);
    expect(t.title).toBe(at);
    expect(t.blockedAt).toBe(at);
  });

  it('keeps a space description only when there is one', () => {
    expect(spaceFromServer({ id: 1, key: 'A', description: null, createdAt: at })).not.toHaveProperty('description');
    expect(spaceFromServer({ id: 1, key: 'A', description: 'd', createdAt: at }).description).toBe('d');
  });

  it('sends a space with only the fields the API accepts', () => {
    expect(spaceToServer({ key: 'A1', name: 'A', icon: 'rocket', color: '#336699', description: '' })).toEqual({ key: 'A1', name: 'A', icon: 'rocket', color: '#336699' });
  });
});

describe('calls', () => {
  it('list calls ask for the organisation and space, from the same site, with the session cookie', async () => {
    const f = stubFetch(() => json(200, []));
    await listSpaces('o 1');
    await listTickets('o', 7);
    expect(f.mock.calls.map(c => c[0])).toEqual(['/api/orgs/o%201/spaces', '/api/orgs/o/spaces/7/tickets']);
    expect((f.mock.calls[0][1] as RequestInit).credentials).toBe('same-origin');
  });

  it('a change names the version it was based on; a delete too', async () => {
    const f = stubFetch(() => json(200, { id: 4, version: 4, createdAt: at }));
    await updateTicketOnServer('o', 4, 3, { status: 'done' });
    await deleteTicketOnServer('o', 4, 4);
    expect(f.mock.calls[0][0]).toBe('/api/orgs/o/tickets/4');
    expect(JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)).toEqual({ version: 3, status: 'done' });
    expect((f.mock.calls[1][1] as RequestInit).method).toBe('DELETE');
    expect(JSON.parse((f.mock.calls[1][1] as RequestInit).body as string)).toEqual({ version: 4 });
  });

  it('gives back the ticket with real dates after a create, and the message after a refusal', async () => {
    stubFetch(() => json(201, { id: 9, key: 'LIRA-9', version: 1, createdAt: at }));
    const made = await createTicketOnServer('o', 1, issue);
    expect(made.ok && made.data.createdAt).toBeInstanceOf(Date);
    stubFetch(() => json(409, { error: { code: 'key_taken', message: 'A space with this key already exists.' } }));
    expect(await createSpaceOnServer('o', { key: 'A1', name: 'A', icon: 'x', color: '#336699' })).toMatchObject({ ok: false, status: 409, message: 'A space with this key already exists.' });
  });

  it('says it could not reach the server when there is no answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await listSpaces('o')).toMatchObject({ ok: false, status: 0 });
  });
});
