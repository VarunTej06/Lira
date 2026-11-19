import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ZodType } from 'zod';
import { CONFIG, type Config } from '../config';
import { AuthService, type SignedIn } from './auth.service';
import { ClientGuard } from './client.guard';
import { fieldErrors, loginSchema, signupSchema } from './schemas';
import { clearedCookie, sessionCookie, tokenFromCookieHeader } from './session';

/** The body as the schema allows it, or a 400 that names each field that is wrong. */
function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ code: 'invalid_input', message: 'Some fields need attention.', fields: fieldErrors(result.error) });
  return result.data;
}

const address = (req: Request): string => req.ip ?? 'unknown';
const tokenOf = (req: Request) => tokenFromCookieHeader(req.headers.cookie);

@Controller()
@UseGuards(ClientGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(CONFIG) private readonly config: Config) {}

  @Post('auth/signup')
  async signup(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.reply(res, await this.auth.signup(parse(signupSchema, body), address(req)), 201);
  }

  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.reply(res, await this.auth.login(parse(loginSchema, body), address(req)), 200);
  }

  @Post('auth/logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(tokenOf(req), address(req));
    res.setHeader('Set-Cookie', clearedCookie(this.config.cookieSecure));
  }

  @Get('me')
  async me(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const me = await this.auth.me(tokenOf(req));
    res.setHeader('Cache-Control', 'no-store');
    if (!me) throw new UnauthorizedException('You are not signed in.');
    return me;
  }

  private reply(res: Response, signedIn: SignedIn, status: number) {
    res.status(status);
    res.setHeader('Set-Cookie', sessionCookie(signedIn.token, signedIn.maxAgeSeconds, this.config.cookieSecure));
    res.setHeader('Cache-Control', 'no-store');
    return { user: signedIn.user, organisations: signedIn.organisations };
  }
}
