import { createHash, randomBytes } from 'node:crypto';

export const COOKIE_NAME = 'lira_session';

/** 32 random bytes, written in 43 URL-safe characters. */
export const newToken = (): string => randomBytes(32).toString('base64url');

/** Only this hash is stored: a copy of the database cannot be used to sign in. */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

const attributes = (secure: boolean) => `Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

export function sessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  return `${COOKIE_NAME}=${token}; Max-Age=${maxAgeSeconds}; ${attributes(secure)}`;
}

export const clearedCookie = (secure: boolean): string => `${COOKIE_NAME}=; Max-Age=0; ${attributes(secure)}`;

/** The session token from a Cookie header, or undefined when it is missing or not shaped like one of ours. */
export function tokenFromCookieHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at < 0 || part.slice(0, at).trim() !== COOKIE_NAME) continue;
    const value = part.slice(at + 1).trim();
    return TOKEN_SHAPE.test(value) ? value : undefined;
  }
  return undefined;
}

export function sessionSeconds(remember: boolean, sessionHours: number, rememberDays: number): number {
  return remember ? rememberDays * 86400 : sessionHours * 3600;
}
