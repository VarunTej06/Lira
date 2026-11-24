import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CONFIG, type Config } from '../config';
import { DbService, type Queryable } from '../db/db.service';
import { SYSTEM_MAILER, type SystemMail, type SystemMailer } from '../mail/mailer';
import { logLine } from '../observability/log';
import { MetricsService } from '../observability/metrics.service';
import { BreachService } from './breach.service';
import { hashPassword } from './password';
import { EMAILS_PER_HOUR, RESET_ADDRESS_LIMIT, WINDOW_MINUTES, attemptKey } from './rate-limit';
import { hashToken, newToken } from './session';

type Kind = 'verify' | 'reset';
export interface Person { id: string; email: string; name: string }

const HOURS: Record<Kind, number> = { verify: 24, reset: 1 };
const BAD_LINK = 'This link has expired or was already used. Ask for a new one.';
const clean = (value: string) => value.replace(/[\r\n]+/g, ' ');
const reasonOf = (error: unknown) => (error instanceof Error ? error.name : 'unknown');

/**
 * Confirming an email address and choosing a new password after forgetting one. Each link carries a random token; only its hash is stored,
 * it works once and expires. Asking to reset a password always gets the same answer, whether or not the address has an account.
 */
@Injectable()
export class RecoveryService {
  constructor(
    @Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService, @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(CONFIG) private readonly config: Config, @Inject(SYSTEM_MAILER) private readonly mailer: SystemMailer,
    @Inject(BreachService) private readonly breach: BreachService,
  ) {}

  get enabled(): boolean { return this.mailer.enabled; }

  /** Sends the "confirm your address" link, unless one went out recently. Never throws: a failed email must not undo a sign-up. */
  async sendVerification(user: Person): Promise<boolean> {
    if (!this.mailer.enabled) return false;
    try {
      const token = await this.issue(user.id, 'verify');
      if (!token) return false;
      const link = `${this.config.allowedOrigins[0]}/verify-email?token=${token}`;
      return await this.deliver('verify', { to: user.email, subject: 'Confirm your email for Liraspaces',
        text: `Hi ${clean(user.name)},\n\nConfirm your email address to finish setting up your Liraspaces account:\n${link}\n\nThe link works for ${HOURS.verify} hours. If you did not create an account, ignore this email.\n` });
    } catch (error) {
      logLine('error', 'sending the confirmation link failed', { reason: reasonOf(error) });
      return false;
    }
  }

  /** The signed-in person asks for a fresh link. */
  async resendVerification(user: Person & { emailVerified: boolean }): Promise<void> {
    if (user.emailVerified) return;
    if (!this.mailer.enabled) throw new ServiceUnavailableException({ code: 'email_not_set_up', message: 'Email is not set up on this server.' });
    if (await this.recent(user.id, 'verify') >= EMAILS_PER_HOUR) throw new HttpException('A link was sent a moment ago. Check your inbox, or wait a while and try again.', HttpStatus.TOO_MANY_REQUESTS);
    await this.sendVerification(user);
  }

  async verify(token: string, ip: string): Promise<void> {
    const userId = await this.db.transaction(async tx => {
      const id = await this.consume(tx, token, 'verify');
      if (id) {
        await tx.query('UPDATE users SET email_verified = true WHERE id = $1', [id]);
        await this.audit.record({ actor: id, action: 'auth.email_verified', outcome: 'ok', sourceIp: ip }, tx);
      }
      return id;
    });
    this.metrics.inc('auth_email_verify_total', { outcome: userId ? 'ok' : 'invalid' });
    if (!userId) throw new BadRequestException({ code: 'invalid_token', message: BAD_LINK });
  }

  /** Always resolves the same way. Where the address has an account, a link is emailed; too many requests are ignored without saying so. */
  async forgot(email: string, ip: string): Promise<void> {
    if (!this.mailer.enabled) throw new ServiceUnavailableException({ code: 'email_not_set_up', message: 'Email is not set up on this server, so a reset link cannot be sent. Contact the administrator.' });
    const addressKey = attemptKey('reset', ip);
    const asked = await this.db.query<{ n: string }>('SELECT count(*) AS n FROM login_attempts WHERE key_hash = $1 AND at > now() - make_interval(mins => $2)', [addressKey, WINDOW_MINUTES]);
    await this.db.query('INSERT INTO login_attempts (key_hash, ok) VALUES ($1, false)', [addressKey]);
    this.metrics.inc('auth_password_reset_total', { step: 'asked' });
    if (Number(asked.rows[0].n) >= RESET_ADDRESS_LIMIT) return;
    const found = await this.db.query<Person & { google: boolean }>('SELECT id, email, name, google_sub IS NOT NULL AS google FROM users WHERE lower(email) = $1', [email]);
    const user = found.rows[0];
    if (!user) return;
    // Sent without waiting, so the answer takes the same time whether or not the account exists.
    void (user.google ? this.sendGoogleNotice(user) : this.sendReset(user, ip)).catch(error => logLine('error', 'sending the reset link failed', { reason: reasonOf(error) }));
  }

  /** Sets the new password with a valid link, ends every session of the account, and tells the owner of the address. */
  async reset(token: string, password: string, ip: string): Promise<void> {
    await this.breach.require(password);
    const hash = await hashPassword(password);
    const user = await this.db.transaction(async tx => {
      const id = await this.consume(tx, token, 'reset');
      if (!id) return null;
      // A person who signs in with Google never has a password, even if the link was made before they linked Google.
      const row = await tx.query<{ email: string; name: string }>('UPDATE users SET password_hash = $2, email_verified = true WHERE id = $1 AND google_sub IS NULL RETURNING email, name', [id, hash]);
      if (row.rowCount === 0) return null;
      await tx.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      await tx.query("UPDATE email_tokens SET used_at = now() WHERE user_id = $1 AND kind = 'reset' AND used_at IS NULL", [id]);
      await this.audit.record({ actor: id, action: 'auth.password_reset', outcome: 'ok', sourceIp: ip }, tx);
      return { id, ...row.rows[0] };
    });
    this.metrics.inc('auth_password_reset_total', { step: user ? 'done' : 'invalid' });
    if (!user) throw new BadRequestException({ code: 'invalid_token', message: BAD_LINK });
    await this.mailer.send({ to: user.email, subject: 'Your Liraspaces password was changed',
      text: `Hi ${clean(user.name)},\n\nThe password of your Liraspaces account was just changed, and you were signed out everywhere.\nIf this was not you, ask for a new reset link at once, or write to the administrator.\n` });
  }

  private async sendReset(user: Person, ip: string): Promise<void> {
    const token = await this.issue(user.id, 'reset');
    if (!token) return;
    const link = `${this.config.allowedOrigins[0]}/reset-password?token=${token}`;
    await this.audit.record({ actor: user.id, action: 'auth.password_reset_requested', outcome: 'ok', sourceIp: ip });
    await this.deliver('reset', { to: user.email, subject: 'Reset your Liraspaces password',
      text: `Hi ${clean(user.name)},\n\nSomeone asked to reset the password of your Liraspaces account. To choose a new one, open:\n${link}\n\nThe link works once, for ${HOURS.reset} hour. If you did not ask, ignore this email: your password has not changed.\n` });
  }

  /** The same visible answer as for any address, with an email that says no password is needed. */
  private async sendGoogleNotice(user: Person): Promise<void> {
    await this.deliver('reset', { to: user.email, subject: 'Signing in to Liraspaces',
      text: `Hi ${clean(user.name)},

Someone asked to reset the password of your Liraspaces account. Your account signs in with Google, so it has no password to reset.
Open ${this.config.allowedOrigins[0]}/login and press the Google button.

If you did not ask, ignore this email.
` });
  }

  private async deliver(kind: Kind, mail: SystemMail): Promise<boolean> {
    const ok = await this.mailer.send(mail);
    this.metrics.inc('auth_email_sent_total', { kind, outcome: ok ? 'ok' : 'failed' });
    return ok;
  }

  private async recent(userId: string, kind: Kind): Promise<number> {
    const r = await this.db.query<{ n: string }>("SELECT count(*) AS n FROM email_tokens WHERE user_id = $1 AND kind = $2 AND created_at > now() - interval '1 hour'", [userId, kind]);
    return Number(r.rows[0].n);
  }

  /** A new token for the account, or null when too many were made in the last hour. */
  private async issue(userId: string, kind: Kind): Promise<string | null> {
    if (await this.recent(userId, kind) >= EMAILS_PER_HOUR) return null;
    const token = newToken();
    await this.db.query('INSERT INTO email_tokens (user_id, kind, token_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(hours => $4))', [userId, kind, hashToken(token), HOURS[kind]]);
    await this.db.query("DELETE FROM email_tokens WHERE created_at < now() - interval '2 days'");
    return token;
  }

  /** Marks the token used and returns its account, or null when it is unknown, used, expired, or of the other kind. */
  private async consume(tx: Queryable, token: string, kind: Kind): Promise<string | null> {
    const r = await tx.query<{ user_id: string }>(
      'UPDATE email_tokens SET used_at = now() WHERE token_hash = $1 AND kind = $2 AND used_at IS NULL AND expires_at > now() RETURNING user_id', [hashToken(token), kind]);
    return r.rows[0]?.user_id ?? null;
  }
}
