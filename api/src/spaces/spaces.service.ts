import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { DbService, type Queryable } from '../db/db.service';
import { ChangesService } from '../realtime/changes.service';
import { MetricsService } from '../observability/metrics.service';
import type { Level } from '../access/access.service';
import type { CreateSpace, UpdateSpace } from './schemas';

export interface SpaceOut { id: number; key: string; name: string; icon: string; color: string; description: string | null; version: number; createdAt: string; updatedAt: string; myLevel: Level }

interface Row { id: string; key: string; name: string; icon: string; color: string; description: string | null; version: number; created_at: Date; updated_at: Date }

const COLUMNS = 'id, key, name, icon, color, description, version, created_at, updated_at';
/** `level` is what the calling person may do here, so the app can hide what the server would refuse. */
const out = (r: Row, level: Level): SpaceOut => ({ id: Number(r.id), key: r.key, name: r.name, icon: r.icon, color: r.color, description: r.description, version: r.version, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(), myLevel: level });

const UNIQUE_VIOLATION = '23505';

/** Spaces of one organisation. Every query carries the organisation, so one organisation can never reach another's rows. */
@Injectable()
export class SpacesService {
  constructor(@Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService, @Inject(MetricsService) private readonly metrics: MetricsService, @Inject(AttachmentsService) private readonly files: AttachmentsService, @Inject(ChangesService) private readonly changes: ChangesService) {}

  /** `levels` is what the person holds on each space they may view; 'all' means every space of the organisation, with full access. */
  async list(orgId: string, levels: 'all' | Map<string, Level>): Promise<SpaceOut[]> {
    const ids = levels === 'all' ? null : [...levels.keys()].map(Number).filter(Number.isInteger);
    const rows = ids === null
      ? await this.db.query<Row>(`SELECT ${COLUMNS} FROM spaces WHERE org_id = $1 ORDER BY name`, [orgId])
      : await this.db.query<Row>(`SELECT ${COLUMNS} FROM spaces WHERE org_id = $1 AND id = ANY($2::bigint[]) ORDER BY name`, [orgId, ids]);
    return rows.rows.map(r => out(r, levels === 'all' ? 'manage' : levels.get(r.id) ?? 'view'));
  }

  /**
   * The people a ticket of this space may be given to: the Owner and Admins, and everyone who was given the space (directly or through a team),
   * except people who may only look. Names and ids only, so that every member who can see the space can use the list.
   */
  async assignable(orgId: string, spaceId: number): Promise<{ userId: string; name: string }[]> {
    const r = await this.db.query<{ id: string; name: string }>(
      `SELECT u.id, u.name FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.org_id = $1 AND m.role <> 'viewer' AND (m.role IN ('owner', 'admin') OR EXISTS (
          SELECT 1 FROM grants g WHERE g.org_id = m.org_id AND g.object_kind = 'space' AND g.object_id = $2::text
            AND ((g.subject_type = 'user' AND g.subject_id = u.id) OR (g.subject_type = 'team' AND g.subject_id IN (SELECT team_id FROM team_members WHERE user_id = u.id)))))
        ORDER BY u.name`, [orgId, String(spaceId)]);
    return r.rows.map(x => ({ userId: x.id, name: x.name }));
  }

  async create(orgId: string, actor: string, input: CreateSpace, ip: string): Promise<SpaceOut> {
    try {
      const row = await this.db.transaction(async tx => {
        const made = await tx.query<Row>(
          `INSERT INTO spaces (org_id, key, name, icon, color, description, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
          [orgId, input.key, input.name, input.icon, input.color, input.description ?? null, actor]);
        await this.audit.record({ actor, orgId, action: 'space.create', outcome: 'ok', sourceIp: ip, detail: { spaceId: Number(made.rows[0].id), key: input.key } }, tx);
        return made.rows[0];
      });
      this.metrics.inc('space_writes_total', { action: 'create' });
      await this.changes.publish(orgId, { kind: 'space', spaceId: Number(row.id) });
      return out(row, 'manage');
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new ConflictException({ code: 'key_taken', message: 'A space with this key already exists.' });
      throw error;
    }
  }

  async update(orgId: string, id: number, actor: string, input: UpdateSpace, ip: string): Promise<SpaceOut> {
    const row = await this.db.transaction(async tx => {
      const changed = await tx.query<Row>(
        `UPDATE spaces SET name = COALESCE($4, name), icon = COALESCE($5, icon), color = COALESCE($6, color), description = COALESCE($7, description),
           version = version + 1, updated_at = now()
         WHERE org_id = $1 AND id = $2 AND version = $3 RETURNING ${COLUMNS}`,
        [orgId, id, input.version, input.name ?? null, input.icon ?? null, input.color ?? null, input.description ?? null]);
      if (!changed.rows[0]) await this.refuse(tx, orgId, id);
      await this.audit.record({ actor, orgId, action: 'space.update', outcome: 'ok', sourceIp: ip, detail: { spaceId: id, fields: Object.keys(input).filter(k => k !== 'version').join(',') } }, tx);
      return changed.rows[0];
    });
    this.metrics.inc('space_writes_total', { action: 'update' });
    await this.changes.publish(orgId, { kind: 'space', spaceId: id });
    return out(row, 'manage');
  }

  async remove(orgId: string, id: number, actor: string, version: number, ip: string): Promise<void> {
    const paths = await this.db.transaction(async tx => {
      const stored = await this.files.pathsOf(tx, orgId, { spaceId: id });
      const gone = await tx.query('DELETE FROM spaces WHERE org_id = $1 AND id = $2 AND version = $3', [orgId, id, version]);
      if (gone.rowCount === 0) await this.refuse(tx, orgId, id);
      await this.audit.record({ actor, orgId, action: 'space.delete', outcome: 'ok', sourceIp: ip, detail: { spaceId: id } }, tx);
      return stored;
    });
    await this.files.removeFiles(paths);
    this.metrics.inc('space_writes_total', { action: 'delete' });
    await this.changes.publish(orgId, { kind: 'space', spaceId: null }); // the space is gone, so nobody may be told which one
  }

  /** No row changed: either the space is not in this organisation, or someone changed it since the caller read it. */
  private async refuse(at: Queryable, orgId: string, id: number): Promise<never> {
    const exists = await at.query('SELECT 1 FROM spaces WHERE org_id = $1 AND id = $2', [orgId, id]);
    if (exists.rowCount === 0) throw new NotFoundException('Not found.');
    throw new ConflictException({ code: 'conflict', message: 'Someone changed this space since you opened it. Reload it and try again.' });
  }
}
