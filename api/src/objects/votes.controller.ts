import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, ParseIntPipe, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { VotesService } from './votes.service';

const voteSchema = z.strictObject({ points: z.number().min(0).max(1000).multipleOf(0.5).nullable() });
const ID = /^[A-Za-z0-9_.:-]{1,80}$/;

/** Points for the tickets of one story box. */
@Controller('orgs/:orgId/objects/storybox/:boxId/votes')
@UseGuards(ClientGuard, SessionGuard)
export class VotesController {
  constructor(@Inject(VotesService) private readonly votes: VotesService) {}

  private box(id: string): string {
    if (!ID.test(id)) throw new BadRequestException({ code: 'invalid_input', message: 'Not an object id.', fields: { id: 'Not an object id.' } });
    return id;
  }

  @Get()
  list(@Param('orgId') orgId: string, @Param('boxId') boxId: string, @Req() req: AuthedRequest) {
    return this.votes.list(req.me, orgId, this.box(boxId));
  }

  /** The person's own points for a ticket; `null` takes them back. */
  @Put(':ticketId')
  @HttpCode(204)
  async vote(@Param('orgId') orgId: string, @Param('boxId') boxId: string, @Param('ticketId', ParseIntPipe) ticketId: number, @Body() body: unknown, @Req() req: AuthedRequest) {
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(parsed.error) });
    await this.votes.vote(req.me, orgId, this.box(boxId), ticketId, parsed.data.points, req.ip ?? 'unknown');
  }
}
