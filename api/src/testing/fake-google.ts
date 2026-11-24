import { createSign, generateKeyPairSync } from 'node:crypto';

const CLIENT_ID = 'client-id-123456';

/** Stands in for Google in tests: answers the few addresses the API uses, and records what it was asked. Nothing real is called. */
export class FakeGoogle {
  readonly requests: { url: string; method: string; body: string; authorization: string | null }[] = [];
  email = 'owner@gmail.com';
  failMeet = false;
  failGmail = false;
  failRefresh = false;
  private meetings = 0;
  /** The ID token Google hands back in exchange for the sign-in code. A test sets it with `signIdToken`. */
  idToken: string | null = null;
  failExchange = false;
  /** The permissions Google says were granted when the code is exchanged. */
  grantedScope = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/meetings.space.created https://www.googleapis.com/auth/gmail.send';
  omitRefreshToken = false;
  /** Google refuses calendar calls when set. */
  failCalendar = false;
  /** Events held in the fake calendar, by id. */
  readonly events = new Map<string, Record<string, unknown>>();
  private eventNo = 0;
  private readonly pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  private readonly other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  readonly keyId = 'test-key-1';

  /** A signed ID token. `overrides` change or remove claims; `withOtherKey` signs with a key Google does not publish. */
  signIdToken(claims: Record<string, unknown>, options: { withOtherKey?: boolean; alg?: string } = {}): string {
    const now = Math.floor(Date.now() / 1000);
    const body = { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'google-sub-1', email: 'person@gmail.com', email_verified: true, name: 'Pat Person', iat: now, exp: now + 3600, ...claims };
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const head = enc({ alg: options.alg ?? 'RS256', kid: this.keyId, typ: 'JWT' });
    const signer = createSign('RSA-SHA256').update(`${head}.${enc(body)}`);
    return `${head}.${enc(body)}.${signer.sign((options.withOtherKey ? this.other : this.pair).privateKey).toString('base64url')}`;
  }

  /** The same shape as fetch, so the service can use it in place of it. */
  fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const body = typeof init?.body === 'string' ? init.body : '';
    this.requests.push({ url, method: init?.method ?? 'GET', body, authorization: new Headers(init?.headers).get('authorization') });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url === 'https://oauth2.googleapis.com/token') {
      if (body.includes('grant_type=authorization_code')) {
        if (this.failExchange) return json({ error: 'invalid_grant' }, 400);
        return json({ access_token: 'access-1', ...(this.omitRefreshToken ? {} : { refresh_token: 'refresh-secret-1' }), scope: this.grantedScope, expires_in: 3600, ...(this.idToken ? { id_token: this.idToken } : {}) });
      }
      return this.failRefresh ? json({ error: 'invalid_grant' }, 400) : json({ access_token: 'access-2', expires_in: 3600 });
    }
    if (url === 'https://www.googleapis.com/oauth2/v3/certs') return json({ keys: [{ ...this.pair.publicKey.export({ format: 'jwk' }), kid: this.keyId, alg: 'RS256', use: 'sig' }] });
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') return json({ email: this.email });
    if (url === 'https://meet.googleapis.com/v2/spaces') return this.failMeet ? json({ error: 'denied' }, 403) : json({ name: `spaces/${++this.meetings}`, meetingUri: `https://meet.google.com/abc-defg-h${String(this.meetings).padStart(2, '0')}` });
    if (url === 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send') return this.failGmail ? json({ error: 'quota' }, 429) : json({ id: 'm1' });
    if (url.startsWith('https://oauth2.googleapis.com/revoke')) return json({});
    if (url.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events')) return this.calendar(url, init?.method ?? 'GET', body, json);
    return json({ error: 'unexpected address' }, 404);
  };

  private calendar(url: string, method: string, body: string, json: (data: unknown, status?: number) => Response): Response {
    if (this.failCalendar) return json({ error: 'denied' }, 403);
    const id = decodeURIComponent(new URL(url).pathname.split('/events/')[1] ?? '');
    if (method === 'POST') { const made = `evt-${++this.eventNo}`; this.events.set(made, JSON.parse(body)); return json({ id: made }); }
    if (method === 'PATCH') { if (!this.events.has(id)) return json({ error: 'gone' }, 404); this.events.set(id, { ...this.events.get(id), ...JSON.parse(body) }); return json({ id }); }
    if (method === 'DELETE') { this.events.delete(id); return new Response(null, { status: 204 }); }
    return json({ error: 'unexpected' }, 405);
  }

  /** The emails sent, decoded back to what a person would read. */
  sentEmails(): { to: string; from: string; subject: string; text: string }[] {
    return this.requests.filter(r => r.url.endsWith('/messages/send')).map(r => {
      const raw = Buffer.from(JSON.parse(r.body).raw as string, 'base64url').toString('utf8');
      const [head, ...rest] = raw.split('\r\n\r\n');
      const header = (name: string) => new RegExp(`^${name}: (.*)$`, 'mi').exec(head)?.[1] ?? '';
      return { to: header('To'), from: header('From'), subject: header('Subject'), text: Buffer.from(rest.join('').replace(/\r\n/g, ''), 'base64').toString('utf8') };
    });
  }
}
