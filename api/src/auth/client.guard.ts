import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CONFIG, type Config } from '../config';
import { checkRequest } from './csrf';

/** Refuses a call that changes something unless it comes from one of our own pages. See csrf.ts. */
@Injectable()
export class ClientGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (checkRequest(request.method, request.headers, this.config.allowedOrigins) !== 'ok') throw new ForbiddenException('This request did not come from Liraspaces.');
    return true;
  }
}
