import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diffForServer, flushKv, refreshCollections, resetHostedKv, startHostedKv } from './kvMirror';

const api = vi.hoisted(() => ({ readKv: vi.fn(), writeKv: vi.fn(), listObjects: vi.fn(), saveObject: vi.fn(), deleteObject: vi.fn() }));
vi.mock('./workspaceApi', () => api);

const ok = <T,>(data: T) => ({ ok: true as const, data });
const down = { ok: false as const, status: 0, message: 'Could not reach the server.' };

beforeEach(() => { localStorage.clear(); resetHostedKv(); Object.values(api).forEach(f => f.mockReset()); api.writeKv.mockResolvedValue(ok(undefined)); api.listObjects.mockResolvedValue(ok([])); api.saveObject.mockResolvedValue(ok({ version: 1 })); api.deleteObject.mockResolvedValue(ok(undefined)); });
afterEach(() => resetHostedKv());

describe('diffForServer', () => {
  it('sends changed and new entries, and null for ones that are gone, split into shared and personal', () => {
    const diff = diffForServer(
      { lira_standups: 'new', lira_sprint_defs: 'same', lira_theme: 'dark' },
      { lira_standups: 'old', lira_sprint_defs: 'same', lira_team_directory: 'x', lira_pref_lang: 'en' },
      true,
    );
    expect(diff).toEqual({ shared: { lira_standups: 'new', lira_team_directory: null }, mine: { lira_theme: 'dark', lira_pref_lang: null } });
  });

  it('sends no shared data for a person who may not reach it', () => {
    const diff = diffForServer({ lira_standups: 'x', lira_theme: 'dark' }, {}, false);
    expect(diff).toEqual({ shared: {}, mine: { lira_theme: 'dark' } });
  });
});

describe('the hosted edition\'s store', () => {
  it('replaces whatever the browser held with what the server has, and never the other way round', async () => {
    localStorage.setItem('lira_standups', 'another account');
    localStorage.setItem('lira_theme', 'light');
    api.readKv.mockResolvedValue(ok({ shared: { lira_sprint_defs: '{}' }, mine: { lira_theme: 'dark' } }));
    expect(await startHostedKv('org-1')).toBe(true);
    expect(localStorage.getItem('lira_standups')).toBeNull();
    expect(localStorage.getItem('lira_sprint_defs')).toBe('{}');
    expect(localStorage.getItem('lira_theme')).toBe('dark');
    expect(api.writeKv).not.toHaveBeenCalled();
  });

  it('says it could not start when the server cannot be asked, and leaves the browser as it was', async () => {
    localStorage.setItem('lira_theme', 'light');
    api.readKv.mockResolvedValue(down);
    expect(await startHostedKv('org-1')).toBe(false);
    expect(localStorage.getItem('lira_theme')).toBe('light');
  });

  it('sends a change to the server shortly after it is made, only what changed, and then holds it as saved', async () => {
    api.readKv.mockResolvedValue(ok({ shared: { lira_standups: '[]' }, mine: {} }));
    await startHostedKv('org-1');
    localStorage.setItem('lira_standups', '[1]');
    localStorage.setItem('lira_theme', 'dark');
    await flushKv();
    expect(api.writeKv).toHaveBeenCalledWith('org-1', { shared: { lira_standups: '[1]' } });
    expect(api.writeKv).toHaveBeenCalledWith('org-1', { mine: { lira_theme: 'dark' } });
    api.writeKv.mockClear();
    await flushKv();
    expect(api.writeKv).not.toHaveBeenCalled();
  });

  it('sends a removal as null', async () => {
    api.readKv.mockResolvedValue(ok({ shared: {}, mine: { lira_theme: 'dark' } }));
    await startHostedKv('org-1');
    localStorage.removeItem('lira_theme');
    await flushKv();
    expect(api.writeKv).toHaveBeenCalledWith('org-1', { mine: { lira_theme: null } });
  });

  it('never sends AI keys, and never sends shared data when the person has no access to it', async () => {
    api.readKv.mockResolvedValue(ok({ shared: null, mine: {} }));
    await startHostedKv('org-1');
    localStorage.setItem('lira_gemini_api_key', 'secret');
    localStorage.setItem('lira_standups', 'mine alone');
    localStorage.setItem('lira_theme', 'dark');
    await flushKv();
    const sent = JSON.stringify(api.writeKv.mock.calls);
    expect(sent).not.toContain('secret');
    expect(sent).not.toContain('lira_standups');
    expect(sent).toContain('lira_theme');
  });

  it('keeps the change and says it failed when the server does not answer, then sends it on the next try', async () => {
    api.readKv.mockResolvedValue(ok({ shared: {}, mine: {} }));
    await startHostedKv('org-1');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    api.writeKv.mockResolvedValueOnce(down);
    localStorage.setItem('lira_theme', 'dark');
    expect(await flushKv()).toBe(false);
    api.writeKv.mockClear();
    expect(await flushKv()).toBe(true);
    expect(api.writeKv).toHaveBeenCalledWith('org-1', { mine: { lira_theme: 'dark' } });
    warn.mockRestore();
  });

  it('splits a large save into requests of at most 100 entries', async () => {
    api.readKv.mockResolvedValue(ok({ shared: {}, mine: {} }));
    await startHostedKv('org-1');
    for (let i = 0; i < 230; i++) localStorage.setItem(`lira_pref_${i}`, 'v');
    await flushKv();
    expect(api.writeKv.mock.calls.map(c => Object.keys(c[1].mine).length)).toEqual([100, 100, 30]);
  });
});

describe('projects, roadmaps and dashboards in the hosted edition', () => {
  it('come from their own rows, not from the shared settings, and replace what the browser held', async () => {
    localStorage.setItem('lira_projects', '[{"id":"left-behind"}]');
    api.readKv.mockResolvedValue(ok({ shared: { lira_projects: '[{"id":"old-kv"}]' }, mine: {} }));
    api.listObjects.mockImplementation(async (_org: string, kind: string) => ok(kind === 'project' ? [{ id: 'p1', position: 0, doc: { id: 'p1', name: 'Real' }, version: 1, level: 'manage' }] : []));
    expect(await startHostedKv('org-1')).toBe(true);
    expect(JSON.parse(localStorage.getItem('lira_projects')!)).toEqual([{ id: 'p1', name: 'Real' }]);
    expect(localStorage.getItem('lira_roadmaps')).toBeNull();
  });

  it('are sent as rows when they change, and never as shared settings', async () => {
    api.readKv.mockResolvedValue(ok({ shared: {}, mine: {} }));
    await startHostedKv('org-1');
    localStorage.setItem('lira_roadmaps', JSON.stringify([{ id: 'r1', name: 'Plan' }]));
    await flushKv();
    expect(api.saveObject).toHaveBeenCalledWith('org-1', 'roadmap', 'r1', { doc: { id: 'r1', name: 'Plan' }, position: 0 });
    expect(JSON.stringify(api.writeKv.mock.calls)).not.toContain('lira_roadmaps');
  });

  it('are read again from the server when it refuses a change, so the screen shows what is really saved', async () => {
    api.readKv.mockResolvedValue(ok({ shared: {}, mine: {} }));
    await startHostedKv('org-1');
    api.saveObject.mockResolvedValue({ ok: false, status: 403, message: 'no' });
    api.listObjects.mockResolvedValue(ok([]));
    localStorage.setItem('lira_dashboards', JSON.stringify([{ id: 'd1' }]));
    await flushKv();
    expect(localStorage.getItem('lira_dashboards')).toBeNull();
  });

  it('keeps the change and says it failed when the server cannot be reached', async () => {
    api.readKv.mockResolvedValue(ok({ shared: {}, mine: {} }));
    await startHostedKv('org-1');
    api.saveObject.mockResolvedValue(down);
    localStorage.setItem('lira_projects', JSON.stringify([{ id: 'p1' }]));
    expect(await flushKv()).toBe(false);
    expect(localStorage.getItem('lira_projects')).not.toBeNull();
  });
});

describe('the look the person chose', () => {
  it('stays when they sign in with nothing saved for it, and is saved for next time', async () => {
    localStorage.setItem('lira_theme', 'dark');
    localStorage.setItem('lira_dark_palette', 'blackridge');
    localStorage.setItem('lira_standups', 'left behind');
    api.readKv.mockResolvedValue(ok({ shared: {}, mine: {} }));
    await startHostedKv('org-1');
    expect(localStorage.getItem('lira_theme')).toBe('dark');
    expect(localStorage.getItem('lira_dark_palette')).toBe('blackridge');
    expect(localStorage.getItem('lira_standups')).toBeNull(); // everything else of the earlier visit is gone
    await flushKv();
    expect(api.writeKv).toHaveBeenCalledWith('org-1', { mine: { lira_theme: 'dark', lira_dark_palette: 'blackridge' } });
  });

  it('is the one the server has for the person, when it has one, not the one this browser held', async () => {
    localStorage.setItem('lira_theme', 'dark');
    api.readKv.mockResolvedValue(ok({ shared: {}, mine: { lira_theme: 'light' } }));
    await startHostedKv('org-1');
    expect(localStorage.getItem('lira_theme')).toBe('light');
  });
});

describe('another person changes a project, roadmap, dashboard, storyboard or story box', () => {
  const row = (id: string, name: string, version = 1) => ({ id, position: 0, doc: { id, name }, version, level: 'manage' });
  const started = async () => {
    api.readKv.mockResolvedValue(ok({ shared: {}, mine: {} }));
    api.listObjects.mockImplementation(async (_o: string, kind: string) => ok(kind === 'roadmap' ? [row('r1', 'Plan')] : []));
    expect(await startHostedKv('org-1')).toBe(true);
  };

  it('reads each list again, puts the server\'s copy in the browser and tells the screens', async () => {
    await started();
    api.listObjects.mockImplementation(async (_o: string, kind: string) => ok(kind === 'roadmap' ? [row('r1', 'Renamed by someone', 2)] : kind === 'mindmap' ? [row('m1', 'New map')] : []));
    const heard: (string | null)[] = [];
    const listener = (e: Event) => heard.push((e as StorageEvent).key);
    window.addEventListener('storage', listener);
    await refreshCollections();
    window.removeEventListener('storage', listener);
    expect(JSON.parse(localStorage.getItem('lira_roadmaps')!)).toEqual([{ id: 'r1', name: 'Renamed by someone' }]);
    expect(JSON.parse(localStorage.getItem('lira_mindmaps')!)).toEqual([{ id: 'm1', name: 'New map' }]);
    expect(heard.sort()).toEqual(['lira_mindmaps', 'lira_roadmaps']); // only the lists that changed
  });

  it('does not touch a browser that still has changes it has not sent', async () => {
    await started();
    localStorage.setItem('lira_roadmaps', JSON.stringify([{ id: 'r1', name: 'My edit, not sent yet' }])); // marks the browser as having unsent changes
    api.listObjects.mockClear();
    await refreshCollections();
    expect(api.listObjects).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('lira_roadmaps')!)).toEqual([{ id: 'r1', name: 'My edit, not sent yet' }]);
    await flushKv();
  });

  it('does nothing when nobody is signed in to an organisation', async () => {
    await refreshCollections();
    expect(api.listObjects).not.toHaveBeenCalled();
  });
});
