import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** The secret key: 32 random bytes, written in base64. It lives in the secret store (Key Vault), never in the database or the code. */
export function parseKey(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes written in base64.');
  return key;
}

/** Encrypts a token for the database: AES-256-GCM with a fresh random nonce each time, so the same token never looks the same twice. */
export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

/** The token back. A value that was changed, or made with another key, is refused. */
export function decryptToken(stored: string, key: Buffer): string {
  const [version, iv, tag, body] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('Unreadable token.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
}

const STATE_MINUTES = 10;

/** A signed, short-lived value that carries the organisation and person through Google's sign-in and back, so a callback cannot be forged. */
export function signState(orgId: string, userId: string, key: Buffer, now = Date.now()): string {
  const payload = `${orgId}.${userId}.${now + STATE_MINUTES * 60_000}.${randomBytes(12).toString('base64url')}`;
  return `${Buffer.from(payload).toString('base64url')}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}

export function verifyState(state: string, key: Buffer, now = Date.now()): { orgId: string; userId: string } | null {
  const [encoded, mac] = state.split('.');
  if (!encoded || !mac) return null;
  const payload = Buffer.from(encoded, 'base64url').toString('utf8');
  const expected = createHmac('sha256', key).update(payload).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [orgId, userId, expires] = payload.split('.');
  if (!orgId || !userId || !(Number(expires) > now)) return null;
  return { orgId, userId };
}
