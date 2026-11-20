import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, Put, Req, UseGuards } from '@nestjs/common';
import { z, type ZodType } from 'zod';
import { ClientGuard } from '../auth/client.guard';
import { fieldErrors } from '../auth/schemas';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { ObjectsService, type ObjectType } from './objects.service';

const KINDS: readonly string[] = ['project', 'roadmap', 'dashboard'];
const saveSchema = z.strictObject({ doc: z.record(z.string(), z.unknown()), version: z.number().int().min(1).optional(), position: z.number().int().min(0).max(100000).optional() });
const deleteSchema = z.strictObject({ version: z.number().int().min(1) });
const ID = /^[A-Za-z0-9_.:-]{1,80}$/;

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(result.error) });
  return result.data;
}

function kindOf(value: string): ObjectType {
  if (!KINDS.includes(value)) throw new BadRequestException({ code: 'invalid_input', message: 'Unknown kind.', fields: { kind: 'Unknown kind.' } });
  return value as ObjectType;
}

function idOf(value: string): string {
  if (!ID.test(value)) throw new BadRequestException({ code: 'invalid_input', message: 'Not an object id.', fields: { id: 'Not an object id.' } });
  return value;
}

@Controller('orgs/:orgId/objects/:kind')
@UseGuards(ClientGuard, SessionGuard)
export class ObjectsController {
  constructor(@Inject(ObjectsService) private readonly objects: ObjectsService) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('kind') kind: string, @Req() req: AuthedRequest) {
    return this.objects.list(req.me, orgId, kindOf(kind));
  }

  @Put(':id')
  save(@Param('orgId') orgId: string, @Param('kind') kind: string, @Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    return this.objects.save(req.me, orgId, kindOf(kind), idOf(id), parse(saveSchema, body), req.ip ?? 'unknown');
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('orgId') orgId: string, @Param('kind') kind: string, @Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    await this.objects.remove(req.me, orgId, kindOf(kind), idOf(id), parse(deleteSchema, body).version, req.ip ?? 'unknown');
  }
}
