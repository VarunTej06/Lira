import { createHash } from 'node:crypto';

/** Wrong passwords allowed in the window before sign-in is paused, per email and per network address. */
export const WINDOW_MINUTES = 15;
export const EMAIL_LIMIT = 5;
export const ADDRESS_LIMIT = 20;

/** A hash of the email or address, so the attempts table never holds the value itself. */
export const attemptKey = (kind: 'email' | 'address' | 'reset', value: string): string =>
  createHash('sha256').update(`${kind}:${value.trim().toLowerCase()}`).digest('hex');

export const isLocked = (emailFailures: number, addressFailures: number): boolean =>
  emailFailures >= EMAIL_LIMIT || addressFailures >= ADDRESS_LIMIT;

/** Password-reset requests allowed per network address in the window; more are ignored without saying so. */
export const RESET_ADDRESS_LIMIT = 10;
/** Emails of one kind sent to one account in an hour; more are held back. */
export const EMAILS_PER_HOUR = 3;
