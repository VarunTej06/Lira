import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AccessService } from '../access/access.service';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { createSpaceSchema, deleteSpaceSchema, updateSpaceSchema } from './schemas';
import { SpacesService } from './spaces.service';

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(result.error) });
  return result.data;
}

const address = (req: AuthedRequest): string => req.ip ?? 'unknown';

@Controller('orgs/:orgId/spaces')
@UseGuards(ClientGuard, SessionGuard)
export class SpacesController {
  constructor(@Inject(SpacesService) private readonly spaces: SpacesService, @Inject(AccessService) private readonly access: AccessService) {}

  /** Only the spaces the person may view; for someone with no access to any, an empty list. */
  @Get()
  async list(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    return this.spaces.list(orgId, await this.access.visible(req.me, orgId, 'space'));
  }

  /** Making a space is for the Owner and Admins; everyone else is given access to spaces that exist. */
  @Post()
  create(@Param('orgId') orgId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    this.access.requireAdmin(req.me, orgId);
    return this.spaces.create(orgId, req.me.user.id, parse(createSpaceSchema, body), address(req));
  }

  @Patch(':id')
  async update(@Param('orgId') orgId: string, @Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AuthedRequest) {
    await this.access.require(req.me, orgId, 'space', id, 'manage');
    return this.spaces.update(orgId, id, req.me.user.id, parse(updateSpaceSchema, body), address(req));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('orgId') orgId: string, @Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AuthedRequest) {
    await this.access.require(req.me, orgId, 'space', id, 'manage');
    await this.spaces.remove(orgId, id, req.me.user.id, parse(deleteSpaceSchema, body).version, address(req));
  }
}
