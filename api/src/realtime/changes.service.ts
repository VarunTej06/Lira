import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Client } from 'pg';
import { CONFIG, type Config } from '../config';
import { DbService } from '../db/db.service';
import { logLine } from '../observability/log';
import { MetricsService } from '../observability/metrics.service';

/** What changed, and where. It names no title, text or person: a page that hears it asks the API again, which checks access as always. */
export interface Change { kind: 'ticket' | 'space'; spaceId: number | null }

interface Subscriber { orgId: string; userId: string; send: (change: Change) => void }

const CHANNEL = 'lira_changes';
const RECONNECT_MS = 3000;
/** Open streams one person may hold: a few tabs, not a flood. */
export const MAX_STREAMS_PER_PERSON = 6;

/**
 * Tells open pages that something changed. A write publishes a short note through PostgreSQL (NOTIFY), and every copy of the API
 * listens (LISTEN) and passes the note on to the pages connected to it, so it works with more than one copy of the API running.
 */
@Injectable()
export class ChangesService implements OnApplicationBootstrap, OnModuleDestroy {
  private listener: Client | undefined;
  private closed = false;
  private retry: NodeJS.Timeout | undefined;
  private readonly subscribers = new Set<Subscriber>();

  constructor(@Inject(DbService) private readonly db: DbService, @Inject(CONFIG) private readonly config: Config, @Inject(MetricsService) private readonly metrics: MetricsService) {}

  onApplicationBootstrap(): void { void this.listen(); }

  onModuleDestroy(): void {
    this.closed = true;
    clearTimeout(this.retry);
    void this.listener?.end().catch(() => undefined);
  }

  /** Says that something changed. Best effort: a note that cannot be sent is not worth failing the write for. */
  async publish(orgId: string, change: Change): Promise<void> {
    try {
      await this.db.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify({ o: orgId, k: change.kind, s: change.spaceId })]);
    } catch (error) {
      this.metrics.inc('realtime_publish_failed_total');
      logLine('warn', 'could not publish a change', { reason: error instanceof Error ? error.name : 'unknown' });
    }
  }

  openFor(userId: string): number { return [...this.subscribers].filter(s => s.userId === userId).length; }

  /** Listens for changes of one organisation. Returns how to stop. */
  subscribe(orgId: string, userId: string, send: (change: Change) => void): () => void {
    const sub: Subscriber = { orgId, userId, send };
    this.subscribers.add(sub);
    this.metrics.inc('realtime_streams_total');
    return () => { this.subscribers.delete(sub); };
  }

  /** Hands a note from the database to the pages of that organisation. A note that is not in the expected shape is dropped. */
  dispatch(payload: string | undefined): void {
    let note: unknown;
    try { note = JSON.parse(payload ?? ''); } catch { return; }
    const n = note as { o?: unknown; k?: unknown; s?: unknown } | null;
    if (typeof n?.o !== 'string' || (n.k !== 'ticket' && n.k !== 'space') || !(n.s === null || (typeof n.s === 'number' && Number.isInteger(n.s)))) return;
    for (const sub of this.subscribers) if (sub.orgId === n.o) sub.send({ kind: n.k, spaceId: n.s });
  }

  private async listen(): Promise<void> {
    if (this.closed) return;
    const client = new Client({ connectionString: this.config.databaseUrl, ssl: this.config.databaseSsl ? { rejectUnauthorized: true } : false });
    const lost = () => { if (this.listener === client) { this.listener = undefined; this.reconnectSoon(); } };
    client.on('notification', message => this.dispatch(message.payload));
    client.on('error', lost);
    client.on('end', lost);
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      this.listener = client;
    } catch (error) {
      logLine('warn', 'could not listen for changes', { reason: error instanceof Error ? error.name : 'unknown' });
      void client.end().catch(() => undefined);
      this.reconnectSoon();
    }
  }

  private reconnectSoon(): void {
    if (this.closed || this.retry) return;
    this.retry = setTimeout(() => { this.retry = undefined; void this.listen(); }, RECONNECT_MS);
    this.retry.unref();
  }
}
