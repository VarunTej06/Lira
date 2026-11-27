import { Controller, Get, HttpException, HttpStatus, Inject, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AccessService } from '../access/access.service';
import { roleIn } from '../access/org-access';
import { AuthService } from '../auth/auth.service';
import { ClientGuard } from '../auth/client.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { tokenFromCookieHeader } from '../auth/session';
import { ChangesService, MAX_STREAMS_PER_PERSON, type Change } from './changes.service';

/** A comment every so often keeps proxies from closing a quiet stream. */
const HEARTBEAT_MS = 25_000;
/** A stream ends after this long and the page opens a new one, which checks the session again. */
const LIFETIME_MS = 55 * 60_000;

/** The stream of "something changed" notes for one organisation, as server-sent events. */
@Controller('orgs/:orgId/events')
@UseGuards(ClientGuard, SessionGuard)
export class EventsController {
  constructor(
    @Inject(ChangesService) private readonly changes: ChangesService, @Inject(AccessService) private readonly access: AccessService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  stream(@Param('orgId') orgId: string, @Req() req: AuthedRequest, @Res() res: Response): void {
    roleIn(req.me, orgId); // a stranger to the organisation gets "not found"
    if (this.changes.openFor(req.me.user.id) >= MAX_STREAMS_PER_PERSON) throw new HttpException('Too many open windows. Close one and try again.', HttpStatus.TOO_MANY_REQUESTS);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 5000\n\n');

    const token = tokenFromCookieHeader(req.headers.cookie);
    const hear = async (change: Change): Promise<void> => {
      // The session and the person's access are checked again for each note, so someone removed or logged out stops hearing at once.
      const me = await this.auth.me(token);
      if (!me || !me.organisations.some(o => o.orgId.toLowerCase() === orgId.toLowerCase())) { stop(); return; }
      if (change.spaceId !== null && (await this.access.levelOn(me, orgId, 'space', change.spaceId)) === 'none') return;
      res.write(`data: ${JSON.stringify(change)}\n\n`);
    };
    const unsubscribe = this.changes.subscribe(orgId, req.me.user.id, change => { void hear(change).catch(() => undefined); });
    const beat = setInterval(() => res.write(': keep-alive\n\n'), HEARTBEAT_MS);
    const limit = setTimeout(() => stop(), LIFETIME_MS);
    function stop(): void { clearInterval(beat); clearTimeout(limit); unsubscribe(); res.end(); }
    req.on('close', () => { clearInterval(beat); clearTimeout(limit); unsubscribe(); });
  }
}
