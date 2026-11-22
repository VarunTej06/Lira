import { Controller, Get, Header, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { MetricsService } from '../observability/metrics.service';

/** Liveness, readiness and counters. These sit outside /api, and the public site's web server never forwards them. */
@Controller()
export class HealthController {
  constructor(@Inject(DbService) private readonly db: DbService, @Inject(MetricsService) private readonly metrics: MetricsService) {}

  /** The process is up. It checks nothing else, so a database outage does not make the platform restart a healthy process. */
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  /** Ready to take traffic: the database answers. */
  @Get('ready')
  async ready() {
    const up = await this.db.ping();
    this.metrics.inc('ready_checks_total', { database: up ? 'up' : 'down' });
    if (!up) throw new ServiceUnavailableException('The database is not answering.');
    return { status: 'ready', database: 'up' };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  counters() {
    return this.metrics.render();
  }
}
