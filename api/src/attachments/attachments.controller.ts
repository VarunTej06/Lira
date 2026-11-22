import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseIntPipe, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AccessService, type Level } from '../access/access.service';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { TicketsService } from '../tickets/tickets.service';
import { AttachmentsService } from './attachments.service';
import { requestUploadSchema } from './schemas';

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(result.error) });
  return result.data;
}

@Controller('orgs/:orgId')
@UseGuards(ClientGuard, SessionGuard)
export class AttachmentsController {
  constructor(
    @Inject(AttachmentsService) private readonly attachments: AttachmentsService, @Inject(TicketsService) private readonly tickets: TicketsService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  /** A file follows the access of its ticket's space: View to list and download, Edit to add and remove. */
  private async need(req: AuthedRequest, orgId: string, ticketId: number, level: Level): Promise<string> {
    await this.access.require(req.me, orgId, 'space', await this.tickets.spaceIdOf(orgId, ticketId), level);
    return req.me.user.id;
  }

  @Get('tickets/:id/attachments')
  async list(@Param('orgId') orgId: string, @Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    await this.need(req, orgId, id, 'view');
    return this.attachments.list(orgId, id);
  }

  @Post('tickets/:id/attachments')
  async request(@Param('orgId') orgId: string, @Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AuthedRequest) {
    const actor = await this.need(req, orgId, id, 'edit');
    return this.attachments.request(orgId, id, actor, parse(requestUploadSchema, body));
  }

  @Post('attachments/:attId/confirm')
  @HttpCode(200)
  async confirm(@Param('orgId') orgId: string, @Param('attId', ParseUUIDPipe) attId: string, @Req() req: AuthedRequest) {
    const actor = await this.need(req, orgId, await this.attachments.ticketOf(orgId, attId), 'edit');
    return this.attachments.confirm(orgId, attId, actor, req.ip ?? 'unknown');
  }

  @Get('attachments/:attId/download')
  async download(@Param('orgId') orgId: string, @Param('attId', ParseUUIDPipe) attId: string, @Req() req: AuthedRequest) {
    await this.need(req, orgId, await this.attachments.ticketOf(orgId, attId), 'view');
    return this.attachments.download(orgId, attId);
  }

  @Delete('attachments/:attId')
  @HttpCode(204)
  async remove(@Param('orgId') orgId: string, @Param('attId', ParseUUIDPipe) attId: string, @Req() req: AuthedRequest) {
    const actor = await this.need(req, orgId, await this.attachments.ticketOf(orgId, attId), 'edit');
    await this.attachments.remove(orgId, attId, actor, req.ip ?? 'unknown');
  }
}
