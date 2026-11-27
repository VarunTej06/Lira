import { describe, expect, it, vi } from 'vitest';
import { inviteToBox } from './storyInvites';

const ok = { ok: true as const, data: {} as never };
const notYet = { ok: false as const, status: 404, message: 'Not found.' };
const refused = { ok: false as const, status: 403, message: 'You do not have access to this.' };
const wait = async () => undefined;
type Reply = typeof ok | typeof notYet | typeof refused;
const fake = (...replies: Reply[]) => { const f = vi.fn<(org: string, g: Record<string, unknown>) => Promise<Reply>>(); replies.forEach((r, i) => (i === replies.length - 1 ? f.mockResolvedValue(r) : f.mockResolvedValueOnce(r))); return f; };

describe('inviting teams and people to a story box', () => {
  it('gives each team and each person a view of the box, teams first', async () => {
    const grant = fake(ok);
    const r = await inviteToBox('o', 'box1', { teams: ['t1'], users: ['u1', 'u2'] }, { grant: grant as never, wait });
    expect(r).toEqual({ failed: 0, reason: '' });
    expect(grant.mock.calls.map(c => c[1])).toEqual([
      { subjectType: 'team', subjectId: 't1', kind: 'storybox', objectId: 'box1', level: 'view' },
      { subjectType: 'user', subjectId: 'u1', kind: 'storybox', objectId: 'box1', level: 'view' },
      { subjectType: 'user', subjectId: 'u2', kind: 'storybox', objectId: 'box1', level: 'view' },
    ]);
  });

  it('does nothing when nobody was chosen', async () => {
    const grant = fake(ok);
    expect(await inviteToBox('o', 'b', { teams: [], users: [] }, { grant: grant as never, wait })).toEqual({ failed: 0, reason: '' });
    expect(grant).not.toHaveBeenCalled();
  });

  it('waits and tries again while the box has not reached the server yet', async () => {
    const grant = fake(notYet, notYet, ok);
    const sleeps: number[] = [];
    const r = await inviteToBox('o', 'b', { teams: [], users: ['u1'] }, { grant: grant as never, wait: async ms => { sleeps.push(ms); } });
    expect(r.failed).toBe(0);
    expect(grant).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([1000, 1000]);
  });

  it('gives up after a few tries and says how many could not be invited', async () => {
    const grant = fake(notYet);
    const r = await inviteToBox('o', 'b', { teams: ['t1'], users: [] }, { grant: grant as never, wait });
    expect(r).toEqual({ failed: 1, reason: 'Not found.' });
    expect(grant).toHaveBeenCalledTimes(8);
  });

  it('does not wait or repeat for a refusal, and goes on to the next person', async () => {
    const grant = fake(refused, ok);
    const sleeps = vi.fn(async () => undefined);
    const r = await inviteToBox('o', 'b', { teams: [], users: ['u1', 'u2'] }, { grant: grant as never, wait: sleeps });
    expect(r).toEqual({ failed: 1, reason: 'You do not have access to this.' });
    expect(grant).toHaveBeenCalledTimes(2);
    expect(sleeps).not.toHaveBeenCalled();
  });
});
