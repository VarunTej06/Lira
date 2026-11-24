import { afterEach, describe, expect, it } from 'vitest';
import { activeOrg, chooseOrg, isInvitedMember, organisations, setActiveOrg, setOrganisations, sprintsHidden, workspaceLabel } from './hostedOrg';

afterEach(() => { setActiveOrg(null); setOrganisations([]); });

describe('choosing the workspace', () => {
  const mine = { orgId: 'own', orgName: 'Asha Rao space', role: 'owner' };
  const shared = { orgId: 'theirs', orgName: 'Acme', role: 'guest' };

  it('opens their own (the first the server lists) unless they switched to one they are still in', () => {
    expect(chooseOrg([mine, shared], null)).toBe(mine);
    expect(chooseOrg([mine, shared], 'theirs')).toBe(shared);
    expect(chooseOrg([mine, shared], 'gone')).toBe(mine); // removed from it since
    expect(chooseOrg([], 'theirs')).toBeUndefined();
  });

  it('names the workspaces for the account menu', () => {
    expect(workspaceLabel(mine)).toBe('My workspace');
    expect(workspaceLabel(shared)).toBe('Acme (invited)');
  });

  it('remembers the list and whether sprints are hidden, until cleared', () => {
    setOrganisations([mine, shared]);
    expect(organisations()).toHaveLength(2);
    expect(sprintsHidden()).toBe(false);
    setActiveOrg('theirs', 'guest', true);
    expect(sprintsHidden()).toBe(true);
    setActiveOrg(null);
    expect(sprintsHidden()).toBe(false);
  });
});

describe('being in an organisation by invitation', () => {
  it('is true for Member, Viewer and Guest, false for Owner and Admin, and false when no organisation is set (the local app)', () => {
    expect(isInvitedMember()).toBe(false);
    setActiveOrg('org-1');
    expect(isInvitedMember()).toBe(false);
    for (const role of ['owner', 'admin']) { setActiveOrg('org-1', role); expect(isInvitedMember(), role).toBe(false); }
    for (const role of ['member', 'viewer', 'guest']) { setActiveOrg('org-1', role); expect(isInvitedMember(), role).toBe(true); }
    setActiveOrg(null);
    expect(isInvitedMember()).toBe(false);
  });
});

describe('active organisation', () => {
  it('is none until one is set, then the one that was set', () => {
    expect(activeOrg()).toBeNull();
    setActiveOrg('org-1');
    expect(activeOrg()).toBe('org-1');
  });

  it('is kept in memory only, never in the browser storage', () => {
    setActiveOrg('org-1');
    expect(JSON.stringify({ ...localStorage })).not.toContain('org-1');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('org-1');
  });

  it('can be cleared, as at sign-out', () => {
    setActiveOrg('org-1');
    setActiveOrg(null);
    expect(activeOrg()).toBeNull();
  });
});
