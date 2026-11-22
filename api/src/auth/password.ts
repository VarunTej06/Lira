import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

/** Argon2id with the settings OWASP recommends as a minimum: 19 MiB of memory, 2 passes, 1 lane. */
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string): Promise<string> => argon2.hash(password, OPTIONS);

/** True only for a matching password. A malformed hash counts as a mismatch instead of an error. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try { return await argon2.verify(hash, password); } catch { return false; }
}

let dummy: Promise<string> | undefined;

/**
 * Spends the time of a real check when there is no such account, so a wrong email and a wrong password take the same time
 * and the answer does not reveal which accounts exist.
 */
export async function spendCheckTime(password: string): Promise<void> {
  dummy ??= hashPassword(randomBytes(16).toString('hex'));
  await verifyPassword(await dummy, password);
}
