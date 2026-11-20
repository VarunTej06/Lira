import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { DbService, type Queryable } from '../db/db.service';
import { MetricsService } from '../observability/metrics.service';
import type { CreateSpace, UpdateSpace } from './schemas';

export interface SpaceOut { id: number; key: string; name: string; icon: string; color: string; description: string | null; version: number; createdAt: string; updatedAt: string }

interface Row { id: string; key: string; name: string; icon: string; color: string; description: string | null; version: number; created_at: Date; updated_at: Date }

const COLUMNS = 'id, key, name, icon, color, description, version, created_at, updated_at';
const out = (r: Row): SpaceOut => ({ id: Number(r.id), key: r.key, name: r.name, icon: r.icon, color: r.color, description: r.description, version: r.version, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString() });

const UNIQUE_VIOLATION = '23505';

/** Spaces of one organisation. Every query carries the organisation, so one organisation can never reach another's rows. */
@Injectable()
export class SpacesService {
  constructor(@Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService, @Inject(MetricsService) private readonly metrics: MetricsService, @Inject(AttachmentsService) private readonly files: AttachmentsService) {}

  /** `ids` limits the list to the spaces a person may view; null means every space of the organisation. */
  async list(orgId: string, ids: number[] | null): Promise<SpaceOut[]> {
    const rows = ids === null
      ? await this.db.query<Row>(`SELECT ${COLUMNS} FROM spaces WHERE org_id = $1 ORDER BY name`, [orgId])
      : await this.db.query<Row>(`SELECT ${COLUMNS} FROM spaces WHERE org_id = $1 AND id = ANY($2::bigint[]) ORDER BY name`, [orgId, ids]);
    return rows.rows.map(out);
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
      return out(row);
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
    return out(row);
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
  }

  /** No row changed: either the space is not in this organisation, or someone changed it since the caller read it. */
  private async refuse(at: Queryable, orgId: string, id: number): Promise<never> {
    const exists = await at.query('SELECT 1 FROM spaces WHERE org_id = $1 AND id = $2', [orgId, id]);
    if (exists.rowCount === 0) throw new NotFoundException('Not found.');
    throw new ConflictException({ code: 'conflict', message: 'Someone changed this space since you opened it. Reload it and try again.' });
  }
}
