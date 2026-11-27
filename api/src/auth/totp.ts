import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const PERIOD_SECONDS = 30;
const DIGITS = 6;

/** Base32 (RFC 4648) without padding, the form an authenticator app asks for. */
export function base32Encode(bytes: Buffer): string {
  let bits = 0; let value = 0; let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0; let value = 0; const out: number[] = [];
  for (const ch of text.replace(/=+$/, '').toUpperCase()) {
    const at = ALPHABET.indexOf(ch);
    if (at < 0) throw new Error('Not base32.');
    value = (value << 5) | at; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** 160 random bits, as the apps expect. */
export const newSecret = (): string => base32Encode(randomBytes(20));

/** The six-digit code for one 30-second step (RFC 6238 over RFC 4226, HMAC-SHA1). */
export function codeFor(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const n = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(n % 10 ** DIGITS).padStart(DIGITS, '0');
}

export const stepAt = (nowMs: number): number => Math.floor(nowMs / 1000 / PERIOD_SECONDS);

/**
 * The step a code belongs to, or null. The step before and the step after are allowed, for clocks that are a little off. A step at or
 * before `lastStep` is refused, so a code that was seen once cannot be used again.
 */
export function verifyCode(secret: string, code: string, nowMs: number, lastStep: number): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = stepAt(nowMs);
  for (const step of [now, now - 1, now + 1]) {
    const expected = Buffer.from(codeFor(secret, step));
    if (step > lastStep && timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

/** What the person adds to an authenticator app: scanning a code is not needed, the key can be typed. */
export const otpauthUri = (secret: string, email: string): string =>
  `otpauth://totp/${encodeURIComponent(`Liraspaces:${email}`)}?secret=${secret}&issuer=Liraspaces&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD_SECONDS}`;

const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
/** Ten codes like `k3m9x-p2w7q`, easy to read out and type. */
export function newRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const pick = (n: number) => Array.from(randomBytes(n), b => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
    return `${pick(5)}-${pick(5)}`;
  });
}

export const looksLikeRecoveryCode = (text: string): boolean => /^[a-z2-9]{5}-?[a-z2-9]{5}$/i.test(text.trim());
export const normaliseRecoveryCode = (text: string): string => {
  const plain = text.trim().toLowerCase().replace('-', '');
  return `${plain.slice(0, 5)}-${plain.slice(5)}`;
};
