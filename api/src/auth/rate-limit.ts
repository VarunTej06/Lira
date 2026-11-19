import { createHash } from 'node:crypto';

/** Wrong passwords allowed in the window before sign-in is paused, per email and per network address. */
export const WINDOW_MINUTES = 15;
export const EMAIL_LIMIT = 5;
export const ADDRESS_LIMIT = 20;

/** A hash of the email or address, so the attempts table never holds the value itself. */
export const attemptKey = (kind: 'email' | 'address', value: string): string =>
  createHash('sha256').update(`${kind}:${value.trim().toLowerCase()}`).digest('hex');

export const isLocked = (emailFailures: number, addressFailures: number): boolean =>
  emailFailures >= EMAIL_LIMIT || addressFailures >= ADDRESS_LIMIT;
