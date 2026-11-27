import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { DbService, type Queryable } from '../db/db.service';
import { ChangesService } from '../realtime/changes.service';
import { MetricsService } from '../observability/metrics.service';
import { COLUMN_FIELDS, type CreateTicket, type UpdateTicket } from './schemas';

export type TicketOut = Record<string, unknown> & { id: number; key: string; spaceId: number; version: number };

interface Row {
  id: string; space_id: string; key: string; parent_id: string | null; epic_id: string | null; type: string; status: string; priority: string;
  title: string; assignee: string | null; rank: number; doc: Record<string, unknown>; version: number; created_at: Date; updated_at: Date;
}

const COLUMNS = 'id, space_id, key, parent_id, epic_id, type, status, priority, title, assignee, rank, doc, version, created_at, updated_at';
/** The names of the columns, fixed here: a request chooses which fields to send, never which column they land in. */
const COLUMN_OF = { parentId: 'parent_id', epicId: 'epic_id', title: 'title', type: 'type', status: 'status', priority: 'priority', assignee: 'assignee', rank: 'rank' } as const;
const isColumnField = (name: string): name is (typeof COLUMN_FIELDS)[number] => name in COLUMN_OF;

const num = (v: string | null) => (v === null ? undefined : Number(v));
/** The document first, the columns after it, so nothing in the document can pose as an id, a key or a version. */
const out = (r: Row): TicketOut => ({
  ...r.doc, id: Number(r.id), key: r.key, spaceId: Number(r.space_id), parentId: num(r.parent_id), epicId: num(r.epic_id), type: r.type, status: r.status,
  priority: r.priority, title: r.title, assignee: r.assignee ?? undefined, rank: r.rank, version: r.version, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
});

/** Tickets of one organisation. Every query carries the organisation, so one organisation can never reach another's tickets. */
@Injectable()
export class TicketsService {
  constructor(@Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService, @Inject(MetricsService) private readonly metrics: MetricsService, @Inject(AttachmentsService) private readonly files: AttachmentsService, @Inject(ChangesService) private readonly changes: ChangesService) {}

  async list(orgId: string, spaceId: number): Promise<TicketOut[]> {
    if ((await this.db.query('SELECT 1 FROM spaces WHERE org_id = $1 AND id = $2', [orgId, spaceId])).rowCount === 0) throw new NotFoundException('Not found.');
    const rows = await this.db.query<Row>(`SELECT ${COLUMNS} FROM tickets WHERE org_id = $1 AND space_id = $2 ORDER BY rank, id`, [orgId, spaceId]);
    return rows.rows.map(out);
  }

  /** The space a ticket is in, for deciding access. A ticket of another organisation is "not found". */
  async spaceIdOf(orgId: string, id: number): Promise<number> {
    const rows = await this.db.query<{ space_id: string }>('SELECT space_id FROM tickets WHERE org_id = $1 AND id = $2', [orgId, id]);
    if (!rows.rows[0]) throw new NotFoundException('Not found.');
    return Number(rows.rows[0].space_id);
  }

  async get(orgId: string, id: number): Promise<TicketOut> {
    const rows = await this.db.query<Row>(`SELECT ${COLUMNS} FROM tickets WHERE org_id = $1 AND id = $2`, [orgId, id]);
    if (!rows.rows[0]) throw new NotFoundException('Not found.');
    return out(rows.rows[0]);
  }

  async create(orgId: string, spaceId: number, actor: string, input: CreateTicket, ip: string): Promise<TicketOut> {
    const row = await this.db.transaction(async tx => {
      const counter = await tx.query<{ key: string; n: number }>(
        'UPDATE spaces SET next_ticket_no = next_ticket_no + 1 WHERE org_id = $1 AND id = $2 RETURNING key, next_ticket_no - 1 AS n', [orgId, spaceId]);
      if (!counter.rows[0]) throw new NotFoundException('Not found.');
      await this.requireInSpace(tx, orgId, spaceId, [input.parentId, input.epicId]);
      const { columns, doc } = split(input);
      const made = await tx.query<Row>(
        `INSERT INTO tickets (org_id, space_id, key, parent_id, epic_id, type, status, priority, title, assignee, rank, doc, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13) RETURNING ${COLUMNS}`,
        [orgId, spaceId, `${counter.rows[0].key}-${counter.rows[0].n}`, columns.parentId ?? null, columns.epicId ?? null, input.type, input.status, input.priority, input.title,
          input.assignee ?? null, input.rank, JSON.stringify(doc), actor]);
      await this.audit.record({ actor, orgId, action: 'ticket.create', outcome: 'ok', sourceIp: ip, detail: { ticketId: Number(made.rows[0].id), key: made.rows[0].key } }, tx);
      return made.rows[0];
    });
    this.metrics.inc('ticket_writes_total', { action: 'create' });
    await this.changes.publish(orgId, { kind: 'ticket', spaceId });
    return out(row);
  }

  async update(orgId: string, id: number, actor: string, input: UpdateTicket, ip: string): Promise<TicketOut> {
    const row = await this.db.transaction(async tx => {
      const { version, ...changes } = input;
      const current = await tx.query<{ space_id: string }>('SELECT space_id FROM tickets WHERE org_id = $1 AND id = $2', [orgId, id]);
      if (!current.rows[0]) throw new NotFoundException('Not found.');
      await this.requireInSpace(tx, orgId, Number(current.rows[0].space_id), [changes.parentId, changes.epicId].filter((v): v is number => typeof v === 'number'), id);
      const { columns, doc } = split(changes);
      const sets: string[] = []; const params: unknown[] = [orgId, id, version];
      for (const [name, value] of Object.entries(columns)) { params.push(value); sets.push(`${COLUMN_OF[name as keyof typeof COLUMN_OF]} = $${params.length}`); }
      params.push(JSON.stringify(doc)); sets.push(`doc = jsonb_strip_nulls(doc || $${params.length}::jsonb)`);
      const changed = await tx.query<Row>(
        `UPDATE tickets SET ${sets.join(', ')}, version = version + 1, updated_at = now() WHERE org_id = $1 AND id = $2 AND version = $3 RETURNING ${COLUMNS}`, params);
      if (!changed.rows[0]) throw new ConflictException({ code: 'conflict', message: 'Someone changed this ticket since you opened it. Reload it and try again.' });
      await this.audit.record({ actor, orgId, action: 'ticket.update', outcome: 'ok', sourceIp: ip, detail: { ticketId: id, fields: Object.keys(changes).join(',') } }, tx);
      return changed.rows[0];
    });
    this.metrics.inc('ticket_writes_total', { action: 'update' });
    await this.changes.publish(orgId, { kind: 'ticket', spaceId: Number(row.space_id) });
    return out(row);
  }

  async remove(orgId: string, id: number, actor: string, version: number, ip: string): Promise<void> {
    let spaceId: number | null = null;
    const paths = await this.db.transaction(async tx => {
      const stored = await this.files.pathsOf(tx, orgId, { ticketId: id });
      spaceId = Number((await tx.query<{ space_id: string }>('SELECT space_id FROM tickets WHERE org_id = $1 AND id = $2', [orgId, id])).rows[0]?.space_id ?? NaN) || null;
      const gone = await tx.query('DELETE FROM tickets WHERE org_id = $1 AND id = $2 AND version = $3', [orgId, id, version]);
      if (gone.rowCount === 0) {
        if ((await tx.query('SELECT 1 FROM tickets WHERE org_id = $1 AND id = $2', [orgId, id])).rowCount === 0) throw new NotFoundException('Not found.');
        throw new ConflictException({ code: 'conflict', message: 'Someone changed this ticket since you opened it. Reload it and try again.' });
      }
      await this.audit.record({ actor, orgId, action: 'ticket.delete', outcome: 'ok', sourceIp: ip, detail: { ticketId: id } }, tx);
      return stored;
    });
    await this.files.removeFiles(paths);
    this.metrics.inc('ticket_writes_total', { action: 'delete' });
    await this.changes.publish(orgId, { kind: 'ticket', spaceId });
  }

  /** A parent or an epic must be a ticket of the same space (and so of the same organisation), and never the ticket itself. */
  private async requireInSpace(at: Queryable, orgId: string, spaceId: number, ids: (number | undefined)[], self?: number): Promise<void> {
    const wanted = [...new Set(ids.filter((v): v is number => typeof v === 'number'))];
    if (wanted.length === 0) return;
    if (self !== undefined && wanted.includes(self)) throw new BadRequestException({ code: 'invalid_input', message: 'A ticket cannot be its own parent.', fields: { parentId: 'A ticket cannot be its own parent.' } });
    const found = await at.query('SELECT 1 FROM tickets WHERE org_id = $1 AND space_id = $2 AND id = ANY($3::bigint[])', [orgId, spaceId, wanted]);
    if (found.rowCount !== wanted.length) throw new BadRequestException({ code: 'invalid_input', message: 'The parent or epic is not a ticket of this space.', fields: { parentId: 'Not a ticket of this space.' } });
  }
}

/** Splits the fields of a request into the ones that are columns and the ones that go in the document. */
function split(input: Record<string, unknown>): { columns: Record<string, unknown>; doc: Record<string, unknown> } {
  const columns: Record<string, unknown> = {}; const doc: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (isColumnField(name)) columns[name] = value; else doc[name] = value;
  }
  return { columns, doc };
}
