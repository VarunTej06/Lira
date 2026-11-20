import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type Me } from './auth.service';
import { tokenFromCookieHeader } from './session';

export interface AuthedRequest extends Request { me: Me }

/** Every route behind it needs a live session. The server decides who is calling; the page hiding a button is not a control. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const me = await this.auth.me(tokenFromCookieHeader(request.headers.cookie));
    if (!me) throw new UnauthorizedException('You are not signed in.');
    request.me = me;
    return true;
  }
}
