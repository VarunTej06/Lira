import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { isAdminRole } from '../access/access.service';
import { roleIn } from '../access/org-access';
import { AuditService } from '../audit/audit.service';
import type { Me } from '../auth/auth.service';
import { DbService, type Queryable } from '../db/db.service';
import { GoogleService } from '../google/google.service';
import { EMAIL_SENDER, type EmailSender } from '../invitations/email';
import { MetricsService } from '../observability/metrics.service';
import { recurrenceOf } from '../reminders/occurrences';
import type { CreateStandup, UpdateStandup } from './schemas';

export interface Invitee { type: 'user' | 'team'; id: string }
type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly';
type ScopeType = 'org' | 'space' | 'project' | 'sprint';
export interface StandupOut {
  scopeType: ScopeType; scopeId: string; scopeName: string;
  id: string; title: string; startsAt: string; durationMinutes: number; link: string; linkSource: 'pasted' | 'meet';
  repeat: Repeat; repeatUntil: string | null; timeZone: string; invitees: Invitee[] | null;
}
export interface CreatedStandup extends StandupOut { emailed: { sent: number; total: number } }

interface Row {
  id: string; title: string; starts_at: Date; duration_minutes: number; link: string; link_source: 'pasted' | 'meet';
  repeat: Repeat; repeat_until: string | null; time_zone: string; scope_type: ScopeType; scope_id: string; scope_name: string;
}

const COLUMNS = "c.id, c.title, c.starts_at, c.duration_minutes, c.link, c.link_source, c.repeat, to_char(c.repeat_until, 'YYYY-MM-DD') AS repeat_until, c.time_zone, c.scope_type, c.scope_id, c.scope_name";
const RETURNING = "id, title, starts_at, duration_minutes, link, link_source, repeat, to_char(repeat_until, 'YYYY-MM-DD') AS repeat_until, time_zone, scope_type, scope_id, scope_name";
const invalid = (field: string, message: string) => new BadRequestException({ code: 'invalid_input', message, fields: { [field]: message } });

const REPEAT_WORDS: Record<Repeat, string> = { none: '', daily: 'every day', weekdays: 'every weekday', weekly: 'every week' };

/**
 * Stand-up calls. Owner and Admin make, change and delete them; everyone invited (directly or through a team) can see a call and
 * open its link, and nothing more. A call is a single start time or a series (every day, weekday or week until a last day). The
 * link is pasted, or, when the Owner has connected Google, made as a Google Meet link. The call itself runs in Meet or Teams.
 */
@Injectable()
export class StandupsService {
  constructor(
    @Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MetricsService) private readonly metrics: MetricsService, @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(GoogleService) private readonly google: GoogleService,
  ) {}

  /** The people and teams an Owner or Admin can choose from when scheduling, and whether the app can make the Meet link itself. */
  async audience(orgId: string): Promise<{ people: { id: string; name: string; email: string }[]; teams: { id: string; name: string }[]; canMakeMeetLink: boolean }> {
    const people = await this.db.query<{ id: string; name: string; email: string }>('SELECT u.id, u.name, u.email FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 ORDER BY u.name', [orgId]);
    const teams = await this.db.query<{ id: string; name: string }>('SELECT id, name FROM teams WHERE org_id = $1 ORDER BY name', [orgId]);
    return { people: people.rows, teams: teams.rows, canMakeMeetLink: (await this.google.status(orgId)).connected };
  }

  /** Owner and Admin see every call, with who is invited; anyone else sees only the calls they are invited to, without the guest list. */
  async list(me: Me, orgId: string): Promise<StandupOut[]> {
    const admin = isAdminRole(roleIn(me, orgId));
    const rows = await this.db.query<Row>(
      `SELECT ${COLUMNS} FROM standup_calls c WHERE c.org_id = $1 AND ($3 OR EXISTS (
         SELECT 1 FROM standup_invitees i WHERE i.call_id = c.id AND ((i.subject_type = 'user' AND i.subject_id = $2)
           OR (i.subject_type = 'team' AND i.subject_id IN (SELECT team_id FROM team_members WHERE user_id = $2))))) ORDER BY c.starts_at`,
      [orgId, me.user.id, admin]);
    const guests = admin && rows.rows.length
      ? await this.db.query<{ call_id: string; subject_type: 'user' | 'team'; subject_id: string }>('SELECT call_id, subject_type, subject_id FROM standup_invitees WHERE call_id = ANY($1::uuid[])', [rows.rows.map(r => r.id)])
      : null;
    return rows.rows.map(r => ({ ...out(r), invitees: guests ? guests.rows.filter(g => g.call_id === r.id).map(g => ({ type: g.subject_type, id: g.subject_id })) : null }));
  }

  async create(orgId: string, actor: string, input: CreateStandup, ip: string): Promise<CreatedStandup> {
    const { link, source } = await this.resolveLink(orgId, input.link);
    const repeat = input.repeat ?? 'none';
    const made = await this.db.transaction(async tx => {
      await this.requireInOrg(tx, orgId, input.invitees);
      const r = await tx.query<Row>(
        `INSERT INTO standup_calls (org_id, title, starts_at, duration_minutes, link, link_source, repeat, repeat_until, time_zone, created_by, scope_type, scope_id, scope_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING ${RETURNING}`,
        [orgId, input.title, input.startsAt, input.durationMinutes, link, source, repeat, repeat === 'none' ? null : input.repeatUntil ?? null, input.timeZone, actor,
          input.scopeType ?? 'org', input.scopeId ?? '', input.scopeName ?? '']);
      await this.setInvitees(tx, r.rows[0].id, input.invitees);
      await this.audit.record({ actor, orgId, action: 'standup.create', outcome: 'ok', sourceIp: ip, detail: { callId: r.rows[0].id, invitees: input.invitees.length, repeat, linkSource: source, scope: input.scopeType ?? 'org' } }, tx);
      return r.rows[0];
    });
    this.metrics.inc('standup_writes_total', { action: 'create' });
    // With Calendar approved, Google emails the invitations itself (and keeps them up to date); otherwise they go from the connected Gmail.
    const invited = await this.syncCalendar(orgId, made.id);
    return { ...out(made), invitees: input.invitees, emailed: invited === null ? await this.sendInvitations(orgId, actor, made, input.invitees) : { sent: invited, total: invited } };
  }

  async update(orgId: string, actor: string, id: string, input: UpdateStandup, ip: string): Promise<StandupOut> {
    const row = await this.db.transaction(async tx => {
      if (input.invitees) await this.requireInOrg(tx, orgId, input.invitees);
      const found = await tx.query<Row>(`SELECT ${RETURNING} FROM standup_calls WHERE org_id = $1 AND id = $2 FOR UPDATE`, [orgId, id]);
      const current = found.rows[0];
      if (!current) throw new NotFoundException('Not found.');
      const repeat = input.repeat ?? current.repeat;
      const until = repeat === 'none' ? null : input.repeatUntil ?? current.repeat_until;
      if (repeat !== 'none' && !until) throw invalid('repeatUntil', 'Say on which day the repeat ends.');
      const r = await tx.query<Row>(
        `UPDATE standup_calls SET title = COALESCE($3, title), starts_at = COALESCE($4, starts_at), duration_minutes = COALESCE($5, duration_minutes),
           link = COALESCE($6, link), link_source = CASE WHEN $6::text IS NULL THEN link_source ELSE 'pasted' END, repeat = $7, repeat_until = $8::date,
           time_zone = COALESCE($9, time_zone), scope_name = COALESCE($10, scope_name), updated_at = now() WHERE org_id = $1 AND id = $2 RETURNING ${RETURNING}`,
        [orgId, id, input.title ?? null, input.startsAt ?? null, input.durationMinutes ?? null, input.link ?? null, repeat, until, input.timeZone ?? null, input.scopeName ?? null]);
      if (input.invitees) await this.setInvitees(tx, id, input.invitees);
      await this.audit.record({ actor, orgId, action: 'standup.update', outcome: 'ok', sourceIp: ip, detail: { callId: id, fields: Object.keys(input).join(',') } }, tx);
      return r.rows[0];
    });
    this.metrics.inc('standup_writes_total', { action: 'update' });
    await this.syncCalendar(orgId, id);
    const guests = await this.db.query<{ subject_type: 'user' | 'team'; subject_id: string }>('SELECT subject_type, subject_id FROM standup_invitees WHERE call_id = $1', [id]);
    return { ...out(row), invitees: guests.rows.map(g => ({ type: g.subject_type, id: g.subject_id })) };
  }

  async remove(orgId: string, actor: string, id: string, ip: string): Promise<void> {
    const eventId = await this.db.transaction(async tx => {
      const r = await tx.query<{ calendar_event_id: string | null }>('DELETE FROM standup_calls WHERE org_id = $1 AND id = $2 RETURNING calendar_event_id', [orgId, id]);
      if (r.rowCount === 0) throw new NotFoundException('Not found.');
      await this.audit.record({ actor, orgId, action: 'standup.delete', outcome: 'ok', sourceIp: ip, detail: { callId: id } }, tx);
      return r.rows[0].calendar_event_id;
    });
    this.metrics.inc('standup_writes_total', { action: 'delete' });
    if (eventId) await this.google.deleteEvent(orgId, eventId);
  }

  /**
   * Puts the call in the connected Google account's calendar, or brings its event up to date, so the invited people get a calendar
   * invitation. Resolves how many people are invited through it, or null when there is no calendar to put it in (the caller then emails).
   */
  private async syncCalendar(orgId: string, id: string): Promise<number | null> {
    const found = await this.db.query<Row & { calendar_event_id: string | null }>(`SELECT ${RETURNING}, calendar_event_id FROM standup_calls WHERE org_id = $1 AND id = $2`, [orgId, id]);
    const call = found.rows[0];
    if (!call) return null;
    const guests = await this.db.query<{ subject_type: 'user' | 'team'; subject_id: string }>('SELECT subject_type, subject_id FROM standup_invitees WHERE call_id = $1', [id]);
    const emails = await this.emailsOf(orgId, guests.rows.map(g => ({ type: g.subject_type, id: g.subject_id })), null);
    const where = call.scope_type === 'org' ? 'Stand-up' : call.scope_name || 'Call';
    const eventId = await this.google.saveEvent(orgId, call.calendar_event_id, {
      summary: call.title, description: `${where}
Join: ${call.link}

Also in Liraspaces, under Calls.`, location: call.link, startsAt: call.starts_at,
      durationMinutes: call.duration_minutes, timeZone: call.time_zone, attendees: emails, recurrence: recurrenceOf({ startsAt: call.starts_at, repeat: call.repeat, repeatUntil: call.repeat_until, timeZone: call.time_zone }),
    });
    this.metrics.inc('calendar_events_total', { outcome: eventId ? 'ok' : 'none' });
    if (!eventId) return null;
    if (eventId !== call.calendar_event_id) await this.db.query('UPDATE standup_calls SET calendar_event_id = $3 WHERE org_id = $1 AND id = $2', [orgId, id, eventId]);
    return emails.length;
  }

  /** The addresses of the people named, teams expanded, without `except` (the person who made the call) when given. */
  private async emailsOf(orgId: string, list: Invitee[], except: string | null): Promise<string[]> {
    const users = list.filter(i => i.type === 'user').map(i => i.id);
    const teams = list.filter(i => i.type === 'team').map(i => i.id);
    const rows = await this.db.query<{ email: string }>(
      `SELECT DISTINCT lower(u.email) AS email FROM users u JOIN memberships m ON m.user_id = u.id AND m.org_id = $1
        WHERE ($2::uuid IS NULL OR u.id <> $2) AND (u.id = ANY($3::uuid[]) OR u.id IN (SELECT user_id FROM team_members WHERE team_id = ANY($4::uuid[])))`, [orgId, except, users, teams]);
    return rows.rows.map(r => r.email);
  }

  /** The pasted link, or a new Meet link when none was given. Without either the call cannot be made. */
  private async resolveLink(orgId: string, pasted: string | undefined): Promise<{ link: string; source: 'pasted' | 'meet' }> {
    if (pasted) return { link: pasted, source: 'pasted' };
    const made = await this.google.createMeetLink(orgId);
    if (!made) throw invalid('link', 'Paste a Google Meet or Microsoft Teams link, or ask the owner to connect Google so the app can make the Meet link.');
    return { link: made, source: 'meet' };
  }

  /** Every person and team named must belong to this organisation. */
  private async requireInOrg(at: Queryable, orgId: string, list: Invitee[]): Promise<void> {
    const users = [...new Set(list.filter(i => i.type === 'user').map(i => i.id))];
    const teams = [...new Set(list.filter(i => i.type === 'team').map(i => i.id))];
    const foundUsers = users.length ? (await at.query('SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = ANY($2::uuid[])', [orgId, users])).rowCount : 0;
    const foundTeams = teams.length ? (await at.query('SELECT 1 FROM teams WHERE org_id = $1 AND id = ANY($2::uuid[])', [orgId, teams])).rowCount : 0;
    if (foundUsers !== users.length || foundTeams !== teams.length) throw invalid('invitees', 'Everyone invited must belong to this organisation.');
  }

  private async setInvitees(tx: Queryable, id: string, list: Invitee[]): Promise<void> {
    await tx.query('DELETE FROM standup_invitees WHERE call_id = $1', [id]);
    const unique = [...new Map(list.map(i => [`${i.type}:${i.id}`, i])).values()];
    for (const i of unique) await tx.query('INSERT INTO standup_invitees (call_id, subject_type, subject_id) VALUES ($1, $2, $3)', [id, i.type, i.id]);
  }

  /** Emails every invited person once (teams are expanded; the maker is left out). Resolves how many went out; none when no email account is connected. */
  private async sendInvitations(orgId: string, actor: string, call: Row, list: Invitee[]): Promise<{ sent: number; total: number }> {
    const addresses = await this.emailsOf(orgId, list, actor);
    const when = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: call.time_zone }).format(call.starts_at);
    const series = call.repeat === 'none' ? '' : `\nIt repeats ${REPEAT_WORDS[call.repeat]} until ${call.repeat_until}.`;
    let sent = 0;
    for (const email of addresses) {
      const ok = await this.email.send({
        orgId, to: email, subject: `${call.scope_type === 'org' ? 'Stand-up' : call.scope_name || 'Call'}: ${call.title}`,
        text: `You are invited to "${call.title}" on ${when} (${call.time_zone}), ${call.duration_minutes} minutes.${series}\n\nJoin here: ${call.link}\n\nYou can also see it in Liraspaces, under Stand-up calls and in the calendar.`,
      });
      if (ok) sent += 1;
    }
    return { sent, total: addresses.length };
  }
}

function out(r: Row): Omit<StandupOut, 'invitees'> {
  return {
    id: r.id, title: r.title, startsAt: r.starts_at.toISOString(), durationMinutes: r.duration_minutes, link: r.link, linkSource: r.link_source,
    repeat: r.repeat, repeatUntil: r.repeat_until, timeZone: r.time_zone, scopeType: r.scope_type, scopeId: r.scope_id, scopeName: r.scope_name,
  };
}
