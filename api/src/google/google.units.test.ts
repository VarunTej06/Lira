import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { decryptToken, encryptToken, parseKey, signState, verifyState } from './crypto';
import { buildRawEmail } from './mime';

const KEY = parseKey(Buffer.alloc(32, 9).toString('base64'));

describe('token encryption', () => {
  it('gives the token back, never shows it in what is stored, and never stores the same token the same way twice', () => {
    const a = encryptToken('refresh-token-value', KEY);
    expect(decryptToken(a, KEY)).toBe('refresh-token-value');
    expect(a).not.toContain('refresh-token-value');
    expect(encryptToken('refresh-token-value', KEY)).not.toBe(a);
  });

  it('refuses a value that was changed, one made with another key, and one that is not ours', () => {
    const stored = encryptToken('secret', KEY);
    const [v, iv, tag, body] = stored.split('.');
    const flipped = `${v}.${iv}.${tag}.${body.slice(0, -2)}${body.endsWith('AA') ? 'BB' : 'AA'}`;
    expect(() => decryptToken(flipped, KEY)).toThrow();
    expect(() => decryptToken(stored, parseKey(Buffer.alloc(32, 1).toString('base64')))).toThrow();
    expect(() => decryptToken('plain text', KEY)).toThrow();
  });

  it('needs a key of exactly 32 bytes', () => {
    expect(() => parseKey(Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
  });
});

describe('sign-in state', () => {
  const org = '11111111-1111-4111-8111-111111111111'; const user = '22222222-2222-4222-8222-222222222222';

  it('carries the organisation and person through Google and back', () => {
    expect(verifyState(signState(org, user, KEY), KEY)).toEqual({ orgId: org, userId: user });
  });

  it('is refused when it was changed, signed with another key, expired, or is not shaped like one', () => {
    const good = signState(org, user, KEY, 1_000_000);
    const [payload, mac] = good.split('.');
    const forgedPayload = Buffer.from(Buffer.from(payload, 'base64url').toString().replace(org, '33333333-3333-4333-8333-333333333333')).toString('base64url');
    expect(verifyState(`${forgedPayload}.${mac}`, KEY, 1_000_000)).toBeNull();
    expect(verifyState(good, parseKey(Buffer.alloc(32, 2).toString('base64')), 1_000_000)).toBeNull();
    expect(verifyState(good, KEY, 1_000_000 + 11 * 60_000)).toBeNull();
    expect(verifyState(good, KEY, 1_000_000 + 9 * 60_000)).not.toBeNull();
    for (const bad of ['', 'x', 'a.b', `${payload}.`]) expect(verifyState(bad, KEY)).toBeNull();
  });
});

describe('email in the Gmail API form', () => {
  const decode = (raw: string) => Buffer.from(raw, 'base64url').toString('utf8');

  it('has the headers and a body that reads back as written, with non-English letters', () => {
    const text = decode(buildRawEmail({ from: 'me@gmail.com', to: 'you@example.com', subject: 'Stand-up: Daily', text: 'Join: https://meet.google.com/abc — 10:00' }));
    expect(text).toContain('From: me@gmail.com\r\nTo: you@example.com\r\nSubject: Stand-up: Daily\r\n');
    expect(text).toContain('Content-Type: text/plain; charset="UTF-8"');
    const body = text.split('\r\n\r\n')[1].replace(/\r\n/g, '');
    expect(Buffer.from(body, 'base64').toString('utf8')).toBe('Join: https://meet.google.com/abc — 10:00');
  });

  it('writes a subject with other letters in the form mail headers need', () => {
    const subject = /Subject: (.*)\r\n/.exec(decode(buildRawEmail({ from: 'a@b.co', to: 'c@d.co', subject: 'Stand-up: Ünï', text: 'x' })))![1];
    expect(subject).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    expect(Buffer.from(subject.slice(10, -2), 'base64').toString('utf8')).toBe('Stand-up: Ünï');
  });

  it('refuses a line break in any header, so nobody can add headers or recipients', () => {
    for (const bad of [{ to: 'a@b.co\r\nBcc: x@y.co' }, { subject: 'Hi\nBcc: x@y.co' }, { from: 'a@b.co\r\nX: 1' }]) {
      expect(() => buildRawEmail({ from: 'a@b.co', to: 'c@d.co', subject: 's', text: 't', ...bad })).toThrow(/line break/);
    }
  });
});

describe('Google settings', () => {
  const base = { DATABASE_URL: 'postgres://x', ALLOWED_ORIGINS: 'https://a.example' };
  const google = { GOOGLE_CLIENT_ID: 'client-id-123456', GOOGLE_CLIENT_SECRET: 'client-secret-12345', GOOGLE_REDIRECT_URI: 'https://a.example/api/google/callback', TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64') };

  it('are all there or none: Google is off without them', () => {
    expect(loadConfig(base).google).toBeUndefined();
    expect(loadConfig({ ...base, ...google }).google).toMatchObject({ clientId: 'client-id-123456', redirectUri: 'https://a.example/api/google/callback' });
    expect(() => loadConfig({ ...base, GOOGLE_CLIENT_ID: google.GOOGLE_CLIENT_ID })).toThrow(/set together/);
    expect(() => loadConfig({ ...base, ...google, GOOGLE_REDIRECT_URI: 'not a url' })).toThrow();
  });
});
