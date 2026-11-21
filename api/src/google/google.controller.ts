import { Controller, Delete, ForbiddenException, Get, HttpCode, Inject, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AccessService } from '../access/access.service';
import { ClientGuard } from '../auth/client.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { CONFIG, type Config } from '../config';
import { GoogleService } from './google.service';

/** Connecting Google lets the app send email as that account, so it is the Owner's to do. */
function requireOwner(access: AccessService, req: AuthedRequest, orgId: string): void {
  if (access.role(req.me, orgId) !== 'owner') throw new ForbiddenException('You do not have access to this.');
}

@Controller()
@UseGuards(ClientGuard, SessionGuard)
export class GoogleController {
  constructor(@Inject(GoogleService) private readonly google: GoogleService, @Inject(AccessService) private readonly access: AccessService, @Inject(CONFIG) private readonly config: Config) {}

  @Get('orgs/:orgId/google')
  status(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    this.access.requireAdmin(req.me, orgId);
    return this.google.status(orgId);
  }

  /** Where to send the Owner to sign in at Google. */
  @Post('orgs/:orgId/google/connect')
  @HttpCode(200)
  connect(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    requireOwner(this.access, req, orgId);
    return { url: this.google.authorisationUrl(orgId, req.me.user.id) };
  }

  @Delete('orgs/:orgId/google')
  @HttpCode(204)
  async disconnect(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    requireOwner(this.access, req, orgId);
    await this.google.disconnect(orgId, req.me.user.id, req.ip ?? 'unknown');
  }

  /** Google sends the person's browser back here. They must still be signed in as the person who started, and still be the Owner. */
  @Get('google/callback')
  async callback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Query('error') error: string | undefined, @Req() req: AuthedRequest, @Res() res: Response) {
    const back = (result: string) => res.redirect(302, `${this.config.allowedOrigins[0] ?? ''}/app/calls?google=${result}`);
    if (error || !code || !state) return back('refused');
    try {
      await this.google.complete(code, state, req.me.user.id, req.ip ?? 'unknown');
      return back('connected');
    } catch { return back('failed'); }
  }
}
