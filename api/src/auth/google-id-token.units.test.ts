import { createSign, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyIdToken, type Jwk } from './google-id-token';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk: Jwk = { ...(pair.publicKey.export({ format: 'jwk' }) as Jwk), kid: 'k1' };
const CLIENT = 'client-123';
const NOW = 1_800_000_000_000;

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
function sign(claims: Record<string, unknown>, options: { key?: typeof pair; alg?: string; kid?: string } = {}): string {
  const body = { iss: 'https://accounts.google.com', aud: CLIENT, sub: 's1', email: 'Pat@Gmail.com', email_verified: true, name: 'Pat', nonce: 'n1', exp: NOW / 1000 + 600, ...claims };
  const head = enc({ alg: options.alg ?? 'RS256', kid: options.kid ?? 'k1' });
  return `${head}.${enc(body)}.${createSign('RSA-SHA256').update(`${head}.${enc(body)}`).sign((options.key ?? pair).privateKey).toString('base64url')}`;
}
const check = (token: string, over: Partial<{ nonce: string; clientId: string; keys: Jwk[] }> = {}) =>
  verifyIdToken(token, { clientId: CLIENT, nonce: 'n1', keys: [jwk], now: NOW, ...over });

describe('an ID token from Google', () => {
  it('gives back who it is for, with the email in lower case', () => {
    expect(check(sign({}))).toEqual({ sub: 's1', email: 'pat@gmail.com', emailVerified: true, name: 'Pat' });
  });

  it('takes the name from the email when Google gives none, and accepts either spelling of the issuer and an audience list', () => {
    expect(check(sign({ name: undefined, iss: 'accounts.google.com', aud: [CLIENT, 'other'] }))?.name).toBe('pat');
  });

  it('is refused when it was signed by another key, changed after signing, or names a key Google does not publish', () => {
    expect(check(sign({}, { key: other }))).toBeNull();
    const [head, , signature] = sign({}).split('.');
    expect(check(`${head}.${enc({ iss: 'https://accounts.google.com', aud: CLIENT, sub: 'someone-else', email: 'x@y.co', email_verified: true, nonce: 'n1', exp: NOW / 1000 + 600 })}.${signature}`)).toBeNull();
    expect(check(sign({}, { kid: 'unknown' }))).toBeNull();
    expect(check(sign({}), { keys: [] })).toBeNull();
  });

  it('is refused with the "none" algorithm, any other algorithm, and parts that are missing or are not text', () => {
    expect(check(sign({}, { alg: 'none' }))).toBeNull();
    expect(check(sign({}, { alg: 'HS256' }))).toBeNull();
    for (const bad of ['', 'a.b', 'a.b.', '..', 'not a token', `${enc({ alg: 'RS256', kid: 'k1' })}.@@@.@@@`]) expect(check(bad), bad).toBeNull();
  });

  it('is refused for another issuer, another app, an expired token, another nonce, an unverified email and a missing person or email', () => {
    expect(check(sign({ iss: 'https://evil.example' }))).toBeNull();
    expect(check(sign({ aud: 'someone-elses-client' }))).toBeNull();
    expect(check(sign({ exp: NOW / 1000 - 1 }))).toBeNull();
    expect(check(sign({ exp: NOW / 1000 }))).toBeNull();
    expect(check(sign({}), { nonce: 'another' })).toBeNull();
    expect(check(sign({ nonce: undefined }))).toBeNull();
    expect(check(sign({ email_verified: false }))).toBeNull();
    expect(check(sign({ email_verified: 'true' }))).toBeNull();
    expect(check(sign({ sub: '' }))).toBeNull();
    expect(check(sign({ email: undefined }))).toBeNull();
    expect(check(sign({}), { clientId: 'someone-elses-client' })).toBeNull();
  });
});
