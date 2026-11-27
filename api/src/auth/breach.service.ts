import { createHash } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CONFIG, type Config } from '../config';
import { logLine } from '../observability/log';
import { MetricsService } from '../observability/metrics.service';

/** How the API reaches the breach list. A test supplies its own, so nothing real is called. */
export type BreachHttp = (url: string, init?: RequestInit) => Promise<Response>;
export const BREACH_HTTP = Symbol('BREACH_HTTP');

/** The only address this service ever calls, fixed here: it is never taken from a request. */
const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = 2500;
export const BREACHED = 'This password appears in a list of passwords leaked in data breaches. Choose a different one.';

/**
 * The part of a password's SHA-1 that is sent, five characters, is not enough to learn the password: the service answers with every
 * ending that shares it, and the match is made here (the k-anonymity method of Have I Been Pwned). The password never leaves the API.
 */
export async function isBreached(password: string, http: BreachHttp): Promise<boolean | null> {
  const sha = createHash('sha1').update(password).digest('hex').toUpperCase();
  try {
    const res = await http(`${RANGE_URL}${sha.slice(0, 5)}`, { headers: { 'Add-Padding': 'true', 'User-Agent': 'Liraspaces' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const suffix = sha.slice(5);
    for (const line of (await res.text()).split(/\r?\n/)) {
      const [ending, count] = line.trim().split(':');
      if (ending === suffix) return Number(count) > 0; // padding rows carry a count of 0
    }
    return false;
  } catch { return null; }
}

/** Refuses a password that is known to be leaked. When the list cannot be reached the password is accepted: signing up must not depend on it. */
@Injectable()
export class BreachService {
  constructor(@Inject(CONFIG) private readonly config: Config, @Inject(BREACH_HTTP) private readonly http: BreachHttp, @Inject(MetricsService) private readonly metrics: MetricsService) {}

  async require(password: string): Promise<void> {
    if (!this.config.breachCheck) return;
    const found = await isBreached(password, this.http);
    this.metrics.inc('password_breach_checks_total', { outcome: found === null ? 'unknown' : found ? 'breached' : 'clean' });
    if (found === null) logLine('warn', 'password breach list not reachable');
    if (found) throw new BadRequestException({ code: 'breached_password', message: BREACHED, fields: { password: BREACHED } });
  }
}
