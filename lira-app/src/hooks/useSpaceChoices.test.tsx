import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount, qa, settle } from '../test/render';
import { useSpaceChoices } from './useSpaceChoices';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const row = (id: number, key: string, name: string) => ({ id, key, name, icon: 'x', color: '#000000', version: 1, description: null, createdAt: '2026-11-20T00:00:00.000Z' });
let fetchMock: ReturnType<typeof vi.fn>;
function Probe({ org }: { org: string }) { return <ul>{useSpaceChoices(org).map(c => <li key={c.id}>{c.id}:{c.name}</li>)}</ul>; }
const shown = () => qa('li').map(li => li.textContent);

beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useSpaceChoices', () => {
  it('lists the id and name of each space the server returns', async () => {
    fetchMock.mockResolvedValue(json(200, [row(4, 'AAA', 'Alpha'), row(9, 'BBB', 'Beta')]));
    mount(<Probe org="org-1" />);
    await settle(30);
    expect(shown()).toEqual(['4:Alpha', '9:Beta']);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/orgs/org-1/spaces');
  });

  it('is empty when the server refuses or cannot be reached', async () => {
    fetchMock.mockResolvedValue(json(500, {}));
    mount(<Probe org="org-1" />);
    await settle(30);
    expect(shown()).toEqual([]);
    cleanup();
    fetchMock.mockRejectedValue(new TypeError('offline'));
    mount(<Probe org="org-1" />);
    await settle(30);
    expect(shown()).toEqual([]);
  });
});
