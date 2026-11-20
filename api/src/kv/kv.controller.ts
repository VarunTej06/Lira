import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Inject, Param, Put, Req, UseGuards } from '@nestjs/common';
import { roleIn } from '../access/org-access';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { KvService } from './kv.service';
import { writeKvSchema } from './schemas';

/** Until people and teams hold access to single objects (ADR-0010), only an owner or an admin reaches the organisation's shared data. */
const SHARED_ROLES = ['owner', 'admin'];

@Controller('orgs/:orgId/kv')
@UseGuards(ClientGuard, SessionGuard)
export class KvController {
  constructor(@Inject(KvService) private readonly kv: KvService) {}

  @Get()
  read(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    return this.kv.read(orgId, req.me.user.id, SHARED_ROLES.includes(roleIn(req.me, orgId)));
  }

  @Put()
  @HttpCode(204)
  async write(@Param('orgId') orgId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const canShared = SHARED_ROLES.includes(roleIn(req.me, orgId));
    const parsed = writeKvSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(parsed.error) });
    if (parsed.data.shared && !canShared) throw new ForbiddenException('You do not have access to this.');
    await this.kv.write(orgId, req.me.user.id, parsed.data, req.ip ?? 'unknown');
  }
}
