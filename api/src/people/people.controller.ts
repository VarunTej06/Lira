import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AccessService, type ObjectKind } from '../access/access.service';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { grantSchema, shareSchema, teamMembersSchema, teamSchema, updateMemberSchema } from './schemas';
import { PeopleService } from './people.service';

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(result.error) });
  return result.data;
}

const address = (req: AuthedRequest): string => req.ip ?? 'unknown';
const KINDS = ['space', 'project', 'roadmap', 'dashboard'];

/** People, teams and access. Every call needs the right to manage access: the Owner, or an Admin the owner has not switched off. */
@Controller('orgs/:orgId')
@UseGuards(ClientGuard, SessionGuard)
export class PeopleController {
  constructor(@Inject(PeopleService) private readonly people: PeopleService, @Inject(AccessService) private readonly access: AccessService) {}

  /** Whether the caller may manage access in this organisation, as the page uses to decide what to show. The server checks again on every call. */
  @Get('access')
  async mine(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    return { role: this.access.role(req.me, orgId), canManageAccess: await this.access.canManageAccess(req.me, orgId) };
  }

  /** Who was invited to a space and what else of it they see. */
  @Get('spaces/:spaceId/shares')
  async shares(@Param('orgId') orgId: string, @Param('spaceId', ParseIntPipe) spaceId: number, @Req() req: AuthedRequest) {
    await this.admin(req, orgId);
    return this.people.shares(orgId, spaceId);
  }

  @Put('spaces/:spaceId/shares/:userId')
  @HttpCode(204)
  async setShares(@Param('orgId') orgId: string, @Param('spaceId', ParseIntPipe) spaceId: number, @Param('userId', ParseUUIDPipe) userId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const actor = await this.admin(req, orgId);
    const changes = parse(shareSchema.partial(), body);
    if (Object.keys(changes).length === 0) throw new BadRequestException({ code: 'invalid_input', message: 'Nothing to change.' });
    await this.people.setShares(orgId, actor, spaceId, userId, changes, address(req));
  }

  private async admin(req: AuthedRequest, orgId: string): Promise<string> {
    await this.access.requireManageAccess(req.me, orgId);
    return req.me.user.id;
  }

  @Get('members')
  async members(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    await this.admin(req, orgId);
    return this.people.members(orgId);
  }

  /** Changing a role, or whether an Admin may manage access, is for the owner alone. */
  @Patch('members/:userId')
  @HttpCode(204)
  async updateMember(@Param('orgId') orgId: string, @Param('userId', ParseUUIDPipe) userId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    if (this.access.role(req.me, orgId) !== 'owner') throw new ForbiddenException('You do not have access to this.');
    await this.people.updateMember(orgId, req.me.user.id, userId, parse(updateMemberSchema, body), address(req));
  }

  @Delete('members/:userId')
  @HttpCode(204)
  async removeMember(@Param('orgId') orgId: string, @Param('userId', ParseUUIDPipe) userId: string, @Req() req: AuthedRequest) {
    const actor = await this.admin(req, orgId);
    await this.people.removeMember(orgId, actor, this.access.role(req.me, orgId) === 'owner', userId, address(req));
  }

  @Get('teams')
  async teams(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    await this.admin(req, orgId);
    return this.people.teams(orgId);
  }

  @Post('teams')
  async createTeam(@Param('orgId') orgId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const actor = await this.admin(req, orgId);
    return this.people.createTeam(orgId, actor, parse(teamSchema, body).name, address(req));
  }

  @Patch('teams/:teamId')
  @HttpCode(204)
  async renameTeam(@Param('orgId') orgId: string, @Param('teamId', ParseUUIDPipe) teamId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const actor = await this.admin(req, orgId);
    await this.people.renameTeam(orgId, actor, teamId, parse(teamSchema, body).name, address(req));
  }

  @Delete('teams/:teamId')
  @HttpCode(204)
  async deleteTeam(@Param('orgId') orgId: string, @Param('teamId', ParseUUIDPipe) teamId: string, @Req() req: AuthedRequest) {
    const actor = await this.admin(req, orgId);
    await this.people.deleteTeam(orgId, actor, teamId, address(req));
  }

  @Put('teams/:teamId/members')
  @HttpCode(204)
  async setMembers(@Param('orgId') orgId: string, @Param('teamId', ParseUUIDPipe) teamId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const actor = await this.admin(req, orgId);
    await this.people.setTeamMembers(orgId, actor, teamId, parse(teamMembersSchema, body).userIds, address(req));
  }

  @Get('grants')
  async grants(@Param('orgId') orgId: string, @Query('kind') kind: string | undefined, @Query('objectId') objectId: string | undefined, @Req() req: AuthedRequest) {
    await this.admin(req, orgId);
    if (kind !== undefined && !KINDS.includes(kind)) throw new BadRequestException({ code: 'invalid_input', message: 'Unknown kind.', fields: { kind: 'Unknown kind.' } });
    return this.people.grants(orgId, kind as ObjectKind | undefined, objectId);
  }

  @Post('grants')
  async grant(@Param('orgId') orgId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const actor = await this.admin(req, orgId);
    return this.people.grant(orgId, actor, parse(grantSchema, body), address(req));
  }

  @Delete('grants/:grantId')
  @HttpCode(204)
  async revoke(@Param('orgId') orgId: string, @Param('grantId', ParseUUIDPipe) grantId: string, @Req() req: AuthedRequest) {
    const actor = await this.admin(req, orgId);
    await this.people.revoke(orgId, actor, grantId, address(req));
  }
}
