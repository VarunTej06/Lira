import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AccessService } from '../access/access.service';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { acceptSchema, inviteSchema } from '../people/schemas';
import { InvitationsService } from './invitations.service';

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(result.error) });
  return result.data;
}

@Controller()
@UseGuards(ClientGuard, SessionGuard)
export class InvitationsController {
  constructor(@Inject(InvitationsService) private readonly invitations: InvitationsService, @Inject(AccessService) private readonly access: AccessService) {}

  @Get('orgs/:orgId/invitations')
  async list(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    await this.access.requireManageAccess(req.me, orgId);
    return this.invitations.list(orgId);
  }

  /** The reply carries the link's token once, so the inviter can copy the link when no email service is connected. */
  @Post('orgs/:orgId/invitations')
  async create(@Param('orgId') orgId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    await this.access.requireManageAccess(req.me, orgId);
    const orgName = req.me.organisations.find(o => o.orgId.toLowerCase() === orgId.toLowerCase())?.orgName ?? 'the organisation';
    return this.invitations.create(orgId, orgName, req.me.user.id, parse(inviteSchema, body), req.ip ?? 'unknown');
  }

  @Delete('orgs/:orgId/invitations/:id')
  @HttpCode(204)
  async revoke(@Param('orgId') orgId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    await this.access.requireManageAccess(req.me, orgId);
    await this.invitations.revoke(orgId, req.me.user.id, id, req.ip ?? 'unknown');
  }

  @Post('invitations/accept')
  @HttpCode(200)
  accept(@Body() body: unknown, @Req() req: AuthedRequest) {
    return this.invitations.accept(req.me, parse(acceptSchema, body).token, req.ip ?? 'unknown');
  }
}
