import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AccessService, type Level } from '../access/access.service';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { createTicketSchema, deleteTicketSchema, updateTicketSchema, type UpdateTicket } from './schemas';
import { TicketsService } from './tickets.service';

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(result.error) });
  return result.data;
}

const address = (req: AuthedRequest): string => req.ip ?? 'unknown';

@Controller('orgs/:orgId')
@UseGuards(ClientGuard, SessionGuard)
export class TicketsController {
  constructor(@Inject(TicketsService) private readonly tickets: TicketsService, @Inject(AccessService) private readonly access: AccessService) {}

  /** A ticket follows the access of its space: View to read, Edit to add, change and delete tickets in it. */
  private async need(req: AuthedRequest, orgId: string, ticketId: number, level: Level): Promise<string> {
    await this.access.require(req.me, orgId, 'space', await this.tickets.spaceIdOf(orgId, ticketId), level);
    return req.me.user.id;
  }

  @Get('spaces/:spaceId/tickets')
  async list(@Param('orgId') orgId: string, @Param('spaceId', ParseIntPipe) spaceId: number, @Req() req: AuthedRequest) {
    await this.access.require(req.me, orgId, 'space', spaceId, 'view');
    return this.tickets.list(orgId, spaceId);
  }

  @Post('spaces/:spaceId/tickets')
  async create(@Param('orgId') orgId: string, @Param('spaceId', ParseIntPipe) spaceId: number, @Body() body: unknown, @Req() req: AuthedRequest) {
    await this.access.require(req.me, orgId, 'space', spaceId, 'edit');
    return this.tickets.create(orgId, spaceId, req.me.user.id, parse(createTicketSchema, body), address(req));
  }

  @Get('tickets/:id')
  async get(@Param('orgId') orgId: string, @Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    await this.need(req, orgId, id, 'view');
    return this.tickets.get(orgId, id);
  }

  @Patch('tickets/:id')
  async update(@Param('orgId') orgId: string, @Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AuthedRequest) {
    const actor = await this.need(req, orgId, id, 'edit');
    return this.tickets.update(orgId, id, actor, parse<UpdateTicket>(updateTicketSchema as ZodType<UpdateTicket>, body), address(req));
  }

  @Delete('tickets/:id')
  @HttpCode(204)
  async remove(@Param('orgId') orgId: string, @Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AuthedRequest) {
    const actor = await this.need(req, orgId, id, 'edit');
    await this.tickets.remove(orgId, id, actor, parse(deleteTicketSchema, body).version, address(req));
  }
}
