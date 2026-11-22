import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CONFIG, type Config } from '../config';
import { DbService } from '../db/db.service';
import type { EmailMessage, EmailSender } from '../invitations/email';
import { logLine } from '../observability/log';
import { isMeetingLink } from '../standups/schemas';
import { decryptToken, encryptToken, parseKey, signState, verifyState } from './crypto';
import { buildRawEmail } from './mime';

/** How the app reaches Google. A test supplies its own, so nothing real is called. */
export type Http = (url: string, init?: RequestInit) => Promise<Response>;
export const GOOGLE_HTTP = Symbol('GOOGLE_HTTP');

// The only addresses this service ever calls. They are fixed here: no address from a request is ever fetched.
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const MEET_URL = 'https://meet.googleapis.com/v2/spaces';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
export const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/meetings.space.created', 'https://www.googleapis.com/auth/gmail.send'];

export interface GoogleStatus { configured: boolean; connected: boolean; email: string | null }

/**
 * The organisation's connected Google account: it makes the Meet link of a stand-up and sends the invitation emails. The person who
 * connects it (the Owner) signs in at Google and agrees to exactly the permissions in SCOPES; the app keeps only a refresh token,
 * encrypted, and asks Google for a short-lived access token whenever it needs one.
 */
@Injectable()
export class GoogleService implements EmailSender {
  private readonly cache = new Map<string, { token: string; until: number }>();

  constructor(
    @Inject(CONFIG) private readonly config: Config, @Inject(DbService) private readonly db: DbService,
    @Inject(AuditService) private readonly audit: AuditService, @Inject(GOOGLE_HTTP) private readonly http: Http,
  ) {}

  private get google() { return this.config.google; }
  private get key() { return parseKey(this.google!.tokenKey); }

  async status(orgId: string): Promise<GoogleStatus> {
    if (!this.google) return { configured: false, connected: false, email: null };
    const r = await this.db.query<{ google_email: string }>('SELECT google_email FROM google_connections WHERE org_id = $1', [orgId]);
    return { configured: true, connected: r.rows.length > 0, email: r.rows[0]?.google_email ?? null };
  }

  /** The address to send the Owner to, to sign in at Google and agree. */
  authorisationUrl(orgId: string, userId: string): string {
    if (!this.google) throw new ConflictException({ code: 'not_configured', message: 'Google is not set up on this server.' });
    const params = new URLSearchParams({
      client_id: this.google.clientId, redirect_uri: this.google.redirectUri, response_type: 'code', scope: SCOPES.join(' '),
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: signState(orgId, userId, this.key),
    });
    return `${AUTH_URL}?${params}`;
  }

  /** Google sent the person back with a code. Checks the state, trades the code for tokens, finds out which account it is, and keeps the refresh token. */
  async complete(code: string, state: string, sessionUserId: string, ip: string): Promise<string> {
    if (!this.google) throw new ConflictException({ code: 'not_configured', message: 'Google is not set up on this server.' });
    const verified = verifyState(state, this.key);
    if (!verified || verified.userId !== sessionUserId) throw new BadRequestException({ code: 'invalid_state', message: 'This sign-in link is not valid. Start again.' });
    const owner = await this.db.query('SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2 AND role = \'owner\'', [verified.orgId, sessionUserId]);
    if (owner.rowCount === 0) throw new ForbiddenException('You do not have access to this.');
    const tokens = await this.post(TOKEN_URL, new URLSearchParams({
      code, client_id: this.google.clientId, client_secret: this.google.clientSecret, redirect_uri: this.google.redirectUri, grant_type: 'authorization_code',
    }));
    const refresh = typeof tokens?.refresh_token === 'string' ? tokens.refresh_token : null;
    const access = typeof tokens?.access_token === 'string' ? tokens.access_token : null;
    if (!refresh || !access) throw new BadRequestException({ code: 'no_token', message: 'Google did not give permission. Start again and allow everything asked.' });
    const info = await this.get(USERINFO_URL, access);
    const email = typeof info?.email === 'string' ? info.email : null;
    if (!email) throw new BadRequestException({ code: 'no_email', message: 'Google did not say which account this is.' });
    await this.db.transaction(async tx => {
      await tx.query(
        `INSERT INTO google_connections (org_id, google_email, refresh_token, connected_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (org_id) DO UPDATE SET google_email = EXCLUDED.google_email, refresh_token = EXCLUDED.refresh_token, connected_by = EXCLUDED.connected_by, connected_at = now()`,
        [verified.orgId, email, encryptToken(refresh, this.key), sessionUserId]);
      await this.audit.record({ actor: sessionUserId, orgId: verified.orgId, action: 'google.connect', outcome: 'ok', sourceIp: ip }, tx);
    });
    this.cache.delete(verified.orgId);
    return verified.orgId;
  }

  async disconnect(orgId: string, actor: string, ip: string): Promise<void> {
    const r = await this.db.query<{ refresh_token: string }>('DELETE FROM google_connections WHERE org_id = $1 RETURNING refresh_token', [orgId]);
    this.cache.delete(orgId);
    if (!r.rows[0]) return;
    await this.audit.record({ actor, orgId, action: 'google.disconnect', outcome: 'ok', sourceIp: ip });
    if (this.google) {
      try { await this.http(`${REVOKE_URL}?${new URLSearchParams({ token: decryptToken(r.rows[0].refresh_token, this.key) })}`, { method: 'POST' }); } catch { /* the connection is gone here either way */ }
    }
  }

  /** A Meet link for a new call, or null when Google is not connected or would not make one. */
  async createMeetLink(orgId: string): Promise<string | null> {
    const token = await this.accessToken(orgId);
    if (!token) return null;
    try {
      const res = await this.http(MEET_URL, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
      const body = (await res.json().catch(() => null)) as { meetingUri?: unknown } | null;
      return res.ok && typeof body?.meetingUri === 'string' && isMeetingLink(body.meetingUri) ? body.meetingUri : null;
    } catch { return null; }
  }

  /** Sends an email from the connected account. False when there is no connection or Google refused. */
  async send(message: EmailMessage): Promise<boolean> {
    if (!message.orgId) return false;
    const token = await this.accessToken(message.orgId);
    const from = (await this.status(message.orgId)).email;
    if (!token || !from) return false;
    try {
      const raw = buildRawEmail({ from, to: message.to, subject: message.subject, text: message.text });
      const res = await this.http(GMAIL_SEND_URL, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) });
      return res.ok;
    } catch { return false; }
  }

  /** A short-lived access token for the organisation's connection, kept in memory until a minute before it ends. */
  private async accessToken(orgId: string): Promise<string | null> {
    if (!this.google) return null;
    const cached = this.cache.get(orgId);
    if (cached && cached.until > Date.now() + 60_000) return cached.token;
    const r = await this.db.query<{ refresh_token: string }>('SELECT refresh_token FROM google_connections WHERE org_id = $1', [orgId]);
    if (!r.rows[0]) return null;
    try {
      const tokens = await this.post(TOKEN_URL, new URLSearchParams({
        client_id: this.google.clientId, client_secret: this.google.clientSecret, refresh_token: decryptToken(r.rows[0].refresh_token, this.key), grant_type: 'refresh_token',
      }));
      if (typeof tokens?.access_token !== 'string') return null;
      this.cache.set(orgId, { token: tokens.access_token, until: Date.now() + (typeof tokens.expires_in === 'number' ? tokens.expires_in : 300) * 1000 });
      return tokens.access_token;
    } catch (error) {
      logLine('warn', 'google token refresh failed', { kind: error instanceof Error ? error.name : typeof error });
      return null;
    }
  }

  private async post(url: string, form: URLSearchParams): Promise<Record<string, unknown> | null> {
    const res = await this.http(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    return res.ok ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null;
  }

  private async get(url: string, token: string): Promise<Record<string, unknown> | null> {
    const res = await this.http(url, { headers: { Authorization: `Bearer ${token}` } });
    return res.ok ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null;
  }
}
