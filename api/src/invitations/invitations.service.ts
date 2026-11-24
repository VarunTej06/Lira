import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { Me } from '../auth/auth.service';
import { hashToken, newToken } from '../auth/session';
import { CONFIG, type Config } from '../config';
import { DbService } from '../db/db.service';
import { SYSTEM_MAILER, type SystemMailer } from '../mail/mailer';
import { MetricsService } from '../observability/metrics.service';
import { EMAIL_SENDER, type EmailSender } from './email';

export interface InvitationOut { id: string; email: string; role: string; teamId: string | null; spaceId: number | null; level: string | null; shares: Shares | null; expiresAt: string }
export interface CreatedInvitation extends InvitationOut { token: string; emailed: boolean }

const VALID_DAYS = 7;
export interface Shares { projects: boolean; roadmaps: boolean; dashboards: boolean; sprints: boolean }
const ALL_SHARED: Shares = { projects: true, roadmaps: true, dashboards: true, sprints: true };

/**
 * Invitations by email. The link carries a random token; only its hash is stored, and the token is shown once to the person who invited,
 * so a copy of the database cannot be used to join an organisation. An invitation works once, for the invited address only, until it expires.
 */
@Injectable()
export class InvitationsService {
  constructor(
    @Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService, @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(CONFIG) private readonly config: Config, @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(SYSTEM_MAILER) private readonly mailer: SystemMailer,
  ) {}

  async list(orgId: string): Promise<InvitationOut[]> {
    const rows = await this.db.query<{ id: string; email: string; role: string; team_id: string | null; space_id: string | null; space_level: string | null; share_projects: boolean; share_roadmaps: boolean; share_dashboards: boolean; share_sprints: boolean; expires_at: Date }>(
      'SELECT id, email, role, team_id, space_id, space_level, share_projects, share_roadmaps, share_dashboards, share_sprints, expires_at FROM invitations WHERE org_id = $1 AND accepted_at IS NULL AND expires_at > now() ORDER BY created_at DESC', [orgId]);
    return rows.rows.map(r => ({ id: r.id, email: r.email, role: r.role, teamId: r.team_id, spaceId: r.space_id === null ? null : Number(r.space_id), level: r.space_level,
      shares: r.space_id === null ? null : { projects: r.share_projects, roadmaps: r.share_roadmaps, dashboards: r.share_dashboards, sprints: r.share_sprints }, expiresAt: r.expires_at.toISOString() }));
  }

  async create(orgId: string, orgName: string, actor: string, input: { email: string; role: string; teamId?: string; spaceId?: number; level?: string; shares?: Partial<Shares> }, ip: string): Promise<CreatedInvitation> {
    const shares: Shares = { ...ALL_SHARED, ...input.shares };
    const token = newToken();
    const named: { space: string | null } = { space: null };
    const made = await this.db.transaction(async tx => {
      const already = await tx.query('SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 AND lower(u.email) = $2', [orgId, input.email]);
      if (already.rowCount) throw new ConflictException({ code: 'already_member', message: 'This person is already in the organisation.' });
      if (input.teamId && (await tx.query('SELECT 1 FROM teams WHERE org_id = $1 AND id = $2', [orgId, input.teamId])).rowCount === 0) throw new NotFoundException('Not found.');
      if (input.spaceId !== undefined) {
        const space = await tx.query<{ name: string }>('SELECT name FROM spaces WHERE org_id = $1 AND id = $2', [orgId, input.spaceId]);
        if (space.rowCount === 0) throw new NotFoundException('Not found.');
        named.space = space.rows[0].name;
      }
      await tx.query('DELETE FROM invitations WHERE org_id = $1 AND email = $2 AND accepted_at IS NULL', [orgId, input.email]);
      const r = await tx.query<{ id: string; expires_at: Date }>(
        `INSERT INTO invitations (org_id, email, role, team_id, space_id, space_level, share_projects, share_roadmaps, share_dashboards, share_sprints, token_hash, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now() + make_interval(days => $13)) RETURNING id, expires_at`,
        [orgId, input.email, input.role, input.teamId ?? null, input.spaceId ?? null, input.level ?? null, shares.projects, shares.roadmaps, shares.dashboards, shares.sprints, hashToken(token), actor, VALID_DAYS]);
      await this.audit.record({ actor, orgId, action: 'invitation.create', outcome: 'ok', sourceIp: ip, detail: { invitationId: r.rows[0].id, role: input.role, spaceId: input.spaceId ?? null, level: input.level ?? null, sprints: input.spaceId === undefined ? null : shares.sprints, projects: input.spaceId === undefined ? null : shares.projects, roadmaps: input.spaceId === undefined ? null : shares.roadmaps, dashboards: input.spaceId === undefined ? null : shares.dashboards } }, tx);
      return r.rows[0];
    });
    const link = `${this.config.allowedOrigins[0] ?? ''}/invite?token=${token}`;
    const emailed = await this.email.send({
      orgId, to: input.email, subject: `You are invited to ${orgName} on Liraspaces`,
      text: `You have been invited to ${named.space ? `the space "${named.space.replace(/[\r\n]+/g, ' ')}" in ` : ''}${orgName} on Liraspaces, with ${input.level ? `${input.level} access` : `the role ${input.role}`}.\n\nOpen this link, signed in or signed up with ${input.email}:\n${link}\n\nIt works once and expires in ${VALID_DAYS} days.`,
    });
    this.metrics.inc('invitations_total', { emailed: String(emailed) });
    return { id: made.id, email: input.email, role: input.role, teamId: input.teamId ?? null, spaceId: input.spaceId ?? null, level: input.level ?? null, shares: input.spaceId === undefined ? null : shares, expiresAt: made.expires_at.toISOString(), token, emailed };
  }

  async revoke(orgId: string, actor: string, id: string, ip: string): Promise<void> {
    await this.db.transaction(async tx => {
      const r = await tx.query('DELETE FROM invitations WHERE org_id = $1 AND id = $2 AND accepted_at IS NULL', [orgId, id]);
      if (r.rowCount === 0) throw new NotFoundException('Not found.');
      await this.audit.record({ actor, orgId, action: 'invitation.revoke', outcome: 'ok', sourceIp: ip, detail: { invitationId: id } }, tx);
    });
  }

  /** Joins the signed-in person to the organisation, when the link is valid and was meant for their address. */
  async accept(me: Me, token: string, ip: string): Promise<{ orgId: string; orgName: string }> {
    // Only where email works: without it nobody could ever confirm an address, and invitations would never be usable.
    if (this.mailer.enabled && !me.user.emailVerified) throw new ForbiddenException({ code: 'email_not_verified', message: 'Confirm your email address first (the link is in the email we sent you), then open the invitation again.' });
    return this.db.transaction(async tx => {
      const found = await tx.query<{ id: string; org_id: string; email: string; role: string; team_id: string | null; space_id: string | null; space_level: string | null; share_projects: boolean; share_roadmaps: boolean; share_dashboards: boolean; share_sprints: boolean; org_name: string }>(
        `SELECT i.id, i.org_id, i.email, i.role, i.team_id, i.space_id, i.space_level, i.share_projects, i.share_roadmaps, i.share_dashboards, i.share_sprints, o.name AS org_name FROM invitations i JOIN organisations o ON o.id = i.org_id
          WHERE i.token_hash = $1 AND i.accepted_at IS NULL AND i.expires_at > now() FOR UPDATE OF i`, [hashToken(token)]);
      const inv = found.rows[0];
      if (!inv) throw new NotFoundException({ code: 'invalid_invitation', message: 'This invitation is not valid any more. Ask for a new one.' });
      if (inv.email !== me.user.email.toLowerCase()) {
        await this.audit.record({ actor: me.user.id, orgId: inv.org_id, action: 'invitation.accept', outcome: 'denied', sourceIp: ip, detail: { invitationId: inv.id, reason: 'wrong_email' } }, tx);
        throw new ForbiddenException({ code: 'wrong_email', message: 'This invitation was sent to a different email address.' });
      }
      await tx.query('INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (org_id, user_id) DO NOTHING', [inv.org_id, me.user.id, inv.role]);
      if (inv.team_id) await tx.query('INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [inv.team_id, me.user.id]);
      // Only the invited space: the person sees nothing else in the organisation. An existing grant is left as it is.
      if (inv.space_id !== null) {
        await tx.query("INSERT INTO grants (org_id, subject_type, subject_id, object_kind, object_id, level, created_by) VALUES ($1, 'user', $2, 'space', $3, $4, $2) ON CONFLICT DO NOTHING", [inv.org_id, me.user.id, String(inv.space_id), inv.space_level]);
        await tx.query('INSERT INTO space_shares (org_id, user_id, space_id, projects, roadmaps, dashboards, sprints) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING',
          [inv.org_id, me.user.id, inv.space_id, inv.share_projects, inv.share_roadmaps, inv.share_dashboards, inv.share_sprints]);
      }
      await tx.query('UPDATE invitations SET accepted_at = now() WHERE id = $1', [inv.id]);
      await this.audit.record({ actor: me.user.id, orgId: inv.org_id, action: 'invitation.accept', outcome: 'ok', sourceIp: ip, detail: { invitationId: inv.id, role: inv.role, spaceId: inv.space_id === null ? null : Number(inv.space_id) } }, tx);
      return { orgId: inv.org_id, orgName: inv.org_name };
    });
  }
}
