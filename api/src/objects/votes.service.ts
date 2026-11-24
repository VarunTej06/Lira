import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import type { Me } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { DbService } from '../db/db.service';
import { MetricsService } from '../observability/metrics.service';
import { ChangesService } from '../realtime/changes.service';
import { ObjectsService } from './objects.service';
import { minutesOf, phaseOf, type Phase } from './rounds';

export interface VoteOut { ticketId: number; userId: string; name: string; points: number; mine: boolean }
export interface RoundOut { ticketId: number; phase: Phase; startedAt: string; endsAt: string; revealedAt: string | null; finalPoints: number | null; voted: number }
export interface PersonOut { userId: string; name: string; role: string; voted: boolean; votedAt: string | null }
export interface RoomOut { now: string; rounds: RoundOut[]; votes: VoteOut[]; people: PersonOut[]; activeTicketId: number | null }

interface RoundRow { ticket_id: string; started_at: Date; ends_at: Date; revealed_at: Date | null; confirmed_at: Date | null; final_points: string | null; voted: string }
interface Times { ends_at: Date; revealed_at: Date | null; confirmed_at: Date | null }

/**
 * Planning poker in a story box. The people who run the box put one ticket at a time in front of everyone for the minutes the box
 * allows. Everyone who may view the box gives or changes only their own points until the time is up; others' points stay hidden (the
 * server never sends them) until someone who runs the box reveals them, and then the final points are confirmed. Votes and rounds are
 * rows of their own, so viewing a box never allows changing it.
 */
@Injectable()
export class VotesService {
  constructor(
    @Inject(DbService) private readonly db: DbService, @Inject(ObjectsService) private readonly objects: ObjectsService, @Inject(AccessService) private readonly access: AccessService,
    @Inject(AuditService) private readonly audit: AuditService, @Inject(MetricsService) private readonly metrics: MetricsService, @Inject(ChangesService) private readonly changes: ChangesService,
  ) {}

  /** Everything the room shows: rounds, the points that may be seen (everyone's once revealed, otherwise only your own), and who is taking part. */
  async room(me: Me, orgId: string, boxId: string): Promise<RoomOut> {
    const box = await this.objects.requireLevel(me, orgId, 'storybox', boxId, 'view');
    const now = new Date();
    const rounds = await this.db.query<RoundRow>(
      `SELECT r.ticket_id, r.started_at, r.ends_at, r.revealed_at, r.confirmed_at, r.final_points,
              (SELECT count(*) FROM story_votes v WHERE v.org_id = r.org_id AND v.box_id = r.box_id AND v.ticket_id = r.ticket_id) AS voted
         FROM story_rounds r WHERE r.org_id = $1 AND r.box_id = $2 ORDER BY r.started_at`, [orgId, boxId]);
    const out: RoundOut[] = rounds.rows.map(r => ({
      ticketId: Number(r.ticket_id), phase: phaseOf({ endsAt: r.ends_at, revealedAt: r.revealed_at, confirmedAt: r.confirmed_at }, now), startedAt: r.started_at.toISOString(),
      endsAt: r.ends_at.toISOString(), revealedAt: r.revealed_at?.toISOString() ?? null, finalPoints: r.final_points === null ? null : Number(r.final_points), voted: Number(r.voted),
    }));
    const active = out.find(r => r.phase !== 'confirmed') ?? null;
    return { now: now.toISOString(), rounds: out, votes: await this.visibleVotes(me, orgId, boxId, out), people: active ? await this.people(orgId, boxId, box.doc, active.ticketId) : [], activeTicketId: active?.ticketId ?? null };
  }

  /** Points of tickets that were revealed (or that never had a round, from before rounds existed), and the person's own for the rest. */
  private async visibleVotes(me: Me, orgId: string, boxId: string, rounds: RoundOut[]): Promise<VoteOut[]> {
    const hidden = rounds.filter(r => r.phase === 'voting' || r.phase === 'timeup').map(r => r.ticketId);
    const r = await this.db.query<{ ticket_id: string; user_id: string; name: string; points: string }>(
      `SELECT v.ticket_id, v.user_id, u.name, v.points FROM story_votes v JOIN users u ON u.id = v.user_id
        WHERE v.org_id = $1 AND v.box_id = $2 AND (v.user_id = $3 OR v.ticket_id <> ALL($4::bigint[])) ORDER BY v.ticket_id, u.name`, [orgId, boxId, me.user.id, hidden]);
    return r.rows.map(x => ({ ticketId: Number(x.ticket_id), userId: x.user_id, name: x.name, points: Number(x.points), mine: x.user_id === me.user.id }));
  }

  /** Who may take part (the Owner and Admins, and whoever was given the space or the box), and whether each has given points for the ticket. */
  private async people(orgId: string, boxId: string, doc: Record<string, unknown>, ticketId: number): Promise<PersonOut[]> {
    const scope = doc.scope as { type?: string; spaceId?: number } | undefined;
    const spaceId = scope?.type === 'space' && Number.isInteger(scope.spaceId) ? String(scope.spaceId) : null;
    const r = await this.db.query<{ id: string; name: string; role: string; updated_at: Date | null }>(
      `SELECT u.id, u.name, m.role, v.updated_at FROM memberships m JOIN users u ON u.id = m.user_id
         LEFT JOIN story_votes v ON v.org_id = m.org_id AND v.box_id = $2 AND v.ticket_id = $3 AND v.user_id = u.id
        WHERE m.org_id = $1 AND (m.role IN ('owner', 'admin') OR EXISTS (
          SELECT 1 FROM grants g WHERE g.org_id = m.org_id
            AND ((g.object_kind = 'storybox' AND g.object_id = $2) OR (g.object_kind = 'space' AND ($4::text IS NULL OR g.object_id = $4)))
            AND ((g.subject_type = 'user' AND g.subject_id = u.id) OR (g.subject_type = 'team' AND g.subject_id IN (SELECT team_id FROM team_members WHERE user_id = u.id)))))
        ORDER BY u.name`, [orgId, boxId, ticketId, spaceId]);
    return r.rows.map(x => ({ userId: x.id, name: x.name, role: x.role, voted: x.updated_at !== null, votedAt: x.updated_at?.toISOString() ?? null }));
  }

  /** Puts a ticket in front of everyone for the box's minutes. Only one ticket at a time; a ticket sized before can be put up again. */
  async start(me: Me, orgId: string, boxId: string, ticketId: number, ip: string): Promise<void> {
    const box = await this.objects.requireLevel(me, orgId, 'storybox', boxId, 'edit');
    this.requireOpen(box.doc);
    await this.requireTicket(me, orgId, ticketId);
    const busy = await this.db.query('SELECT 1 FROM story_rounds WHERE org_id = $1 AND box_id = $2 AND ticket_id <> $3 AND confirmed_at IS NULL', [orgId, boxId, ticketId]);
    if (busy.rowCount) throw new ConflictException({ code: 'round_active', message: 'Another ticket is being voted on. Finish it first.' });
    await this.restart(orgId, boxId, ticketId, me.user.id, minutesOf(box.doc));
    await this.done(me, orgId, boxId, ticketId, 'start', ip);
  }

  /** Clears the points and starts the clock again, so the same people can give new ones. */
  async revote(me: Me, orgId: string, boxId: string, ticketId: number, ip: string): Promise<void> {
    const box = await this.objects.requireLevel(me, orgId, 'storybox', boxId, 'edit');
    this.requireOpen(box.doc);
    const r = await this.round(orgId, boxId, ticketId);
    if (r.confirmed_at) throw new ConflictException({ code: 'round_done', message: 'This ticket was already sized.' });
    await this.restart(orgId, boxId, ticketId, me.user.id, minutesOf(box.doc));
    await this.done(me, orgId, boxId, ticketId, 'revote', ip);
  }

  async reveal(me: Me, orgId: string, boxId: string, ticketId: number, ip: string): Promise<void> {
    await this.objects.requireLevel(me, orgId, 'storybox', boxId, 'edit');
    const r = await this.round(orgId, boxId, ticketId);
    if (r.confirmed_at) throw new ConflictException({ code: 'round_done', message: 'This ticket was already sized.' });
    await this.db.query('UPDATE story_rounds SET revealed_at = COALESCE(revealed_at, now()) WHERE org_id = $1 AND box_id = $2 AND ticket_id = $3', [orgId, boxId, ticketId]);
    await this.done(me, orgId, boxId, ticketId, 'reveal', ip);
  }

  /** Confirms the final points of a revealed ticket. The ticket itself is changed by the person who confirms, through the usual ticket write. */
  async confirm(me: Me, orgId: string, boxId: string, ticketId: number, points: number, ip: string): Promise<void> {
    await this.objects.requireLevel(me, orgId, 'storybox', boxId, 'edit');
    const r = await this.round(orgId, boxId, ticketId);
    if (!r.revealed_at) throw new ConflictException({ code: 'not_revealed', message: 'Reveal the points before confirming.' });
    if (r.confirmed_at) throw new ConflictException({ code: 'round_done', message: 'This ticket was already sized.' });
    await this.db.query('UPDATE story_rounds SET final_points = $4, confirmed_by = $5, confirmed_at = now() WHERE org_id = $1 AND box_id = $2 AND ticket_id = $3', [orgId, boxId, ticketId, points, me.user.id]);
    await this.done(me, orgId, boxId, ticketId, 'confirm', ip);
  }

  /** Gives, changes or (with null) takes back the person's own points for the ticket being voted on, until the time is up. */
  async vote(me: Me, orgId: string, boxId: string, ticketId: number, points: number | null, ip: string): Promise<void> {
    const box = await this.objects.requireLevel(me, orgId, 'storybox', boxId, 'view');
    this.requireOpen(box.doc);
    await this.requireTicket(me, orgId, ticketId);
    const r = await this.round(orgId, boxId, ticketId);
    if (phaseOf({ endsAt: r.ends_at, revealedAt: r.revealed_at, confirmedAt: r.confirmed_at }, new Date()) !== 'voting') throw new ConflictException({ code: 'voting_closed', message: 'Voting on this ticket has ended.' });
    if (points === null) await this.db.query('DELETE FROM story_votes WHERE org_id = $1 AND box_id = $2 AND ticket_id = $3 AND user_id = $4', [orgId, boxId, ticketId, me.user.id]);
    else {
      await this.db.query(
        `INSERT INTO story_votes (org_id, box_id, ticket_id, user_id, points) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (org_id, box_id, ticket_id, user_id) DO UPDATE SET points = EXCLUDED.points, updated_at = now()`, [orgId, boxId, ticketId, me.user.id, points]);
    }
    await this.audit.record({ actor: me.user.id, orgId, action: 'storybox.vote', outcome: 'ok', sourceIp: ip, detail: { boxId, ticketId, cleared: points === null } });
    this.metrics.inc('story_votes_total', { cleared: String(points === null) });
    await this.changes.publish(orgId, { kind: 'object', spaceId: null });
  }

  private requireOpen(doc: Record<string, unknown>): void {
    if (doc.status === 'closed') throw new ConflictException({ code: 'box_closed', message: 'This story box is closed.' });
  }

  /** A ticket the person may not see is not found, so a ticket's existence is never confirmed to them. */
  private async requireTicket(me: Me, orgId: string, ticketId: number): Promise<void> {
    const ticket = await this.db.query<{ space_id: string }>('SELECT space_id FROM tickets WHERE org_id = $1 AND id = $2', [orgId, ticketId]);
    const space = ticket.rows[0] ? Number(ticket.rows[0].space_id) : null;
    if (space === null || (await this.access.levelOn(me, orgId, 'space', space)) === 'none') throw new NotFoundException('Not found.');
  }

  private async round(orgId: string, boxId: string, ticketId: number): Promise<Times> {
    const r = await this.db.query<Times>('SELECT ends_at, revealed_at, confirmed_at FROM story_rounds WHERE org_id = $1 AND box_id = $2 AND ticket_id = $3', [orgId, boxId, ticketId]);
    if (!r.rows[0]) throw new ConflictException({ code: 'no_round', message: 'This ticket is not being voted on.' });
    return r.rows[0];
  }

  private async restart(orgId: string, boxId: string, ticketId: number, by: string, minutes: number): Promise<void> {
    await this.db.transaction(async tx => {
      await tx.query('DELETE FROM story_votes WHERE org_id = $1 AND box_id = $2 AND ticket_id = $3', [orgId, boxId, ticketId]);
      await tx.query(
        `INSERT INTO story_rounds (org_id, box_id, ticket_id, started_by, ends_at) VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))
         ON CONFLICT (org_id, box_id, ticket_id) DO UPDATE SET started_by = EXCLUDED.started_by, started_at = now(), ends_at = EXCLUDED.ends_at, revealed_at = NULL, final_points = NULL, confirmed_by = NULL, confirmed_at = NULL`,
        [orgId, boxId, ticketId, by, minutes]);
    });
  }

  private async done(me: Me, orgId: string, boxId: string, ticketId: number, action: string, ip: string): Promise<void> {
    await this.audit.record({ actor: me.user.id, orgId, action: `storybox.${action}`, outcome: 'ok', sourceIp: ip, detail: { boxId, ticketId } });
    this.metrics.inc('story_rounds_total', { action });
    await this.changes.publish(orgId, { kind: 'object', spaceId: null });
  }
}
