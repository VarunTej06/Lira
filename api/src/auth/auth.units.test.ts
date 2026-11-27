import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { hashPassword, spendCheckTime, verifyPassword } from './password';
import { ADDRESS_LIMIT, EMAIL_LIMIT, attemptKey, isLocked } from './rate-limit';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema, verifyEmailSchema, fieldErrors } from './schemas';
import { CLIENT_HEADER, CLIENT_VALUE, checkRequest } from './csrf';
import { COOKIE_NAME, clearedCookie, hashToken, newToken, sessionCookie, sessionSeconds, tokenFromCookieHeader } from './session';

const ORIGIN = 'https://test.liraspaces.com';

describe('configuration', () => {
  const base = { DATABASE_URL: 'postgres://x', ALLOWED_ORIGINS: `${ORIGIN}, https://other.example` };

  it('reads the settings, with safe defaults', () => {
    const c = loadConfig(base);
    expect(c).toMatchObject({ port: 8080, cookieSecure: true, databaseSsl: true, trustProxyHops: 1, sessionHours: 12, rememberDays: 30 });
    expect(c.allowedOrigins).toEqual([ORIGIN, 'https://other.example']);
  });

  it('stops at start-up when a setting is missing or wrong, saying which', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: 'x' })).toThrow(/ALLOWED_ORIGINS/);
    expect(() => loadConfig({ ...base, PORT: '99999' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...base, COOKIE_SECURE: 'maybe' })).toThrow(/COOKIE_SECURE/);
  });

  it('accepts only exact origins, so a path or a wildcard cannot widen who may call', () => {
    expect(() => loadConfig({ ...base, ALLOWED_ORIGINS: 'https://a.example/path' })).toThrow(/scheme, host and port/);
    expect(() => loadConfig({ ...base, ALLOWED_ORIGINS: '*' })).toThrow(/not a web address/);
    expect(() => loadConfig({ ...base, ALLOWED_ORIGINS: 'https://a.example/' })).toThrow(/scheme, host and port/);
  });
});

describe('input schemas', () => {
  const good = { name: ' Asha Rao ', email: ' Asha@Example.COM ', password: 'a-long-enough-password' };

  it('normalises the email and the name', () => {
    expect(signupSchema.parse(good)).toMatchObject({ name: 'Asha Rao', email: 'asha@example.com' });
  });

  it('asks for a password of 10 to 128 characters on sign-up, but accepts any non-empty one on log-in', () => {
    expect(signupSchema.safeParse({ ...good, password: 'short' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...good, password: 'x'.repeat(129) }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });

  it('refuses a field it did not ask for, so a request cannot set a role or an id', () => {
    for (const extra of [{ role: 'owner' }, { id: 'x' }, { isAdmin: true }, { __proto__: { admin: true }, constructor: 1 }]) {
      const r = signupSchema.safeParse({ ...good, ...extra });
      expect(r.success, JSON.stringify(extra)).toBe(false);
    }
  });

  it('rejects bad emails, oversized values and values of the wrong type', () => {
    for (const email of ['x', 'a@', '@b.co', 'a b@c.co', `${'a'.repeat(250)}@b.co`, 5, null, ['a@b.co']]) {
      expect(loginSchema.safeParse({ email, password: 'p' }).success, String(email)).toBe(false);
    }
    expect(signupSchema.safeParse({ ...good, name: 'n'.repeat(101) }).success).toBe(false);
    expect(signupSchema.safeParse({ ...good, name: '   ' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...good, remember: 'yes' }).success).toBe(false);
  });

  it('reports the first problem of each field by name', () => {
    const r = signupSchema.safeParse({ name: '', email: 'x', password: 'short', extra: 1 });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(fieldErrors(r.error)).sort()).toEqual(['email', 'extra', 'name', 'password']);
  });
});

describe('passwords', () => {
  it('stores an Argon2id hash, never the password, and a different hash each time', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(a).not.toContain('correct horse');
    expect(a).not.toBe(b);
  });

  it('accepts the right password only, and a damaged hash counts as wrong', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse batter')).toBe(false);
    expect(await verifyPassword('not a hash', 'anything')).toBe(false);
    expect(await verifyPassword('', '')).toBe(false);
  });

  it('can spend the time of a check for an unknown account', async () => {
    await expect(spendCheckTime('whatever')).resolves.toBeUndefined();
  });
});

describe('sessions', () => {
  it('makes a long random token, and stores only its hash', () => {
    const a = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(a);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toContain(a);
  });

  it('builds a cookie that scripts cannot read, and that is sent only over HTTPS when asked', () => {
    const token = newToken();
    const secure = sessionCookie(token, 3600, true);
    expect(secure).toBe(`${COOKIE_NAME}=${token}; Max-Age=3600; Path=/; HttpOnly; SameSite=Lax; Secure`);
    expect(sessionCookie(token, 3600, false)).not.toContain('Secure');
    expect(clearedCookie(true)).toContain('Max-Age=0');
    expect(clearedCookie(true)).toContain('HttpOnly');
  });

  it('reads our token from a Cookie header and ignores everything else', () => {
    const token = newToken();
    expect(tokenFromCookieHeader(`a=1; ${COOKIE_NAME}=${token}; b=2`)).toBe(token);
    expect(tokenFromCookieHeader(`${COOKIE_NAME}=short`)).toBeUndefined();
    expect(tokenFromCookieHeader(`${COOKIE_NAME}=${token}x`)).toBeUndefined();
    expect(tokenFromCookieHeader('other=1')).toBeUndefined();
    expect(tokenFromCookieHeader(undefined)).toBeUndefined();
    expect(tokenFromCookieHeader(`x${COOKIE_NAME}=${token}`)).toBeUndefined();
  });

  it('lasts the short time, or the long time when remembered', () => {
    expect(sessionSeconds(false, 12, 30)).toBe(12 * 3600);
    expect(sessionSeconds(true, 12, 30)).toBe(30 * 86400);
  });
});

describe('lock after wrong passwords', () => {
  it('locks at the limits, per email and per address', () => {
    expect(isLocked(EMAIL_LIMIT - 1, ADDRESS_LIMIT - 1)).toBe(false);
    expect(isLocked(EMAIL_LIMIT, 0)).toBe(true);
    expect(isLocked(0, ADDRESS_LIMIT)).toBe(true);
  });

  it('keys by a hash that ignores case and spaces, and keeps the two kinds apart', () => {
    expect(attemptKey('email', ' A@B.co ')).toBe(attemptKey('email', 'a@b.co'));
    expect(attemptKey('email', 'a@b.co')).not.toBe(attemptKey('address', 'a@b.co'));
    expect(attemptKey('email', 'a@b.co')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('cross-site request check', () => {
  const allowed = [ORIGIN];
  const good = { origin: ORIGIN, [CLIENT_HEADER]: CLIENT_VALUE };

  it('lets reading calls through, and a change from our own page', () => {
    expect(checkRequest('GET', {}, allowed)).toBe('ok');
    expect(checkRequest('POST', good, allowed)).toBe('ok');
  });

  it('refuses a change from another site, from no origin, or without the page header', () => {
    expect(checkRequest('POST', { ...good, origin: 'https://evil.example' }, allowed)).toBe('bad_origin');
    expect(checkRequest('POST', { [CLIENT_HEADER]: CLIENT_VALUE }, allowed)).toBe('bad_origin');
    expect(checkRequest('POST', { origin: ORIGIN }, allowed)).toBe('bad_header');
    expect(checkRequest('DELETE', { origin: ORIGIN, [CLIENT_HEADER]: 'other' }, allowed)).toBe('bad_header');
    expect(checkRequest('post', { origin: 'null', [CLIENT_HEADER]: CLIENT_VALUE }, allowed)).toBe('bad_origin');
  });

  it('does not accept an origin that only starts like an allowed one', () => {
    expect(checkRequest('POST', { origin: `${ORIGIN}.evil.example`, [CLIENT_HEADER]: CLIENT_VALUE }, allowed)).toBe('bad_origin');
  });
});

describe('email link settings and schemas', () => {
  const base = { DATABASE_URL: 'postgres://x', ALLOWED_ORIGINS: ORIGIN };
  const token = 'A'.repeat(43);

  it('reads the email service settings only when both are given, and refuses one without the other', () => {
    expect(loadConfig(base).mail).toBeUndefined();
    const both = loadConfig({ ...base, MAIL_CONNECTION_STRING: 'endpoint=https://x.communication.azure.com/;accesskey=abc', MAIL_FROM: 'DoNotReply@mail.example.com' });
    expect(both.mail).toEqual({ connectionString: 'endpoint=https://x.communication.azure.com/;accesskey=abc', from: 'DoNotReply@mail.example.com' });
    expect(() => loadConfig({ ...base, MAIL_FROM: 'DoNotReply@mail.example.com' })).toThrow(/MAIL_CONNECTION_STRING and MAIL_FROM/);
    expect(() => loadConfig({ ...base, MAIL_CONNECTION_STRING: 'endpoint=https://x.communication.azure.com/;accesskey=abc' })).toThrow(/MAIL_CONNECTION_STRING and MAIL_FROM/);
    expect(() => loadConfig({ ...base, MAIL_CONNECTION_STRING: 'endpoint=https://x.communication.azure.com/;accesskey=abc', MAIL_FROM: 'not-an-address' })).toThrow(/MAIL_FROM/);
  });

  it('accepts a link token only in the shape this server makes, and nothing else in the body', () => {
    expect(verifyEmailSchema.safeParse({ token }).success).toBe(true);
    for (const bad of ['', 'short', `${token}x`, `${token.slice(1)}!`, 5, undefined]) expect(verifyEmailSchema.safeParse({ token: bad }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({ token, role: 'owner' }).success).toBe(false);
  });

  it('checks the new password with the same length rules as sign-up, and lower-cases the email to reset', () => {
    expect(resetPasswordSchema.safeParse({ token, password: 'a-brand-new-password' }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token, password: 'short' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token, password: 'x'.repeat(129) }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token, password: 'a-brand-new-password', email: 'a@b.co' }).success).toBe(false);
    const parsed = forgotPasswordSchema.parse({ email: ' Asha@Example.COM ' });
    expect(parsed.email).toBe('asha@example.com');
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });

  it('keeps reset requests from one address apart from log-in attempts', () => {
    expect(attemptKey('reset', '1.2.3.4')).not.toBe(attemptKey('address', '1.2.3.4'));
  });
});
