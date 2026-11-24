import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { AiService } from './ai.service';
import { askSchema } from './schemas';

@Controller('orgs/:orgId/ai')
@UseGuards(ClientGuard, SessionGuard)
export class AiController {
  constructor(@Inject(AiService) private readonly ai: AiService, @Inject(AccessService) private readonly access: AccessService) {}

  /** Which model providers the administrator allowed. Any member may ask; a stranger to the organisation gets "not found". */
  @Get('providers')
  providers(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    this.access.role(req.me, orgId);
    return this.ai.providers();
  }

  @Post('ask')
  @HttpCode(200)
  ask(@Param('orgId') orgId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const parsed = askSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(parsed.error) });
    return this.ai.ask(req.me, orgId, parsed.data, req.ip ?? 'unknown');
  }
}
