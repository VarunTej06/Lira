import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DbService, type Queryable } from '../db/db.service';
import { MetricsService } from '../observability/metrics.service';
import type { WriteKv } from './schemas';

export interface KvOut { shared: Record<string, string> | null; mine: Record<string, string> }

type Entries = Record<string, string | null>;

/** The app's settings-style data of one organisation: what everyone in it shares, and each person's own preferences. */
@Injectable()
export class KvService {
  constructor(@Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService, @Inject(MetricsService) private readonly metrics: MetricsService) {}

  /** `shared` is null for a person who may not see the shared data, so they can tell "no access" from "nothing saved". */
  async read(orgId: string, userId: string, canShared: boolean): Promise<KvOut> {
    const rows = await this.db.query<{ key: string; value: string; owner_id: string | null }>(
      'SELECT key, value, owner_id FROM kv_entries WHERE org_id = $1 AND (owner_id = $2 OR ($3 AND owner_id IS NULL))', [orgId, userId, canShared]);
    const out: KvOut = { shared: canShared ? {} : null, mine: {} };
    for (const r of rows.rows) (r.owner_id === null ? out.shared! : out.mine)[r.key] = r.value;
    return out;
  }

  async write(orgId: string, userId: string, input: WriteKv, ip: string): Promise<void> {
    await this.db.transaction(async tx => {
      if (input.shared) await this.apply(tx, orgId, null, userId, input.shared);
      if (input.mine) await this.apply(tx, orgId, userId, userId, input.mine);
      await this.audit.record({
        actor: userId, orgId, action: 'kv.write', outcome: 'ok', sourceIp: ip,
        detail: { shared: Object.keys(input.shared ?? {}).join(','), mine: Object.keys(input.mine ?? {}).join(',') },
      }, tx);
    });
    this.metrics.inc('kv_writes_total');
  }

  private async apply(tx: Queryable, orgId: string, owner: string | null, actor: string, entries: Entries): Promise<void> {
    const removals = Object.keys(entries).filter(k => entries[k] === null);
    if (removals.length) await tx.query('DELETE FROM kv_entries WHERE org_id = $1 AND owner_id IS NOT DISTINCT FROM $2 AND key = ANY($3)', [orgId, owner, removals]);
    for (const [key, value] of Object.entries(entries)) {
      if (value === null) continue;
      await tx.query(
        `INSERT INTO kv_entries (org_id, owner_id, key, value, updated_by) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (${owner === null ? 'org_id, key) WHERE owner_id IS NULL' : 'org_id, owner_id, key) WHERE owner_id IS NOT NULL'}
         DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [orgId, owner, key, value, actor]);
    }
  }
}
