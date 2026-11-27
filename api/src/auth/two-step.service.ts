import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CONFIG, type Config } from '../config';
import { DbService, type Queryable } from '../db/db.service';
import { decryptToken, encryptToken, parseKey } from '../google/crypto';
import { MetricsService } from '../observability/metrics.service';
import { hashToken, newToken } from './session';
import { looksLikeRecoveryCode, newRecoveryCodes, newSecret, normaliseRecoveryCode, otpauthUri, verifyCode } from './totp';

const CHALLENGE_MINUTES = 10;
const MAX_WRONG = 5;
const WRONG_CODE = 'That code is not correct. Check the time on your phone and try the newest code.';
const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

export interface TwoStepStatus { available: boolean; enabled: boolean }

/**
 * Two-step sign-in with an authenticator app. After the right password the person gets a short-lived challenge, not a session, and
 * the session starts only when they give the app's six-digit code or one of their ten recovery codes. A code works once, five wrong
 * ones end the challenge, and the secret is kept encrypted with the key that protects the Google tokens (so it needs that key).
 */
@Injectable()
export class TwoStepService {
  constructor(
    @Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MetricsService) private readonly metrics: MetricsService, @Inject(CONFIG) private readonly config: Config,
  ) {}

  private get key(): Buffer {
    if (!this.config.google) throw new ServiceUnavailableException({ code: 'not_available', message: 'Two-step sign-in is not set up on this server.' });
    return parseKey(this.config.google.tokenKey);
  }

  async status(userId: string, at: Queryable = this.db): Promise<TwoStepStatus> {
    const r = await at.query('SELECT 1 FROM user_two_step WHERE user_id = $1 AND confirmed_at IS NOT NULL', [userId]);
    return { available: this.config.google !== undefined, enabled: (r.rowCount ?? 0) > 0 };
  }

  /** Starts the set-up: a new secret to type into the app. Nothing is switched on until a first code is confirmed. */
  async begin(userId: string, email: string): Promise<{ secret: string; uri: string }> {
    const key = this.key;
    const account = await this.db.query<{ password_hash: string | null }>('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (!account.rows[0]?.password_hash) throw new BadRequestException({ code: 'no_password', message: 'This account signs in with Google, which has its own two-step sign-in. Turn it on in your Google account.' });
    if ((await this.status(userId)).enabled) throw new ConflictException({ code: 'already_enabled', message: 'Two-step sign-in is already on.' });
    const secret = newSecret();
    await this.db.query(
      `INSERT INTO user_two_step (user_id, secret) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, confirmed_at = NULL, last_step = 0`,
      [userId, encryptToken(secret, key)]);
    return { secret, uri: otpauthUri(secret, email) };
  }

  /** The first code proves the app has the secret. Switches two-step on and gives the recovery codes, once. */
  async confirm(userId: string, code: string, ip: string): Promise<string[]> {
    const recovery = newRecoveryCodes();
    await this.db.transaction(async tx => {
      const row = (await tx.query<{ secret: string; confirmed_at: Date | null }>('SELECT secret, confirmed_at FROM user_two_step WHERE user_id = $1 FOR UPDATE', [userId])).rows[0];
      if (!row || row.confirmed_at) throw new BadRequestException({ code: 'not_started', message: 'Start the set-up first.' });
      const step = verifyCode(decryptToken(row.secret, this.key), code, Date.now(), 0);
      if (step === null) throw new BadRequestException({ code: 'wrong_code', message: WRONG_CODE, fields: { code: WRONG_CODE } });
      await tx.query('UPDATE user_two_step SET confirmed_at = now(), last_step = $2 WHERE user_id = $1', [userId, step]);
      await tx.query('DELETE FROM two_step_recovery WHERE user_id = $1', [userId]);
      for (const c of recovery) await tx.query('INSERT INTO two_step_recovery (user_id, code_hash) VALUES ($1, $2)', [userId, hashCode(normaliseRecoveryCode(c))]);
      await this.audit.record({ actor: userId, action: 'auth.two_step.enable', outcome: 'ok', sourceIp: ip }, tx);
    });
    this.metrics.inc('auth_two_step_total', { step: 'enabled' });
    return recovery;
  }

  /** Switches it off. Needs a current code (or a recovery code), so a stolen session alone cannot remove it. */
  async disable(userId: string, code: string, ip: string): Promise<void> {
    const done = await this.db.transaction(async tx => {
      if (!(await this.accept(tx, userId, code))) return false;
      await tx.query('DELETE FROM user_two_step WHERE user_id = $1', [userId]);
      await tx.query('DELETE FROM two_step_recovery WHERE user_id = $1', [userId]);
      await this.audit.record({ actor: userId, action: 'auth.two_step.disable', outcome: 'ok', sourceIp: ip }, tx);
      return true;
    });
    if (!done) { // recorded outside the transaction, which has nothing to keep
      await this.audit.record({ actor: userId, action: 'auth.two_step.disable', outcome: 'denied', sourceIp: ip });
      throw new ForbiddenException({ code: 'wrong_code', message: WRONG_CODE, fields: { code: WRONG_CODE } });
    }
    this.metrics.inc('auth_two_step_total', { step: 'disabled' });
  }

  /** After a right password: a challenge to answer with a code, instead of a session. */
  async challenge(userId: string, remember: boolean): Promise<string> {
    const token = newToken();
    await this.db.query('INSERT INTO login_challenges (token_hash, user_id, remember, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))', [hashToken(token), userId, remember, CHALLENGE_MINUTES]);
    return token;
  }

  /** Answers a challenge. Returns who it was for, or throws when the challenge is unknown, ended, used up or the code is wrong. */
  async answer(challenge: string, code: string, ip: string): Promise<{ userId: string; remember: boolean }> {
    const outcome = await this.db.transaction(async tx => {
      const found = await tx.query<{ user_id: string; remember: boolean; attempts: number }>(
        'SELECT user_id, remember, attempts FROM login_challenges WHERE token_hash = $1 AND expires_at > now() FOR UPDATE', [hashToken(challenge)]);
      const row = found.rows[0];
      if (!row) return { kind: 'gone' as const };
      if (row.attempts >= MAX_WRONG) return { kind: 'locked' as const };
      if (await this.accept(tx, row.user_id, code)) {
        await tx.query('DELETE FROM login_challenges WHERE token_hash = $1', [hashToken(challenge)]);
        await this.audit.record({ actor: row.user_id, action: 'auth.two_step.login', outcome: 'ok', sourceIp: ip }, tx);
        return { kind: 'ok' as const, userId: row.user_id, remember: row.remember };
      }
      await tx.query('UPDATE login_challenges SET attempts = attempts + 1 WHERE token_hash = $1', [hashToken(challenge)]);
      await this.audit.record({ actor: row.user_id, action: 'auth.two_step.login', outcome: 'denied', sourceIp: ip, detail: { reason: 'wrong_code' } }, tx);
      return { kind: 'wrong' as const };
    });
    this.metrics.inc('auth_two_step_total', { step: 'answer', outcome: outcome.kind });
    if (outcome.kind === 'ok') return { userId: outcome.userId, remember: outcome.remember };
    if (outcome.kind === 'gone') throw new UnauthorizedException({ code: 'challenge_ended', message: 'This sign-in took too long or was already used. Log in again.' });
    if (outcome.kind === 'locked') throw new HttpException({ code: 'locked', message: 'Too many wrong codes. Log in again.' }, HttpStatus.TOO_MANY_REQUESTS);
    throw new UnauthorizedException({ code: 'wrong_code', message: WRONG_CODE, fields: { code: WRONG_CODE } });
  }

  /** True for the app's current code (once) or an unused recovery code (once). */
  private async accept(tx: Queryable, userId: string, code: string): Promise<boolean> {
    if (looksLikeRecoveryCode(code)) {
      const used = await tx.query('UPDATE two_step_recovery SET used_at = now() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL', [userId, hashCode(normaliseRecoveryCode(code))]);
      return (used.rowCount ?? 0) > 0;
    }
    const row = (await tx.query<{ secret: string; last_step: string }>('SELECT secret, last_step FROM user_two_step WHERE user_id = $1 AND confirmed_at IS NOT NULL FOR UPDATE', [userId])).rows[0];
    if (!row) return false;
    const step = verifyCode(decryptToken(row.secret, this.key), code.trim(), Date.now(), Number(row.last_step));
    if (step === null) return false;
    await tx.query('UPDATE user_two_step SET last_step = $2 WHERE user_id = $1', [userId, step]);
    return true;
  }
}
