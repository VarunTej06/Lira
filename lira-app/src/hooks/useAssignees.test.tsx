import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount, q, settle } from '../test/render';
import { setActiveOrg } from '../utils/hostedOrg';
import { forgetAssignees, useAssignees } from './useAssignees';

const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../utils/edition')>()), isHosted: () => hosted.on }));
const api = vi.hoisted(() => ({ listAssignable: vi.fn() }));
vi.mock('../services/workspaceApi', () => api);

function Probe({ space }: { space: number | undefined }) {
  const options = useAssignees(space);
  return <p id="out">{options.map(o => `${o.value}|${o.label}|${o.initials}`).join(';')}</p>;
}

beforeEach(() => { hosted.on = false; setActiveOrg(null); forgetAssignees(); api.listAssignable.mockReset(); localStorage.clear(); });
afterEach(cleanup);

describe('who a ticket can be given to, in the local edition', () => {
  it('starts with Unassigned, then the person using Lira, then the sample team, and asks no server', () => {
    mount(<Probe space={1} />);
    const options = q('#out')!.textContent!.split(';');
    expect(options[0]).toBe('|Unassigned|');
    expect(options[1]).toContain('Varuntej Yadla');
    expect(options.some(o => o.startsWith('Alex Morgan'))).toBe(true);
    expect(options.filter(o => o.startsWith('Varuntej Yadla'))).toHaveLength(1); // the person is not listed twice
    expect(api.listAssignable).not.toHaveBeenCalled();
  });
  it('adds the person using Lira when they are not one of the sample team', () => {
    localStorage.setItem('lira_user_profile', JSON.stringify({ name: 'Maya Rao', email: 'm@x.io', initials: 'MR', role: 'Engineer' }));
    mount(<Probe space={1} />);
    expect(q('#out')!.textContent).toContain('Maya Rao|Maya Rao (MR)|MR');
  });
});

describe('who a ticket can be given to, in the hosted edition', () => {
  beforeEach(() => { hosted.on = true; setActiveOrg('org-1', 'member'); });

  it('lists the people of the space from the server, with initials from their names, after Unassigned', async () => {
    api.listAssignable.mockResolvedValue({ ok: true, data: [{ userId: 'u1', name: 'Asha Rao' }, { userId: 'u2', name: 'Ben' }] });
    mount(<Probe space={4} />);
    await settle(20);
    expect(api.listAssignable).toHaveBeenCalledWith('org-1', 4);
    expect(q('#out')!.textContent).toBe('|Unassigned|;Asha Rao|Asha Rao (AR)|AR;Ben|Ben (B)|B');
    expect(q('#out')!.textContent).not.toContain('Alex Morgan'); // the sample team is not offered to real people
  });
  it('asks once for a space however many tickets on the screen ask, and again for another space', async () => {
    api.listAssignable.mockResolvedValue({ ok: true, data: [] });
    mount(<><Probe space={4} /><Probe space={4} /><Probe space={5} /></>);
    await settle(20);
    expect(api.listAssignable.mock.calls.map(c => c[1]).sort()).toEqual([4, 5]);
  });
  it('offers only Unassigned when the server cannot be reached, so that nothing wrong is offered', async () => {
    api.listAssignable.mockResolvedValue({ ok: false, status: 0, message: 'offline' });
    mount(<Probe space={4} />);
    await settle(20);
    expect(q('#out')!.textContent).toBe('|Unassigned|');
  });
  it('asks nothing before there is a space', async () => {
    mount(<Probe space={undefined} />);
    await settle(20);
    expect(api.listAssignable).not.toHaveBeenCalled();
  });
});
