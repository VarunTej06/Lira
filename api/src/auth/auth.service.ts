import { ConflictException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { AuditService } from '../audit/audit.service';
import { CONFIG, type Config } from '../config';
import { DbService, type Queryable } from '../db/db.service';
import { MetricsService } from '../observability/metrics.service';
import { hashPassword, spendCheckTime, verifyPassword } from './password';
import { WINDOW_MINUTES, attemptKey, isLocked } from './rate-limit';
import type { LoginInput, SignupInput } from './schemas';
import { hashToken, newToken, sessionSeconds } from './session';

export interface PublicUser { id: string; email: string; name: string }
export interface Membership { orgId: string; orgName: string; role: string }
export interface SignedIn { token: string; maxAgeSeconds: number; user: PublicUser; organisations: Membership[] }
export interface Me { user: PublicUser; organisations: Membership[] }

const WRONG_LOGIN = 'The email or password is not correct.';
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DbService) private readonly db: DbService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** Creates the account, an organisation of one with the person as its owner, and a first session. */
  async signup(input: SignupInput, ip: string): Promise<SignedIn> {
    const passwordHash = await hashPassword(input.password);
    const token = newToken();
    const maxAgeSeconds = sessionSeconds(input.remember ?? false, this.config.sessionHours, this.config.rememberDays);
    try {
      const signedIn = await this.db.transaction(async tx => {
        const org = await tx.query<{ id: string }>('INSERT INTO organisations (name) VALUES ($1) RETURNING id', [`${input.name}'s space`]);
        const user = await tx.query<PublicUser>('INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name', [input.email, input.name, passwordHash]);
        await tx.query("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')", [org.rows[0].id, user.rows[0].id]);
        await this.createSession(tx, user.rows[0].id, token, input.remember ?? false, maxAgeSeconds);
        await this.audit.record({ actor: user.rows[0].id, orgId: org.rows[0].id, action: 'auth.signup', outcome: 'ok', sourceIp: ip }, tx);
        return { user: user.rows[0], organisations: [{ orgId: org.rows[0].id, orgName: `${input.name}'s space`, role: 'owner' }] };
      });
      this.metrics.inc('auth_signup_total', { outcome: 'ok' });
      return { token, maxAgeSeconds, ...signedIn };
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        this.metrics.inc('auth_signup_total', { outcome: 'duplicate' });
        await this.audit.record({ action: 'auth.signup', outcome: 'denied', sourceIp: ip, detail: { reason: 'duplicate_email' } });
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }
  }

  async login(input: LoginInput, ip: string): Promise<SignedIn> {
    const emailKey = attemptKey('email', input.email);
    const addressKey = attemptKey('address', ip);
    if (await this.locked(emailKey, addressKey)) {
      this.metrics.inc('auth_login_total', { outcome: 'locked' });
      await this.audit.record({ action: 'auth.login', outcome: 'denied', sourceIp: ip, detail: { reason: 'locked' } });
      throw new HttpException('Too many wrong attempts. Wait a few minutes and try again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const found = await this.db.query<{ id: string; email: string; name: string; password_hash: string }>(
      'SELECT id, email, name, password_hash FROM users WHERE lower(email) = $1', [input.email]);
    const user = found.rows[0];
    if (!user) await spendCheckTime(input.password);
    if (!user || !(await verifyPassword(user.password_hash, input.password))) {
      await this.recordAttempt(emailKey, addressKey, false);
      this.metrics.inc('auth_login_total', { outcome: 'wrong' });
      await this.audit.record({ actor: user?.id ?? null, action: 'auth.login', outcome: 'denied', sourceIp: ip, detail: { reason: 'wrong_credentials' } });
      throw new UnauthorizedException(WRONG_LOGIN);
    }
    const token = newToken();
    const remember = input.remember ?? false;
    const maxAgeSeconds = sessionSeconds(remember, this.config.sessionHours, this.config.rememberDays);
    const organisations = await this.db.transaction(async tx => {
      await this.createSession(tx, user.id, token, remember, maxAgeSeconds);
      await tx.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
      await this.audit.record({ actor: user.id, action: 'auth.login', outcome: 'ok', sourceIp: ip, detail: { remember } }, tx);
      return this.memberships(tx, user.id);
    });
    await this.recordAttempt(emailKey, addressKey, true);
    this.metrics.inc('auth_login_total', { outcome: 'ok' });
    return { token, maxAgeSeconds, user: { id: user.id, email: user.email, name: user.name }, organisations };
  }

  async logout(token: string | undefined, ip: string): Promise<void> {
    if (!token) return;
    const gone = await this.db.query<{ user_id: string }>('DELETE FROM sessions WHERE token_hash = $1 RETURNING user_id', [hashToken(token)]);
    if (gone.rows[0]) await this.audit.record({ actor: gone.rows[0].user_id, action: 'auth.logout', outcome: 'ok', sourceIp: ip });
  }

  /** Who the session belongs to, or null for a missing, unknown or expired session. */
  async me(token: string | undefined): Promise<Me | null> {
    if (!token) return null;
    const hash = hashToken(token);
    const found = await this.db.query<PublicUser>(
      'SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()', [hash]);
    const user = found.rows[0];
    if (!user) return null;
    await this.db.query("UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1 AND last_seen_at < now() - interval '1 minute'", [hash]);
    return { user, organisations: await this.memberships(this.db, user.id) };
  }

  private createSession(tx: PoolClient, userId: string, token: string, remember: boolean, maxAgeSeconds: number) {
    return tx.query('INSERT INTO sessions (user_id, token_hash, remember, expires_at) VALUES ($1, $2, $3, now() + make_interval(secs => $4))',
      [userId, hashToken(token), remember, maxAgeSeconds]);
  }

  private async memberships(at: Queryable, userId: string): Promise<Membership[]> {
    const rows = await at.query<{ org_id: string; name: string; role: string }>(
      'SELECT o.id AS org_id, o.name, m.role FROM memberships m JOIN organisations o ON o.id = m.org_id WHERE m.user_id = $1 ORDER BY o.created_at', [userId]);
    return rows.rows.map(r => ({ orgId: r.org_id, orgName: r.name, role: r.role }));
  }

  private async locked(emailKey: string, addressKey: string): Promise<boolean> {
    const counts = await this.db.query<{ key_hash: string; n: string }>(
      `SELECT key_hash, count(*) AS n FROM login_attempts WHERE key_hash = ANY($1) AND ok = false AND at > now() - make_interval(mins => $2) GROUP BY key_hash`,
      [[emailKey, addressKey], WINDOW_MINUTES]);
    const count = (key: string) => Number(counts.rows.find(r => r.key_hash === key)?.n ?? 0);
    return isLocked(count(emailKey), count(addressKey));
  }

  private async recordAttempt(emailKey: string, addressKey: string, ok: boolean): Promise<void> {
    await this.db.query('INSERT INTO login_attempts (key_hash, ok) VALUES ($1, $3), ($2, $3)', [emailKey, addressKey, ok]);
    // Old rows are not needed once they are outside the window, so clear them as we go.
    await this.db.query("DELETE FROM login_attempts WHERE at < now() - interval '1 day'");
  }
}
