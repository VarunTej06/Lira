import { BadRequestException, Body, Controller, Get, Inject, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { RemindersService } from './reminders.service';

/** Unknown fields are refused; at least one switch must be given. */
const prefsSchema = z.strictObject({ calls: z.boolean().optional(), due: z.boolean().optional() })
  .refine(v => v.calls !== undefined || v.due !== undefined, { message: 'Nothing to change.' });

/** The signed-in person's own reminder switches. They only ever read and change their own. */
@Controller('me/reminders')
@UseGuards(ClientGuard, SessionGuard)
export class RemindersController {
  constructor(@Inject(RemindersService) private readonly reminders: RemindersService) {}

  @Get()
  async mine(@Req() req: AuthedRequest) {
    return { ...(await this.reminders.prefs(req.me.user.id)), available: this.reminders.available };
  }

  @Put()
  async change(@Body() body: unknown, @Req() req: AuthedRequest) {
    const parsed = prefsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(parsed.error) });
    return { ...(await this.reminders.setPrefs(req.me.user.id, parsed.data)), available: this.reminders.available };
  }
}
