import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount, settle } from '../test/render';
import { useObjectChoices } from './useObjectChoices';
import type { ObjectChoices } from '../utils/accessRows';

const work = vi.hoisted(() => ({ listSpaces: vi.fn(), listObjects: vi.fn() }));
vi.mock('../services/workspaceApi', () => work);
afterEach(() => cleanup());

let seen: (ObjectChoices | null)[] = [];
function Probe({ org }: { org: string }) { seen.push(useObjectChoices(org)); return null; }

describe('useObjectChoices', () => {
  it('is null while loading, then names every kind, using the id for a thing with no name', async () => {
    seen = [];
    work.listSpaces.mockResolvedValue({ ok: true, data: [{ id: 4, key: 'LIRA', name: 'Lira' }] });
    work.listObjects.mockImplementation(async (_org: string, kind: string) => ({ ok: true, data: kind === 'project' ? [{ id: 'p1', doc: { name: 'Alpha' } }, { id: 'p2', doc: {} }] : [] }));
    mount(<Probe org="o1" />);
    expect(seen[0]).toBeNull();
    await settle(10);
    const last = seen[seen.length - 1]!;
    expect(last.space).toEqual([{ id: '4', name: 'Lira (LIRA)' }]);
    expect(last.project).toEqual([{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'p2' }]);
    expect(last.mindmap).toEqual([]);
  });
  it('treats a kind the server refused as empty instead of failing', async () => {
    seen = [];
    work.listSpaces.mockResolvedValue({ ok: false, status: 500, message: 'x' });
    work.listObjects.mockResolvedValue({ ok: false, status: 403, message: 'x' });
    mount(<Probe org="o2" />);
    await settle(10);
    expect(seen[seen.length - 1]).toEqual({ space: [], project: [], roadmap: [], dashboard: [], storybox: [], mindmap: [] });
  });
});
