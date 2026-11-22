import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { createIssue } from '../hooks/useIssues';
import { createSpace } from '../hooks/useSpaces';
import { makeIssue, makeSpace } from '../test/factories';
import { applyServerProfile } from '../utils/hostedProfile';
import { activeOrg, setActiveOrg } from '../utils/hostedOrg';
import { flushDiskSync, initLocalDiskSync, saveToDiskNow, triggerDiskSync } from './localDiskSync';

// The hosted edition: the same functions the screens already call, now sending everything to the server instead of to a file on this PC.
const hosted = vi.hoisted(() => ({
  initHostedSync: vi.fn(async () => undefined), flushHostedSync: vi.fn(async () => undefined),
  createIssueHosted: vi.fn(async () => 41), createSpaceHosted: vi.fn(async () => 42),
}));
vi.mock('./hostedSync', () => hosted);
vi.mock('../utils/edition', () => ({ isHosted: () => true }));

let fetched: string[];
beforeEach(async () => {
  Object.values(hosted).forEach(f => f.mockClear());
  fetched = [];
  vi.stubGlobal('fetch', async (url: string) => { fetched.push(url); return new Response('{}'); });
  await db.issues.clear(); await db.spaces.clear();
  localStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); setActiveOrg(null); });

describe('the save and load seam in the hosted edition', () => {
  it('loads from the server, with no seed data and no request to the local file API', async () => {
    await initLocalDiskSync();
    expect(hosted.initHostedSync).toHaveBeenCalledTimes(1);
    expect(fetched).toEqual([]);
    expect(await db.spaces.count()).toBe(0);
    expect(await db.issues.count()).toBe(0);
  });

  it('carries on with an empty workspace when the server cannot be asked, instead of stopping the app', async () => {
    hosted.initHostedSync.mockRejectedValueOnce(new Error('down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(initLocalDiskSync()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not write the local file, nor mark the browser as holding unsaved changes', async () => {
    triggerDiskSync();
    expect(localStorage.length).toBe(0);
    expect(await saveToDiskNow()).toBe(true);
    flushDiskSync();
    expect(fetched).toEqual([]);
    expect(hosted.flushHostedSync).toHaveBeenCalledTimes(2);
  });
});

describe('creating in the hosted edition', () => {
  it('goes to the server first, and the number it gives back is the one the screen gets', async () => {
    const { id: _a, ...ticket } = makeIssue({ spaceId: 1 });
    expect(await createIssue(ticket)).toBe(41);
    const { id: _b, ...space } = makeSpace();
    expect(await createSpace(space)).toBe(42);
    expect(hosted.createIssueHosted).toHaveBeenCalledWith(expect.objectContaining({ spaceId: 1, sprint: expect.any(String) }));
    expect(await db.issues.count()).toBe(0);
    expect(await db.spaces.count()).toBe(0);
  });
});

describe('which organisation the app shows', () => {
  it('is the first one the server names when the session is checked, and none before that', () => {
    expect(activeOrg()).toBeNull();
    applyServerProfile({ user: { id: 'u', email: 'a@b.co', name: 'Asha Rao' }, organisations: [{ orgId: 'org-9', orgName: 'Asha', role: 'owner' }] });
    expect(activeOrg()).toBe('org-9');
    applyServerProfile({ user: { id: 'u', email: 'a@b.co', name: 'Asha Rao' }, organisations: [] });
    expect(activeOrg()).toBeNull();
  });
});
