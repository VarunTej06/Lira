import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acceptInvitation, createTeam, invite, inviteLink, listGrants, removeMember, revokeGrant, setGrant, setTeamMembers, updateMember,
} from './accessApi';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
type Call = [string, RequestInit];
const stub = (reply: () => Response = () => json(200, {})) => {
  const f = vi.fn(async (_url: string, _init?: RequestInit) => reply());
  vi.stubGlobal('fetch', f);
  return () => (f.mock.calls as unknown as Call[]).map(c => [c[1].method, c[0], c[1].body ? JSON.parse(c[1].body as string) : undefined]);
};
afterEach(() => vi.unstubAllGlobals());

describe('access calls', () => {
  it('go to the organisation\'s own routes, with the right method and body, from the same site with the session cookie', async () => {
    const calls = stub();
    await updateMember('o 1', 'u1', { role: 'viewer' });
    await removeMember('o 1', 'u1');
    await createTeam('o 1', 'QA');
    await setTeamMembers('o 1', 't1', ['u1']);
    await setGrant('o 1', { subjectType: 'team', subjectId: 't1', kind: 'space', objectId: '4', level: 'edit' });
    await revokeGrant('o 1', 'g1');
    await listGrants('o 1', 'project', 'p 1');
    await invite('o 1', { email: 'a@b.co', role: 'member', teamId: 't1' });
    expect(calls()).toEqual([
      ['PATCH', '/api/orgs/o%201/members/u1', { role: 'viewer' }],
      ['DELETE', '/api/orgs/o%201/members/u1', undefined],
      ['POST', '/api/orgs/o%201/teams', { name: 'QA' }],
      ['PUT', '/api/orgs/o%201/teams/t1/members', { userIds: ['u1'] }],
      ['POST', '/api/orgs/o%201/grants', { subjectType: 'team', subjectId: 't1', kind: 'space', objectId: '4', level: 'edit' }],
      ['DELETE', '/api/orgs/o%201/grants/g1', undefined],
      ['GET', '/api/orgs/o%201/grants?kind=project&objectId=p%201', undefined],
      ['POST', '/api/orgs/o%201/invitations', { email: 'a@b.co', role: 'member', teamId: 't1' }],
    ]);
  });

  it('accepts an invitation with only the link\'s token', async () => {
    const calls = stub();
    await acceptInvitation('t'.repeat(43));
    expect(calls()).toEqual([['POST', '/api/invitations/accept', { token: 't'.repeat(43) }]]);
  });

  it('gives back the server\'s message and field messages when it refuses', async () => {
    stub(() => json(409, { error: { message: 'A team with this name already exists.', fields: { name: 'Taken.' } } }));
    expect(await createTeam('o', 'QA')).toMatchObject({ ok: false, status: 409, message: 'A team with this name already exists.', fields: { name: 'Taken.' } });
  });
});

describe('invite link', () => {
  it('is the site address, the invite page and the token', () => {
    expect(inviteLink('abc', 'https://test.liraspaces.com')).toBe('https://test.liraspaces.com/invite?token=abc');
  });
});
