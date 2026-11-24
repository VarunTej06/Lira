import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import type { Me } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { DbService } from '../db/db.service';
import { MetricsService } from '../observability/metrics.service';
import { ObjectsService } from './objects.service';

export interface VoteOut { ticketId: number; userId: string; name: string; points: number }

/**
 * Points given to tickets in a story box. A person who may view the box (and the ticket's space) gives and changes only their own
 * points, while the box is open; nobody else's. The box itself, its scope, closing it and putting points on tickets stay with those who
 * may edit it. Votes are kept apart from the box so that viewing it never allows changing it.
 */
@Injectable()
export class VotesService {
  constructor(
    @Inject(DbService) private readonly db: DbService, @Inject(ObjectsService) private readonly objects: ObjectsService, @Inject(AccessService) private readonly access: AccessService,
    @Inject(AuditService) private readonly audit: AuditService, @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  async list(me: Me, orgId: string, boxId: string): Promise<VoteOut[]> {
    await this.objects.requireLevel(me, orgId, 'storybox', boxId, 'view');
    const r = await this.db.query<{ ticket_id: string; user_id: string; name: string; points: string }>(
      `SELECT v.ticket_id, v.user_id, u.name, v.points FROM story_votes v JOIN users u ON u.id = v.user_id
        WHERE v.org_id = $1 AND v.box_id = $2 ORDER BY v.ticket_id, u.name`, [orgId, boxId]);
    return r.rows.map(x => ({ ticketId: Number(x.ticket_id), userId: x.user_id, name: x.name, points: Number(x.points) }));
  }

  /** Gives, changes or (with null) takes back the person's own points for one ticket. */
  async vote(me: Me, orgId: string, boxId: string, ticketId: number, points: number | null, ip: string): Promise<void> {
    const box = await this.objects.requireLevel(me, orgId, 'storybox', boxId, 'view');
    if (box.doc.status === 'closed') throw new ConflictException({ code: 'box_closed', message: 'This story box is closed.' });
    const ticket = await this.db.query<{ space_id: string }>('SELECT space_id FROM tickets WHERE org_id = $1 AND id = $2', [orgId, ticketId]);
    const space = ticket.rows[0] ? Number(ticket.rows[0].space_id) : null;
    if (space === null || (await this.access.levelOn(me, orgId, 'space', space)) === 'none') throw new NotFoundException('Not found.'); // a ticket the person may not see is not found
    if (points === null) await this.db.query('DELETE FROM story_votes WHERE org_id = $1 AND box_id = $2 AND ticket_id = $3 AND user_id = $4', [orgId, boxId, ticketId, me.user.id]);
    else {
      await this.db.query(
        `INSERT INTO story_votes (org_id, box_id, ticket_id, user_id, points) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (org_id, box_id, ticket_id, user_id) DO UPDATE SET points = EXCLUDED.points, updated_at = now()`, [orgId, boxId, ticketId, me.user.id, points]);
    }
    await this.audit.record({ actor: me.user.id, orgId, action: 'storybox.vote', outcome: 'ok', sourceIp: ip, detail: { boxId, ticketId, cleared: points === null } });
    this.metrics.inc('story_votes_total', { cleared: String(points === null) });
  }
}
