import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { logLine } from '../observability/log';
import { MetricsService } from '../observability/metrics.service';

const EVERY_MS = 60 * 60_000;

/** What each table keeps: rows older than this are not needed any more (an expired session is refused anyway, a day later it can go). */
const CLEAN: readonly { name: string; sql: string }[] = [
  { name: 'sessions', sql: "DELETE FROM sessions WHERE expires_at < now() - interval '1 day'" },
  { name: 'login_attempts', sql: "DELETE FROM login_attempts WHERE at < now() - interval '1 day'" },
  { name: 'email_tokens', sql: "DELETE FROM email_tokens WHERE expires_at < now() - interval '2 days'" },
  { name: 'reminders_sent', sql: "DELETE FROM reminders_sent WHERE sent_at < now() - interval '3 days'" },
  { name: 'invitations', sql: "DELETE FROM invitations WHERE expires_at < now() - interval '30 days' AND accepted_at IS NULL" },
];

/** Once an hour, clears out what has expired. Failing here never affects a request. */
@Injectable()
export class MaintenanceService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;

  constructor(@Inject(DbService) private readonly db: DbService, @Inject(MetricsService) private readonly metrics: MetricsService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => { void this.runOnce().catch(() => undefined); }, EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void { clearInterval(this.timer); }

  /** Deletes the expired rows of each table. Returns how many went from each. */
  async runOnce(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const { name, sql } of CLEAN) {
      try {
        out[name] = (await this.db.query(sql)).rowCount ?? 0;
        this.metrics.inc('maintenance_deleted_total', { table: name });
      } catch (error) {
        out[name] = 0;
        logLine('warn', 'clean-up failed', { table: name, reason: error instanceof Error ? error.name : 'unknown' });
      }
    }
    return out;
  }
}
