import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import type { Config } from './config';
import { ErrorsFilter } from './observability/errors.filter';
import { requestLogger } from './observability/log';
import { MetricsService } from './observability/metrics.service';

const BODY_LIMIT = '16kb';

/** Builds the API. The tests use the same function, so they exercise the settings the real server runs with. */
export async function createApp(config: Config): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), { logger: ['error', 'warn'], bodyParser: false });
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops);
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.setGlobalPrefix('api', { exclude: ['health', 'ready', 'metrics'] });
  app.useGlobalFilters(new ErrorsFilter());
  app.use(requestLogger(app.get(MetricsService)));
  app.use((_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableShutdownHooks();
  return app;
}
