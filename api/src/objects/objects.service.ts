import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccessService, atLeast, higher, isAdminRole, type Level } from '../access/access.service';
import type { Me } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { DbService } from '../db/db.service';
import { MetricsService } from '../observability/metrics.service';

export type ObjectType = 'project' | 'roadmap' | 'dashboard';
export interface ObjectOut { id: string; position: number; doc: Record<string, unknown>; version: number; level: Level }

interface Row { id: string; position: number; doc: Record<string, unknown>; version: number; created_by: string | null }

const COLUMNS = 'id, position, doc, version, created_by';

/**
 * Projects, roadmaps and dashboards (ADR-0010). Access follows the grants on each one. The person who made a dashboard always
 * has full access to it, so a dashboard is personal until it is shared. Making a project or roadmap is for Owner and Admin;
 * making a dashboard is for anyone who is not a Viewer or Guest.
 */
@Injectable()
export class ObjectsService {
  constructor(
    @Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MetricsService) private readonly metrics: MetricsService, @Inject(AccessService) private readonly access: AccessService,
  ) {}

  /** What the person has on one object: their grants, and full access to a dashboard they made. */
  private async level(me: Me, orgId: string, kind: ObjectType, row: Pick<Row, 'id' | 'created_by'>): Promise<Level> {
    const granted = await this.access.levelOn(me, orgId, kind, row.id);
    return kind === 'dashboard' && row.created_by === me.user.id ? higher(granted, 'manage') : granted;
  }

  async list(me: Me, orgId: string, kind: ObjectType): Promise<ObjectOut[]> {
    const visible = await this.access.visible(me, orgId, kind);
    const rows = await this.db.query<Row>(`SELECT ${COLUMNS} FROM objects WHERE org_id = $1 AND kind = $2 ORDER BY position, created_at, id`, [orgId, kind]);
    const out: ObjectOut[] = [];
    for (const r of rows.rows) {
      const own = kind === 'dashboard' && r.created_by === me.user.id;
      const level: Level = visible === 'all' || own ? 'manage' : visible.get(r.id) ?? 'none';
      if (level !== 'none') out.push({ id: r.id, position: r.position, doc: r.doc, version: r.version, level });
    }
    return out;
  }

  /** Creates the object when there is none (the body carries no version), otherwise changes it with the version the caller saw. */
  async save(me: Me, orgId: string, kind: ObjectType, id: string, input: { doc: Record<string, unknown>; version?: number; position?: number }, ip: string): Promise<ObjectOut> {
    const role = this.access.role(me, orgId);
    const saved = await this.db.transaction(async tx => {
      const found = await tx.query<Row>(`SELECT ${COLUMNS} FROM objects WHERE org_id = $1 AND kind = $2 AND id = $3 FOR UPDATE`, [orgId, kind, id]);
      const current = found.rows[0];
      if (!current) {
        if (input.version !== undefined) throw new NotFoundException('Not found.');
        const mayCreate = kind === 'dashboard' ? role !== 'viewer' && role !== 'guest' : isAdminRole(role);
        if (!mayCreate) throw new ForbiddenException('You do not have access to this.');
        const made = await tx.query<Row>(
          `INSERT INTO objects (org_id, kind, id, position, doc, created_by) VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING ${COLUMNS}`,
          [orgId, kind, id, input.position ?? 0, JSON.stringify(input.doc), me.user.id]);
        await this.audit.record({ actor: me.user.id, orgId, action: `${kind}.create`, outcome: 'ok', sourceIp: ip, detail: { objectId: id } }, tx);
        return made.rows[0];
      }
      const level = await this.level(me, orgId, kind, current);
      if (level === 'none') throw new NotFoundException('Not found.');
      if (!atLeast(level, 'edit')) throw new ForbiddenException('You do not have access to this.');
      if (input.version !== current.version) throw new ConflictException({ code: 'conflict', message: 'Someone changed this since you opened it. Reload it and try again.' });
      const changed = await tx.query<Row>(
        `UPDATE objects SET doc = $4::jsonb, position = COALESCE($5, position), version = version + 1, updated_at = now() WHERE org_id = $1 AND kind = $2 AND id = $3 RETURNING ${COLUMNS}`,
        [orgId, kind, id, JSON.stringify(input.doc), input.position ?? null]);
      await this.audit.record({ actor: me.user.id, orgId, action: `${kind}.update`, outcome: 'ok', sourceIp: ip, detail: { objectId: id } }, tx);
      return changed.rows[0];
    });
    this.metrics.inc('object_writes_total', { kind });
    return { id: saved.id, position: saved.position, doc: saved.doc, version: saved.version, level: await this.level(me, orgId, kind, saved) };
  }

  async remove(me: Me, orgId: string, kind: ObjectType, id: string, version: number, ip: string): Promise<void> {
    await this.db.transaction(async tx => {
      const found = await tx.query<Row>(`SELECT ${COLUMNS} FROM objects WHERE org_id = $1 AND kind = $2 AND id = $3 FOR UPDATE`, [orgId, kind, id]);
      const current = found.rows[0];
      const level = current ? await this.level(me, orgId, kind, current) : 'none';
      if (level === 'none') throw new NotFoundException('Not found.');
      if (!atLeast(level, 'manage')) throw new ForbiddenException('You do not have access to this.');
      if (version !== current.version) throw new ConflictException({ code: 'conflict', message: 'Someone changed this since you opened it. Reload it and try again.' });
      await tx.query('DELETE FROM objects WHERE org_id = $1 AND kind = $2 AND id = $3', [orgId, kind, id]);
      await tx.query('DELETE FROM grants WHERE org_id = $1 AND object_kind = $2 AND object_id = $3', [orgId, kind, id]);
      await this.audit.record({ actor: me.user.id, orgId, action: `${kind}.delete`, outcome: 'ok', sourceIp: ip, detail: { objectId: id } }, tx);
    });
    this.metrics.inc('object_writes_total', { kind });
  }
}
