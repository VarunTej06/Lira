import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { MetricsService } from './metrics.service';

/** One JSON object per line on standard output. Callers pass only facts about the request, never a body, a password or a token. */
export function logLine(level: 'info' | 'warn' | 'error', message: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), level, message, ...fields })}\n`);
}

/** Logs each request when it finishes: method, path without its query, status, time taken and a request id. */
export function requestLogger(metrics: MetricsService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = process.hrtime.bigint();
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.on('finish', () => {
      const ms = Number((process.hrtime.bigint() - started) / 1_000_000n);
      const route = (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
      metrics.inc('http_requests_total', { method: req.method, route, status: res.statusCode });
      logLine('info', 'request', { requestId, method: req.method, path: req.path, status: res.statusCode, ms });
    });
    next();
  };
}
