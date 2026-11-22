import { afterEach, describe, expect, it } from 'vitest';
import { activeOrg, setActiveOrg } from './hostedOrg';

afterEach(() => setActiveOrg(null));

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
