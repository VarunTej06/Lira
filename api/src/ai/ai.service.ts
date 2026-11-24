import { BadGatewayException, BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import type { Me } from '../auth/auth.service';
import { CONFIG, type AiProviderConfig, type Config } from '../config';
import { DbService } from '../db/db.service';
import { logLine } from '../observability/log';
import { MetricsService } from '../observability/metrics.service';
import { buildUserMessage, MAX_TICKETS, SYSTEM_PROMPT, type TicketFacts } from './context';
import { AI_HTTP, askProvider, ProviderError, type AiHttp } from './providers';
import type { AskInput } from './schemas';

export interface AskResult { answer: string; provider: string; model: string }

/**
 * Viva on the server: reads the tickets the caller may see, asks the chosen provider, and gives back words. A model's answer never
 * changes a record, so there is nothing to preview or undo here; changes made through Viva stay in the app, with the person's click.
 */
@Injectable()
export class AiService {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(AI_HTTP) private readonly http: AiHttp,
    @Inject(DbService) private readonly db: DbService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  /** Which providers the administrator allowed: names and models only, never keys. */
  providers(): { id: string; model: string }[] {
    return this.config.ai.providers.map(p => ({ id: p.id, model: p.model }));
  }

  private chosen(wanted: AskInput['provider']): AiProviderConfig {
    const all = this.config.ai.providers;
    if (all.length === 0) throw new ServiceUnavailableException({ code: 'ai_not_set_up', message: 'Viva is not set up on this server.' });
    const found = wanted ? all.find(p => p.id === wanted) : all[0];
    if (!found) throw new BadRequestException({ code: 'provider_not_allowed', message: 'That model provider is not enabled here.' });
    return found;
  }

  /** The tickets of one space the caller may view, or of every space they may view. A space they cannot see does not exist for them. */
  private async tickets(me: Me, orgId: string, spaceId: number | undefined): Promise<{ tickets: TicketFacts[]; scope: string }> {
    let spaces: number[] | null = null; // null: every space of the organisation
    let scope = 'all spaces you can see';
    if (spaceId !== undefined) {
      await this.access.require(me, orgId, 'space', spaceId, 'view');
      const space = await this.db.query<{ key: string }>('SELECT key FROM spaces WHERE org_id = $1 AND id = $2', [orgId, spaceId]);
      if (!space.rows[0]) throw new NotFoundException('Not found.');
      spaces = [spaceId];
      scope = `space ${space.rows[0].key}`;
    } else {
      const visible = await this.access.visible(me, orgId, 'space');
      if (visible !== 'all') spaces = [...visible.keys()].map(Number).filter(Number.isInteger);
    }
    const rows = await this.db.query<TicketFacts>(
      `SELECT key, title, type, status, priority, assignee FROM tickets WHERE org_id = $1 AND ($2::bigint[] IS NULL OR space_id = ANY($2::bigint[]))
       ORDER BY updated_at DESC, id DESC LIMIT ${MAX_TICKETS}`, [orgId, spaces]);
    return { tickets: rows.rows, scope };
  }

  /** Questions a person may ask in an hour, counted from the audit log so the limit holds across servers. */
  private async requireUnderLimit(me: Me, orgId: string, ip: string): Promise<void> {
    const used = await this.db.query<{ n: string }>(`SELECT count(*) AS n FROM audit_log WHERE actor = $1 AND action = 'ai.ask' AND at > now() - interval '1 hour'`, [me.user.id]);
    if (Number(used.rows[0].n) < this.config.ai.perUserPerHour) return;
    await this.audit.record({ actor: me.user.id, orgId, action: 'ai.limited', outcome: 'denied', sourceIp: ip });
    this.metrics.inc('ai_requests_total', { outcome: 'limited' });
    throw new HttpException({ code: 'ai_rate_limited', message: 'You have asked Viva a lot this hour. Try again later.' }, HttpStatus.TOO_MANY_REQUESTS);
  }

  async ask(me: Me, orgId: string, input: AskInput, ip: string): Promise<AskResult> {
    this.access.role(me, orgId);
    const provider = this.chosen(input.provider);
    const { tickets, scope } = await this.tickets(me, orgId, input.spaceId);
    await this.requireUnderLimit(me, orgId, ip);
    const started = Date.now();
    const fact = { provider: provider.id, model: provider.model, questionChars: input.question.length, tickets: tickets.length, spaceId: input.spaceId ?? null };
    try {
      const reply = await askProvider(this.http, provider, SYSTEM_PROMPT, buildUserMessage(input.question, tickets, scope));
      await this.audit.record({ actor: me.user.id, orgId, action: 'ai.ask', outcome: 'ok', sourceIp: ip, detail: { ...fact, inputTokens: reply.inputTokens, outputTokens: reply.outputTokens } });
      this.metrics.inc('ai_requests_total', { provider: provider.id, outcome: 'ok' });
      logLine('info', 'ai.ask', { ...fact, orgId, ms: Date.now() - started, inputTokens: reply.inputTokens, outputTokens: reply.outputTokens });
      return { answer: reply.text, provider: provider.id, model: provider.model };
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      await this.audit.record({ actor: me.user.id, orgId, action: 'ai.ask', outcome: 'error', sourceIp: ip, detail: fact });
      this.metrics.inc('ai_requests_total', { provider: provider.id, outcome: 'error' });
      logLine('warn', 'ai.ask failed', { ...fact, orgId, ms: Date.now() - started, reason: e.message });
      throw new BadGatewayException({ code: 'ai_unavailable', message: 'Viva could not get an answer. Try again in a moment.' });
    }
  }
}
