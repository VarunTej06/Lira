import { Inject, Injectable } from '@nestjs/common';
import { DbService, type Queryable } from '../db/db.service';

export interface AuditEntry {
  actor?: string | null;
  orgId?: string | null;
  /** What happened, like `auth.login`. */
  action: string;
  outcome: 'ok' | 'denied' | 'error';
  sourceIp?: string | null;
  /** Small facts about the event. Never a password, a token or the text of a ticket. */
  detail?: Record<string, string | number | boolean | null>;
}

/** Who did what, when and from where, in a table the application can add to but never change. */
@Injectable()
export class AuditService {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  /** Adds a record. Pass the transaction's connection to make it commit or roll back with the change it describes. */
  async record(entry: AuditEntry, at: Queryable = this.db): Promise<void> {
    await at.query(
      'INSERT INTO audit_log (actor, org_id, action, outcome, source_ip, detail) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
      [entry.actor ?? null, entry.orgId ?? null, entry.action, entry.outcome, entry.sourceIp ?? null, JSON.stringify(entry.detail ?? {})],
    );
  }
}
