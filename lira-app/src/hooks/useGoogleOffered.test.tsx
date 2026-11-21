import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount, q, settle } from '../test/render';
import { forgetProviders, useGoogleOffered } from './useGoogleOffered';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function Probe() { return <p id="offered">{String(useGoogleOffered())}</p>; }
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => { forgetProviders(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useGoogleOffered', () => {
  it('is false at first, then true when the server says Google is set up', async () => {
    fetchMock.mockResolvedValue(json(200, { google: true }));
    mount(<Probe />);
    expect(q('#offered')!.textContent).toBe('false');
    await settle(30);
    expect(q('#offered')!.textContent).toBe('true');
  });

  it('stays false when the server says no, does not answer, or sends something unexpected', async () => {
    for (const reply of [() => json(200, { google: false }), () => { throw new TypeError('offline'); }, () => json(200, {}), () => json(503, {})]) {
      forgetProviders();
      fetchMock.mockImplementation(async () => reply());
      mount(<Probe />);
      await settle(30);
      expect(q('#offered')!.textContent).toBe('false');
      cleanup();
    }
  });

  it('asks the server once and remembers the answer', async () => {
    fetchMock.mockResolvedValue(json(200, { google: true }));
    mount(<Probe />);
    await settle(30);
    cleanup();
    mount(<Probe />);
    await settle(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
