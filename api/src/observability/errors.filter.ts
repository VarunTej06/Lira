import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { logLine } from './log';

const CODES: Record<number, string> = {
  400: 'invalid_input', 401: 'unauthorised', 403: 'forbidden', 404: 'not_found', 409: 'conflict', 413: 'too_large', 429: 'too_many_requests', 503: 'unavailable',
};

/** Every error leaves in one shape, with no stack trace and no internal message. */
@Catch()
export class ErrorsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : { message: String(body) };
      res.status(status).json({ error: { code: typeof detail.code === 'string' ? detail.code : CODES[status] ?? 'error', message: typeof detail.message === 'string' ? detail.message : 'The request could not be completed.', ...(detail.fields ? { fields: detail.fields } : {}) } });
      return;
    }
    // The body parser reports an oversized or unreadable body with its own error type and a 4xx status.
    const clientStatus = (exception as { status?: unknown } | null)?.status;
    if (typeof clientStatus === 'number' && clientStatus >= 400 && clientStatus < 500) {
      res.status(clientStatus).json({ error: { code: CODES[clientStatus] ?? 'invalid_input', message: clientStatus === 413 ? 'The request is too large.' : 'The request could not be read.' } });
      return;
    }
    // Only the kind of error is logged: its message can carry data from a query.
    logLine('error', 'unhandled error', { kind: exception instanceof Error ? exception.name : typeof exception, code: (exception as { code?: string } | null)?.code ?? null });
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: { code: 'server_error', message: 'Something went wrong. Try again in a moment.' } });
  }
}
