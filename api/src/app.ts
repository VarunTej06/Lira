import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json, type NextFunction, type Request, type Response } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import type { BlobStore } from './attachments/blob-store';
import type { AppOverrides } from './app.module';
import type { Config } from './config';
import { ErrorsFilter } from './observability/errors.filter';
import { requestLogger } from './observability/log';
import { MetricsService } from './observability/metrics.service';

const BODY_LIMIT = '16kb';
/** A ticket carries its description and comments, and a roadmap is one large value, so these routes (and only these) take a larger body. The schemas cap each field. */
const LARGE_BODY_LIMIT = '512kb';
const LARGE_BODY_ROUTES = /^\/api\/orgs\/[^/]+\/((spaces\/[^/]+\/)?tickets(\/|$)|kv$|objects\/)/;

/** Builds the API. The tests use the same function, so they exercise the settings the real server runs with. */
export async function createApp(config: Config, overrides: AppOverrides = {}): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config, overrides), { logger: ['error', 'warn'], bodyParser: false });
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops);
  // Chosen by the full path here, not by a mount path, so the address is never trimmed before the parser sees it.
  const largeBody = json({ limit: LARGE_BODY_LIMIT });
  app.use((req: Request, res: Response, next: NextFunction) => (LARGE_BODY_ROUTES.test(req.path) ? largeBody(req, res, next) : next()));
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
