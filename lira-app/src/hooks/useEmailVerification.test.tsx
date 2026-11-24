import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount, q, settle } from '../test/render';
import { forgetVerifications, useEmailVerification } from './useEmailVerification';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
const TOKEN = 'A'.repeat(43);
function Probe({ token }: { token: string }) {
  const s = useEmailVerification(token);
  return <p id="state">{s.phase === 'failed' ? `failed: ${s.message}` : s.phase}</p>;
}

beforeEach(() => { forgetVerifications(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('confirming an email address from a link', () => {
  it('is checking, then ok when the server accepts the link', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    mount(<Probe token={TOKEN} />);
    expect(q('#state')!.textContent).toBe('checking');
    await settle(30);
    expect(q('#state')!.textContent).toBe('ok');
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ token: TOKEN });
  });

  it('says why when the server refuses the link', async () => {
    fetchMock.mockResolvedValue(json(400, { error: { message: 'This link has expired or was already used. Ask for a new one.' } }));
    mount(<Probe token={TOKEN} />);
    await settle(30);
    expect(q('#state')!.textContent).toContain('expired or was already used');
  });

  it('fails at once, without asking the server, when there is no token', () => {
    mount(<Probe token="" />);
    expect(q('#state')!.textContent).toContain('This link is not valid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks once for a link however often it is shown, because a link works only once', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    mount(<><Probe token={TOKEN} /><Probe token={TOKEN} /></>);
    await settle(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
