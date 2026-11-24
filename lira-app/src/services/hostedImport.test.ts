import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeIssue } from '../test/factories';
import type { ImportBundle } from '../utils/importWorkspace';
import { importWorkspace } from './hostedImport';

const api = vi.hoisted(() => ({ createSpaceOnServer: vi.fn(), createTicketOnServer: vi.fn(), updateTicketOnServer: vi.fn(), saveObject: vi.fn() }));
vi.mock('./workspaceApi', () => api);

const ok = <T,>(data: T) => ({ ok: true as const, data });
const refused = (status: number, message: string) => ({ ok: false as const, status, message });
const space = (id: number, key: string) => ({ id, key, name: key, icon: 'x', color: '#336699', createdAt: new Date(), updatedAt: new Date() });
let nextTicket = 100;

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset());
  nextTicket = 100;
  api.createSpaceOnServer.mockImplementation(async (_o: string, s: { key: string }) => ok({ id: 50 + s.key.length, key: s.key }));
  api.createTicketOnServer.mockImplementation(async () => ok({ id: ++nextTicket, version: 1 }));
  api.updateTicketOnServer.mockResolvedValue(ok({ version: 2 }));
  api.saveObject.mockResolvedValue(ok({}));
});

const bundle = (over: Partial<ImportBundle> = {}): ImportBundle => ({ spaces: [], projects: [], roadmaps: [], dashboards: [], ...over });

describe('importing a workspace into the organisation', () => {
  it('makes each space, then its tickets with parents and epics first, pointing at the new numbers and without the old id, key or version', async () => {
    const epic = makeIssue({ id: 5, spaceId: 1, key: 'AAA-5', title: 'Epic', version: 7 }); const child = makeIssue({ id: 6, spaceId: 1, key: 'AAA-6', title: 'Child', epicId: 5, parentId: 5 });
    const r = await importWorkspace('org-1', bundle({ spaces: [{ space: space(1, 'AAA'), issues: [child, epic] }] }));
    expect(r.made).toMatchObject({ spaces: 1, tickets: 2 });
    const [first, second] = api.createTicketOnServer.mock.calls.map(c => c[2]);
    expect(first.title).toBe('Epic');
    expect(second).toMatchObject({ title: 'Child', epicId: 101, parentId: 101, linkedIssues: [] });
    for (const sent of [first, second]) for (const field of ['id', 'key', 'version']) expect(sent).not.toHaveProperty(field);
    expect(api.createTicketOnServer.mock.calls[0][0]).toBe('org-1');
  });

  it('sets links and blockers after every ticket has its new number, and drops ones that point outside what was imported', async () => {
    const a = makeIssue({ id: 1, spaceId: 1, linkedIssues: [{ id: 'l1', issueId: 2, type: 'relates_to' }, { id: 'l2', issueId: 99, type: 'relates_to' }] as never, blockedByIds: [2, 99] });
    const b = makeIssue({ id: 2, spaceId: 1 });
    const r = await importWorkspace('o', bundle({ spaces: [{ space: space(1, 'AAA'), issues: [a, b] }] }));
    expect(r.problems).toEqual([]);
    expect(api.updateTicketOnServer).toHaveBeenCalledTimes(1);
    expect(api.updateTicketOnServer).toHaveBeenCalledWith('o', 101, 1, { linkedIssues: [{ id: 'l1', issueId: 102, type: 'relates_to' }], blockedByIds: [102] });
  });

  it('gives a space a new key when its key is taken, and the roadmap that names it follows', async () => {
    api.createSpaceOnServer.mockImplementation(async (_o: string, s: { key: string }) => (s.key === 'AAA' ? refused(409, 'A space with this key already exists.') : ok({ id: 77, key: s.key })));
    const r = await importWorkspace('o', bundle({ spaces: [{ space: space(1, 'AAA'), issues: [] }], roadmaps: [{ id: 'r1', name: 'Plan', spaceKey: 'AAA' }] }));
    expect(r.made.spaces).toBe(1);
    expect(api.createSpaceOnServer.mock.calls.map(c => c[1].key)).toEqual(['AAA', 'AAA2']);
    expect(api.saveObject.mock.calls[0][3].doc.spaceKey).toBe('AAA2');
  });

  it('reports a ticket or space the server refuses, with its key and the reason, and goes on with the rest', async () => {
    api.createTicketOnServer.mockImplementationOnce(async () => refused(400, 'Use at most 500 characters.')).mockImplementation(async () => ok({ id: ++nextTicket, version: 1 }));
    api.createSpaceOnServer.mockImplementation(async (_o: string, s: { key: string }) => (s.key === 'BAD' ? refused(403, 'You do not have access to this.') : ok({ id: 60, key: s.key })));
    const r = await importWorkspace('o', bundle({ spaces: [{ space: space(1, 'AAA'), issues: [makeIssue({ id: 1, spaceId: 1, key: 'AAA-1' }), makeIssue({ id: 2, spaceId: 1, key: 'AAA-2' })] }, { space: space(2, 'BAD'), issues: [makeIssue({ id: 3, spaceId: 2 })] }] }));
    expect(r.made).toMatchObject({ spaces: 1, tickets: 1 });
    expect(r.problems).toEqual(['AAA-1: Use at most 500 characters.', 'Space BAD was not imported: You do not have access to this.']);
    expect(api.createTicketOnServer).toHaveBeenCalledTimes(2); // none for the space that was refused
  });

  it('moves projects and dashboards to the new space numbers, and reports one the server refuses', async () => {
    api.saveObject.mockImplementation(async (_o: string, kind: string) => (kind === 'dashboard' ? refused(403, 'You do not have access to this.') : ok({})));
    const r = await importWorkspace('o', bundle({ spaces: [{ space: space(1, 'AAA'), issues: [] }], projects: [{ id: 'p1', name: 'One', spaceId: 1 }], dashboards: [{ id: 'd1', name: 'Dash' }] }));
    expect(api.saveObject.mock.calls[0]).toMatchObject([ 'o', 'project', 'p1', { doc: { spaceId: 53 } }]);
    expect(r.made).toMatchObject({ projects: 1, dashboards: 0 });
    expect(r.problems).toEqual(['The dashboard "Dash" was not imported: You do not have access to this.']);
  });

  it('reports its progress, one step for each space, ticket and object', async () => {
    const seen: [number, number][] = [];
    await importWorkspace('o', bundle({ spaces: [{ space: space(1, 'AAA'), issues: [makeIssue({ id: 1, spaceId: 1 })] }], projects: [{ id: 'p', name: 'x' }] }), (d, t) => seen.push([d, t]));
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]]);
  });
});
