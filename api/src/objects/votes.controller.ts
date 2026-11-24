import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { VotesService } from './votes.service';

const points = z.number().min(0).max(1000).multipleOf(0.5);
const voteSchema = z.strictObject({ points: points.nullable() });
const confirmSchema = z.strictObject({ points });
const ID = /^[A-Za-z0-9_.:-]{1,80}$/;

/** The planning-poker room of one story box: the state, one ticket's round, and each person's own points. */
@Controller('orgs/:orgId')
@UseGuards(ClientGuard, SessionGuard)
export class VotesController {
  constructor(@Inject(VotesService) private readonly votes: VotesService) {}

  private box(id: string): string {
    if (!ID.test(id)) throw new BadRequestException({ code: 'invalid_input', message: 'Not an object id.', fields: { id: 'Not an object id.' } });
    return id;
  }
  private parse<T>(schema: z.ZodType<T>, body: unknown): T {
    const r = schema.safeParse(body);
    if (!r.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(r.error) });
    return r.data;
  }

  /** Sized tickets and points of every story box the person may view, for the overview. */
  @Get('storybox-summary')
  summary(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    return this.votes.summary(req.me, orgId);
  }

  @Get('objects/storybox/:boxId/room')
  room(@Param('orgId') orgId: string, @Param('boxId') boxId: string, @Req() req: AuthedRequest) {
    return this.votes.room(req.me, orgId, this.box(boxId));
  }

  @Post('objects/storybox/:boxId/rounds/:ticketId/start') @HttpCode(204)
  async start(@Param('orgId') orgId: string, @Param('boxId') boxId: string, @Param('ticketId', ParseIntPipe) t: number, @Req() req: AuthedRequest) {
    await this.votes.start(req.me, orgId, this.box(boxId), t, req.ip ?? 'unknown');
  }

  @Post('objects/storybox/:boxId/rounds/:ticketId/reveal') @HttpCode(204)
  async reveal(@Param('orgId') orgId: string, @Param('boxId') boxId: string, @Param('ticketId', ParseIntPipe) t: number, @Req() req: AuthedRequest) {
    await this.votes.reveal(req.me, orgId, this.box(boxId), t, req.ip ?? 'unknown');
  }

  @Post('objects/storybox/:boxId/rounds/:ticketId/revote') @HttpCode(204)
  async revote(@Param('orgId') orgId: string, @Param('boxId') boxId: string, @Param('ticketId', ParseIntPipe) t: number, @Req() req: AuthedRequest) {
    await this.votes.revote(req.me, orgId, this.box(boxId), t, req.ip ?? 'unknown');
  }

  @Post('objects/storybox/:boxId/rounds/:ticketId/confirm') @HttpCode(204)
  async confirm(@Param('orgId') orgId: string, @Param('boxId') boxId: string, @Param('ticketId', ParseIntPipe) t: number, @Body() body: unknown, @Req() req: AuthedRequest) {
    await this.votes.confirm(req.me, orgId, this.box(boxId), t, this.parse(confirmSchema, body).points, req.ip ?? 'unknown');
  }

  /** The person's own points for a ticket; `null` takes them back. */
  @Put('objects/storybox/:boxId/votes/:ticketId') @HttpCode(204)
  async vote(@Param('orgId') orgId: string, @Param('boxId') boxId: string, @Param('ticketId', ParseIntPipe) t: number, @Body() body: unknown, @Req() req: AuthedRequest) {
    await this.votes.vote(req.me, orgId, this.box(boxId), t, this.parse(voteSchema, body).points, req.ip ?? 'unknown');
  }
}
