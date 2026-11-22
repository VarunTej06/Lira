import { beforeEach, describe, expect, it, vi } from 'vitest';
import { diffCollection, isCollectionKey, loadCollection, resetHostedObjects, syncCollection } from './hostedObjects';

const api = vi.hoisted(() => ({ listObjects: vi.fn(), saveObject: vi.fn(), deleteObject: vi.fn() }));
vi.mock('./workspaceApi', () => api);

const ok = <T,>(data: T) => ({ ok: true as const, data });
const refused = (status: number) => ({ ok: false as const, status, message: 'no' });
const row = (id: string, doc: object, version = 1) => ({ id, position: 0, doc: { id, ...doc }, version, level: 'manage' });

beforeEach(() => { Object.values(api).forEach(f => f.mockReset()); resetHostedObjects(); });

describe('which keys are lists of objects', () => {
  it('are projects, roadmaps and dashboards, and nothing else', () => {
    expect(['lira_projects', 'lira_roadmaps', 'lira_dashboards'].every(isCollectionKey)).toBe(true);
    expect(['lira_theme', 'lira_standups', 'lira_project_settings_a'].some(isCollectionKey)).toBe(false);
  });
});

describe('diffCollection', () => {
  const have = new Map([['a', { version: 2, json: JSON.stringify({ id: 'a', name: 'A' }) }], ['b', { version: 1, json: JSON.stringify({ id: 'b' }) }]]);

  it('creates what is new, changes what differs with its version, deletes what is gone, and leaves the rest', () => {
    const d = diffCollection([{ id: 'a', name: 'A2' }, { id: 'c', name: 'new' }], have);
    expect(d.put).toEqual([{ id: 'a', doc: { id: 'a', name: 'A2' }, position: 0, version: 2 }, { id: 'c', doc: { id: 'c', name: 'new' }, position: 1 }]);
    expect(d.remove).toEqual([{ id: 'b', version: 1 }]);
    expect(diffCollection([{ id: 'a', name: 'A' }, { id: 'b' }], have)).toEqual({ put: [], remove: [] });
  });

  it('skips items without a text id, which cannot be kept on the server', () => {
    expect(diffCollection([{ name: 'no id' }, { id: 5 }, null, 'text'], new Map())).toEqual({ put: [], remove: [] });
  });
});

describe('loading one kind', () => {
  it('turns the rows into the list the app keeps, and remembers what the server has', async () => {
    api.listObjects.mockResolvedValue(ok([row('p1', { name: 'One' }), row('p2', { name: 'Two' }, 3)]));
    const loaded = await loadCollection('org-1', 'lira_projects');
    expect(api.listObjects).toHaveBeenCalledWith('org-1', 'project');
    expect(JSON.parse(loaded!.text!)).toEqual([{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }]);
    api.saveObject.mockResolvedValue(ok({ version: 4 }));
    expect(await syncCollection('org-1', 'lira_projects', loaded!.text)).toBe('ok');
    expect(api.saveObject).not.toHaveBeenCalled(); // nothing changed
  });

  it('gives no list when there is nothing, and null when the server cannot be asked', async () => {
    api.listObjects.mockResolvedValueOnce(ok([]));
    expect(await loadCollection('org-1', 'lira_roadmaps')).toEqual({ text: null });
    api.listObjects.mockResolvedValueOnce(refused(0));
    expect(await loadCollection('org-1', 'lira_roadmaps')).toBeNull();
  });
});

describe('sending changes', () => {
  beforeEach(async () => {
    api.listObjects.mockResolvedValue(ok([row('p1', { name: 'One' }, 2)]));
    await loadCollection('org-1', 'lira_projects');
  });

  it('sends a changed item with its version and a new one without, then holds both as saved', async () => {
    api.saveObject.mockResolvedValueOnce(ok({ version: 3 })).mockResolvedValueOnce(ok({ version: 1 }));
    const text = JSON.stringify([{ id: 'p1', name: 'Renamed' }, { id: 'p9', name: 'New' }]);
    expect(await syncCollection('org-1', 'lira_projects', text)).toBe('ok');
    expect(api.saveObject).toHaveBeenNthCalledWith(1, 'org-1', 'project', 'p1', { doc: { id: 'p1', name: 'Renamed' }, position: 0, version: 2 });
    expect(api.saveObject).toHaveBeenNthCalledWith(2, 'org-1', 'project', 'p9', { doc: { id: 'p9', name: 'New' }, position: 1 });
    api.saveObject.mockClear();
    expect(await syncCollection('org-1', 'lira_projects', text)).toBe('ok');
    expect(api.saveObject).not.toHaveBeenCalled();
  });

  it('deletes an item that was removed, with its version, and does not mind it being gone already', async () => {
    api.deleteObject.mockResolvedValue(refused(404));
    expect(await syncCollection('org-1', 'lira_projects', '[]')).toBe('ok');
    expect(api.deleteObject).toHaveBeenCalledWith('org-1', 'project', 'p1', 2);
    api.deleteObject.mockClear();
    expect(await syncCollection('org-1', 'lira_projects', '[]')).toBe('ok');
    expect(api.deleteObject).not.toHaveBeenCalled();
  });

  it('asks for a reload when the server refuses (someone else changed it, or no access), and to retry when it cannot be reached', async () => {
    for (const status of [403, 404, 409]) {
      api.saveObject.mockResolvedValueOnce(refused(status));
      expect(await syncCollection('org-1', 'lira_projects', JSON.stringify([{ id: 'p1', name: 'x' }])), String(status)).toBe('reload');
    }
    api.saveObject.mockResolvedValueOnce(refused(0));
    expect(await syncCollection('org-1', 'lira_projects', JSON.stringify([{ id: 'p1', name: 'x' }]))).toBe('retry');
    api.saveObject.mockResolvedValueOnce(refused(503));
    expect(await syncCollection('org-1', 'lira_projects', JSON.stringify([{ id: 'p1', name: 'x' }]))).toBe('retry');
  });

  it('leaves text that is not a list alone instead of deleting everything', async () => {
    expect(await syncCollection('org-1', 'lira_projects', 'not json')).toBe('ok');
    expect(await syncCollection('org-1', 'lira_projects', '{"a":1}')).toBe('ok');
    expect(api.deleteObject).not.toHaveBeenCalled();
  });
});
