import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { CONFIG, type Config } from '../config';
import { DbService } from '../db/db.service';
import { SYSTEM_MAILER, type SystemMailer } from '../mail/mailer';
import { logLine } from '../observability/log';
import { MetricsService } from '../observability/metrics.service';
import { startsBetween, type Repeat } from './occurrences';

/** A call reminder goes out this long before the call starts. */
export const CALL_LEAD_MINUTES = 15;
/** The reminder for a ticket due tomorrow goes out once the day has reached this hour (UTC), so it does not wake anyone at midnight. */
export const DUE_FROM_HOUR_UTC = 7;
const EVERY_MS = 60_000;

export interface ReminderPrefs { calls: boolean; due: boolean }

interface CallRow { id: string; org_id: string; title: string; starts_at: Date; link: string; repeat: Repeat; repeat_until: string | null; time_zone: string }
interface Recipient { id: string; email: string; name: string }
const clean = (value: string) => value.replace(/[\r\n]+/g, ' ');

/**
 * Reminders by email: a call is about to start, and a ticket is due tomorrow. A reminder is claimed by inserting its row in
 * `reminders_sent` before it is sent, so two copies of the API or a restart never send one twice; a send that fails gives its claim
 * back, and the next minute tries again while the reminder is still due. Each person can switch each kind off. Nothing runs
 * unless the product's email service is set up.
 */
@Injectable()
export class RemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(DbService) private readonly db: DbService, @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(CONFIG) private readonly config: Config, @Inject(SYSTEM_MAILER) private readonly mailer: SystemMailer,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.mail || !this.config.reminders) return; // the real email service only: a test double never starts a clock
    this.timer = setInterval(() => { void this.runOnce().catch(error => logLine('error', 'reminders run failed', { reason: error instanceof Error ? error.name : 'unknown' })); }, EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void { clearInterval(this.timer); }

  /** Whether the server can send reminders at all, so the page does not offer switches that do nothing. */
  get available(): boolean { return this.mailer.enabled; }

  async prefs(userId: string): Promise<ReminderPrefs> {
    const r = await this.db.query<ReminderPrefs>('SELECT calls, due FROM reminder_prefs WHERE user_id = $1', [userId]);
    return r.rows[0] ?? { calls: true, due: true };
  }

  async setPrefs(userId: string, changes: Partial<ReminderPrefs>): Promise<ReminderPrefs> {
    const r = await this.db.query<ReminderPrefs>(
      `INSERT INTO reminder_prefs (user_id, calls, due) VALUES ($1, COALESCE($2, true), COALESCE($3, true))
       ON CONFLICT (user_id) DO UPDATE SET calls = COALESCE($2, reminder_prefs.calls), due = COALESCE($3, reminder_prefs.due) RETURNING calls, due`,
      [userId, changes.calls ?? null, changes.due ?? null]);
    return r.rows[0];
  }

  /** One pass at `now`: the reminders that are due. Returns how many were sent. */
  async runOnce(now: Date = new Date()): Promise<number> {
    if (!this.mailer.enabled) return 0;
    const sent = (await this.callReminders(now)) + (await this.dueReminders(now));
    await this.db.query("DELETE FROM reminders_sent WHERE sent_at < now() - interval '3 days'");
    return sent;
  }

  private async callReminders(now: Date): Promise<number> {
    const to = new Date(now.getTime() + CALL_LEAD_MINUTES * 60_000);
    const calls = await this.db.query<CallRow>(
      `SELECT id, org_id, title, starts_at, link, repeat, to_char(repeat_until, 'YYYY-MM-DD') AS repeat_until, time_zone FROM standup_calls
        WHERE (repeat = 'none' AND starts_at > $1 AND starts_at <= $2)
           OR (repeat <> 'none' AND starts_at <= $2 + interval '1 day' AND (repeat_until IS NULL OR repeat_until >= ($1::timestamptz - interval '2 days')::date))`, [now, to]);
    let count = 0;
    for (const call of calls.rows) {
      const starts = startsBetween({ startsAt: call.starts_at, repeat: call.repeat, repeatUntil: call.repeat_until, timeZone: call.time_zone }, now, to);
      for (const start of starts) {
        const when = new Intl.DateTimeFormat('en-GB', { timeZone: call.time_zone, dateStyle: 'full', timeStyle: 'short' }).format(start);
        for (const person of await this.callRecipients(call.id)) {
          count += await this.send('call', `${call.id}:${start.toISOString()}`, person, {
            subject: `Reminder: ${clean(call.title)} starts in ${CALL_LEAD_MINUTES} minutes`,
            text: `Hi ${clean(person.name)},\n\n"${clean(call.title)}" starts at ${when} (${call.time_zone}).\nJoin: ${call.link}\n\nYou can switch these reminders off in Liraspaces, on the Calls page.\n`,
          });
        }
      }
    }
    return count;
  }

  /** The people invited to the call, directly or through a team, who have not switched call reminders off. */
  private async callRecipients(callId: string): Promise<Recipient[]> {
    const r = await this.db.query<Recipient>(
      `SELECT DISTINCT u.id, u.email, u.name FROM users u
         LEFT JOIN reminder_prefs p ON p.user_id = u.id
        WHERE COALESCE(p.calls, true)
          AND (u.id IN (SELECT subject_id FROM standup_invitees WHERE call_id = $1 AND subject_type = 'user')
            OR u.id IN (SELECT tm.user_id FROM team_members tm JOIN standup_invitees i ON i.subject_type = 'team' AND i.subject_id = tm.team_id WHERE i.call_id = $1))`, [callId]);
    return r.rows;
  }

  private async dueReminders(now: Date): Promise<number> {
    if (now.getUTCHours() < DUE_FROM_HOUR_UTC) return 0;
    const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
    const tickets = await this.db.query<{ id: string; org_id: string; space_id: string; key: string; title: string; assignee: string }>(
      `SELECT id, org_id, space_id, key, title, assignee FROM tickets
        WHERE assignee IS NOT NULL AND status <> 'done' AND type <> 'epic'
          AND doc->>'dueDate' ~ '^\\d{4}-\\d{2}-\\d{2}' AND substring(doc->>'dueDate' FROM 1 FOR 10) = $1`, [tomorrow]);
    let count = 0;
    for (const t of tickets.rows) {
      const person = await this.assigneeOf(t.org_id, t.assignee, t.space_id);
      if (person) {
        count += await this.send('due', `${t.id}:${tomorrow}`, person, {
          subject: `Due tomorrow: ${t.key}`,
          text: `Hi ${clean(person.name)},\n\n${t.key} "${clean(t.title)}" is due tomorrow (${tomorrow}).\nOpen Liraspaces to see it.\n\nYou can switch these reminders off in Liraspaces, on the Calls page.\n`,
        });
      }
    }
    return count;
  }

  /**
   * The member a ticket's assignee name stands for: only when exactly one member of the organisation has that name, who has not switched
   * due reminders off, and may see the ticket's space. A name that is not clearly one person gets no email rather than a wrong one.
   */
  private async assigneeOf(orgId: string, name: string, spaceId: string): Promise<Recipient | null> {
    const r = await this.db.query<Recipient>(
      `SELECT u.id, u.email, u.name FROM memberships m JOIN users u ON u.id = m.user_id LEFT JOIN reminder_prefs p ON p.user_id = u.id
        WHERE m.org_id = $1 AND u.name = $2 AND COALESCE(p.due, true)
          AND (m.role IN ('owner', 'admin') OR EXISTS (SELECT 1 FROM grants g WHERE g.org_id = m.org_id AND g.object_kind = 'space' AND g.object_id = $3
                AND ((g.subject_type = 'user' AND g.subject_id = u.id) OR (g.subject_type = 'team' AND g.subject_id IN (SELECT team_id FROM team_members WHERE user_id = u.id)))))`,
      [orgId, name, spaceId]);
    const same = await this.db.query<{ n: string }>('SELECT count(*) AS n FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 AND u.name = $2', [orgId, name]);
    return Number(same.rows[0].n) === 1 && r.rows.length === 1 ? r.rows[0] : null;
  }

  /** Claims the reminder, sends it, and gives the claim back when the email service refuses. 1 when sent. */
  private async send(kind: 'call' | 'due', key: string, person: Recipient, mail: { subject: string; text: string }): Promise<number> {
    const claim = await this.db.query('INSERT INTO reminders_sent (kind, key, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1', [kind, key, person.id]);
    if (claim.rowCount === 0) return 0;
    const ok = await this.mailer.send({ to: person.email, ...mail });
    this.metrics.inc('reminders_total', { kind, outcome: ok ? 'sent' : 'failed' });
    if (!ok) await this.db.query('DELETE FROM reminders_sent WHERE kind = $1 AND key = $2 AND user_id = $3', [kind, key, person.id]);
    return ok ? 1 : 0;
  }
}
