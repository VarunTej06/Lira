import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CONFIG, type Config } from '../config';
import { DbService, type Queryable } from '../db/db.service';
import { encryptToken, parseKey } from '../google/crypto';
import { GOOGLE_HTTP, SCOPES, type Http } from '../google/google.service';
import { MetricsService } from '../observability/metrics.service';
import { AuthService } from './auth.service';
import { verifyIdToken, type GoogleClaims, type Jwk } from './google-id-token';
import { newToken, sessionSeconds } from './session';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
export const LOGIN_COOKIE = 'lira_oauth';
const LOGIN_MINUTES = 10;
const KEYS_MINUTES = 60;

/** Signing up asks, once, for what a new owner will need (Meet links and invitation email); logging in asks only who the person is. */
export type Intent = 'login' | 'signup';
const IDENTITY_SCOPES = 'openid email profile';
const MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export interface GoogleStart { url: string; cookie: string; maxAgeSeconds: number }
export interface GoogleDone { token: string; maxAgeSeconds: number }

const b64 = (bytes: number): string => randomBytes(bytes).toString('base64url');

/**
 * Signing in and signing up with Google (OpenID Connect, authorisation code with PKCE). Nothing about the person is trusted until the
 * ID token passes every check in google-id-token.ts. The state, the nonce and the PKCE secret travel in a short-lived signed cookie, so
 * a callback that was not started by this browser is refused.
 */
@Injectable()
export class GoogleLoginService {
  private keys: { list: Jwk[]; until: number } | null = null;

  constructor(
    @Inject(CONFIG) private readonly config: Config, @Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MetricsService) private readonly metrics: MetricsService, @Inject(AuthService) private readonly auth: AuthService, @Inject(GOOGLE_HTTP) private readonly http: Http,
  ) {}

  get enabled(): boolean { return this.config.google !== undefined; }

  /** The address Google sends the person back to: always our own first allowed origin, which is registered in the Google project. */
  get redirectUri(): string { return `${this.config.allowedOrigins[0] ?? ''}/api/auth/google/callback`; }

  private mac(value: string): string { return createHmac('sha256', parseKey(this.config.google!.tokenKey)).update(`login:${value}`).digest('base64url'); }

  start(intent: Intent = 'login', now = Date.now()): GoogleStart {
    const g = this.config.google!;
    const state = b64(24), nonce = b64(24), verifier = b64(32);
    const payload = Buffer.from(JSON.stringify({ s: state, n: nonce, v: verifier, i: intent, e: now + LOGIN_MINUTES * 60_000 })).toString('base64url');
    const signup = intent === 'signup';
    const params = new URLSearchParams({
      client_id: g.clientId, redirect_uri: this.redirectUri, response_type: 'code', scope: signup ? SCOPES.join(' ').replace('openid email', IDENTITY_SCOPES) : IDENTITY_SCOPES, state, nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: signup ? 'consent select_account' : 'select_account',
      ...(signup ? { access_type: 'offline' } : {}),
    });
    return { url: `${AUTH_URL}?${params}`, cookie: `${payload}.${this.mac(payload)}`, maxAgeSeconds: LOGIN_MINUTES * 60 };
  }

  /** The values this browser's sign-in started with, or null when the cookie is missing, altered or too old. */
  private readCookie(cookie: string | undefined, now: number): { s: string; n: string; v: string; i: Intent } | null {
    const [payload, mac] = (cookie ?? '').split('.');
    if (!payload || !mac) return null;
    const expected = Buffer.from(this.mac(payload)), given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const v = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { s?: unknown; n?: unknown; v?: unknown; i?: unknown; e?: unknown };
      return typeof v.s === 'string' && typeof v.n === 'string' && typeof v.v === 'string' && typeof v.e === 'number' && v.e > now ? { s: v.s, n: v.n, v: v.v, i: v.i === 'signup' ? 'signup' : 'login' } : null;
    } catch { return null; }
  }

  private async signingKeys(now: number): Promise<Jwk[]> {
    if (this.keys && this.keys.until > now) return this.keys.list;
    const res = await this.http(CERTS_URL);
    const body = (await res.json().catch(() => null)) as { keys?: Jwk[] } | null;
    if (!res.ok || !Array.isArray(body?.keys)) return this.keys?.list ?? [];
    this.keys = { list: body.keys, until: now + KEYS_MINUTES * 60_000 };
    return body.keys;
  }

  /** Completes the sign-in. Resolves a new session, or null when anything is not right (nothing is said about why). */
  async finish(code: string, state: string, cookie: string | undefined, ip: string, now = Date.now()): Promise<GoogleDone | null> {
    const g = this.config.google!;
    const started = this.readCookie(cookie, now);
    const sameState = started && Buffer.from(started.s).length === Buffer.from(state).length && timingSafeEqual(Buffer.from(started.s), Buffer.from(state));
    if (!started || !sameState) return this.refused(ip, 'state');
    const res = await this.http(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: g.clientId, client_secret: g.clientSecret, redirect_uri: this.redirectUri, grant_type: 'authorization_code', code_verifier: started.v }).toString(),
    });
    const tokens = res.ok ? ((await res.json().catch(() => null)) as { id_token?: unknown; refresh_token?: unknown; scope?: unknown } | null) : null;
    if (typeof tokens?.id_token !== 'string') return this.refused(ip, 'exchange');
    const claims = verifyIdToken(tokens.id_token, { clientId: g.clientId, nonce: started.n, keys: await this.signingKeys(now), now });
    if (!claims) return this.refused(ip, 'token');
    // Everything for calls is kept only when the person was asked at sign-up, and agreed to every permission (Google lets them tick each one)
    const granted = typeof tokens.scope === 'string' ? tokens.scope.split(' ') : [];
    const connection = started.i === 'signup' && typeof tokens.refresh_token === 'string' && granted.includes(MEET_SCOPE) && granted.includes(GMAIL_SCOPE) ? tokens.refresh_token : null;
    return this.signIn(claims, ip, connection, granted.join(' '));
  }

  private async refused(ip: string, reason: string): Promise<null> {
    this.metrics.inc('auth_google_total', { outcome: 'refused' });
    await this.audit.record({ action: 'auth.google', outcome: 'denied', sourceIp: ip, detail: { reason } });
    return null;
  }

  /**
   * Finds or makes the account. By Google's account id first. Otherwise by email: an account made earlier with a password is taken over
   * by the person who has just proven they own the address with Google, and its password is removed and its sessions ended, because
   * nobody had proven the address when the password was set. A new person gets an account and an organisation of one, as owner.
   */
  private async signIn(claims: GoogleClaims, ip: string, refreshToken: string | null, scopes: string): Promise<GoogleDone> {
    const token = newToken();
    const maxAgeSeconds = sessionSeconds(false, this.config.sessionHours, this.config.rememberDays);
    const outcome = await this.db.transaction(async tx => {
      const bySub = await tx.query<{ id: string }>('SELECT id FROM users WHERE google_sub = $1', [claims.sub]);
      let userId = bySub.rows[0]?.id;
      let action = 'auth.google.login';
      if (!userId) {
        const byEmail = await tx.query<{ id: string }>('SELECT id FROM users WHERE lower(email) = $1 FOR UPDATE', [claims.email]);
        if (byEmail.rows[0]) {
          userId = byEmail.rows[0].id;
          await tx.query('UPDATE users SET google_sub = $2, email_verified = true, password_hash = NULL WHERE id = $1', [userId, claims.sub]);
          await tx.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
          action = 'auth.google.link';
        } else {
          const org = await tx.query<{ id: string }>('INSERT INTO organisations (name) VALUES ($1) RETURNING id', [`${claims.name}'s space`]);
          const made = await tx.query<{ id: string }>('INSERT INTO users (email, name, google_sub, email_verified) VALUES ($1, $2, $3, true) RETURNING id', [claims.email, claims.name, claims.sub]);
          userId = made.rows[0].id;
          await tx.query("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')", [org.rows[0].id, userId]);
          action = 'auth.google.signup';
        }
      }
      await this.auth.createSession(tx, userId, token, false, maxAgeSeconds);
      await tx.query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
      if (refreshToken) await this.keepConnection(tx, userId, claims.email, refreshToken, ip, scopes);
      await this.audit.record({ actor: userId, action, outcome: 'ok', sourceIp: ip }, tx);
      return action;
    });
    this.metrics.inc('auth_google_total', { outcome: outcome.replace('auth.google.', '') });
    return { token, maxAgeSeconds };
  }

  /** The person's own organisation (the one they own) gets this Google account for Meet links and email, as if they had pressed Connect Google. */
  private async keepConnection(tx: Queryable, userId: string, email: string, refreshToken: string, ip: string, scopes: string): Promise<void> {
    const owned = await tx.query<{ org_id: string }>("SELECT org_id FROM memberships WHERE user_id = $1 AND role = 'owner' ORDER BY created_at LIMIT 1", [userId]);
    const orgId = owned.rows[0]?.org_id;
    if (!orgId) return;
    await tx.query(
      `INSERT INTO google_connections (org_id, google_email, refresh_token, connected_by, scopes) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (org_id) DO UPDATE SET google_email = EXCLUDED.google_email, refresh_token = EXCLUDED.refresh_token, connected_by = EXCLUDED.connected_by, scopes = EXCLUDED.scopes, connected_at = now()`,
      [orgId, email, encryptToken(refreshToken, parseKey(this.config.google!.tokenKey)), userId, scopes]);
    await this.audit.record({ actor: userId, orgId, action: 'google.connect', outcome: 'ok', sourceIp: ip, detail: { via: 'sign-up' } }, tx);
  }
}
