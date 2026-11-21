import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AccessService } from '../access/access.service';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { createStandupSchema, updateStandupSchema } from './schemas';
import { StandupsService } from './standups.service';

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(result.error) });
  return result.data;
}

@Controller('orgs/:orgId/standups')
@UseGuards(ClientGuard, SessionGuard)
export class StandupsController {
  constructor(@Inject(StandupsService) private readonly standups: StandupsService, @Inject(AccessService) private readonly access: AccessService) {}

  /** Anyone in the organisation may ask; they get only the calls they are invited to (an Owner or Admin gets all). */
  @Get()
  list(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    return this.standups.list(req.me, orgId);
  }

  /** Who can be invited. Owner and Admin only. */
  @Get('audience')
  audience(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    this.access.requireAdmin(req.me, orgId);
    return this.standups.audience(orgId);
  }

  @Post()
  create(@Param('orgId') orgId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    this.access.requireAdmin(req.me, orgId);
    return this.standups.create(orgId, req.me.user.id, parse(createStandupSchema, body), req.ip ?? 'unknown');
  }

  @Patch(':id')
  update(@Param('orgId') orgId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    this.access.requireAdmin(req.me, orgId);
    return this.standups.update(orgId, req.me.user.id, id, parse(updateStandupSchema, body), req.ip ?? 'unknown');
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('orgId') orgId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    this.access.requireAdmin(req.me, orgId);
    await this.standups.remove(orgId, req.me.user.id, id, req.ip ?? 'unknown');
  }
}
