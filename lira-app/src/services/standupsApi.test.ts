import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStandup, deleteStandup, isMeetingLink, listStandups, standupAudience, updateStandup } from './standupsApi';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());

describe('meeting links', () => {
  it('are Google Meet and Microsoft Teams addresses over HTTPS, and nothing else', () => {
    for (const ok of ['https://meet.google.com/abc-defg-hij', 'https://teams.microsoft.com/l/meetup-join/x', 'https://teams.live.com/meet/1']) expect(isMeetingLink(ok), ok).toBe(true);
    for (const bad of ['http://meet.google.com/x', 'https://meet.google.com.evil.example/x', 'https://evil.example/meet.google.com', 'https://u:p@meet.google.com/x', 'javascript:alert(1)', 'meet.google.com', '']) expect(isMeetingLink(bad), bad).toBe(false);
  });
});

describe('stand-up calls', () => {
  it('go to the organisation\'s own routes with the right method and body', async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => json(200, []));
    vi.stubGlobal('fetch', f);
    const input = { title: 'Daily', startsAt: '2026-11-23T04:30:00.000Z', durationMinutes: 15, timeZone: 'Asia/Kolkata', link: 'https://meet.google.com/a', invitees: [{ type: 'team' as const, id: 't1' }] };
    await listStandups('o 1');
    await standupAudience('o 1');
    await createStandup('o 1', input);
    await updateStandup('o 1', 's1', { title: 'New' });
    await deleteStandup('o 1', 's1');
    const calls = (f.mock.calls as unknown as [string, RequestInit][]).map(c => [c[1].method, c[0], c[1].body ? JSON.parse(c[1].body as string) : undefined]);
    expect(calls).toEqual([
      ['GET', '/api/orgs/o%201/standups', undefined], ['GET', '/api/orgs/o%201/standups/audience', undefined], ['POST', '/api/orgs/o%201/standups', input],
      ['PATCH', '/api/orgs/o%201/standups/s1', { title: 'New' }], ['DELETE', '/api/orgs/o%201/standups/s1', undefined],
    ]);
  });

  it('give back the server\'s reason when it refuses', async () => {
    vi.stubGlobal('fetch', async () => json(400, { error: { message: 'Some fields need attention.', fields: { link: 'Use a Google Meet or Microsoft Teams link, starting with https://.' } } }));
    expect(await createStandup('o', { title: 'x', startsAt: '', durationMinutes: 5, timeZone: 'UTC', link: 'https://evil.example', invitees: [] })).toMatchObject({ ok: false, status: 400, fields: { link: expect.stringContaining('Meet') } });
  });
});

describe('Google connection calls', () => {
  it('ask for the status, start the sign-in with a POST, and disconnect with a DELETE, on the organisation\'s own routes', async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => json(200, {}));
    vi.stubGlobal('fetch', f);
    const { googleStatus, startGoogleConnect, disconnectGoogle } = await import('./standupsApi');
    await googleStatus('o 1'); await startGoogleConnect('o 1'); await disconnectGoogle('o 1');
    expect((f.mock.calls as unknown as [string, RequestInit][]).map(c => [c[1].method, c[0]])).toEqual([
      ['GET', '/api/orgs/o%201/google'], ['POST', '/api/orgs/o%201/google/connect'], ['DELETE', '/api/orgs/o%201/google'],
    ]);
  });
});
