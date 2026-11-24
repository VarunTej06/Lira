import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ZodType } from 'zod';
import { CONFIG, type Config } from '../config';
import { AuthService, type SignedIn } from './auth.service';
import { RecoveryService } from './recovery.service';
import { ClientGuard } from './client.guard';
import { GoogleLoginService, LOGIN_COOKIE } from './google-login.service';
import { fieldErrors, forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema, verifyEmailSchema } from './schemas';
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
  constructor(
    @Inject(AuthService) private readonly auth: AuthService, @Inject(CONFIG) private readonly config: Config,
    @Inject(GoogleLoginService) private readonly googleLogin: GoogleLoginService, @Inject(RecoveryService) private readonly recovery: RecoveryService,
  ) {}

  private get origin(): string { return this.config.allowedOrigins[0] ?? ''; }
  private loginCookie(value: string, maxAge: number): string { return `${LOGIN_COOKIE}=${value}; Max-Age=${maxAge}; Path=/api/auth/google; HttpOnly; SameSite=Lax${this.config.cookieSecure ? '; Secure' : ''}`; }

  /** Which ways of signing in this server offers, so the page shows only buttons that work. */
  @Get('auth/providers')
  providers() { return { google: this.googleLogin.enabled, email: this.recovery.enabled }; }

  /** Sends the browser to Google to sign in or sign up. */
  @Get('auth/google/start')
  googleStart(@Query('intent') intent: string | undefined, @Res() res: Response) {
    if (!this.googleLogin.enabled) return res.redirect(302, `${this.origin}/login?error=google`);
    const started = this.googleLogin.start(intent === 'signup' ? 'signup' : 'login');
    res.setHeader('Set-Cookie', this.loginCookie(started.cookie, started.maxAgeSeconds));
    return res.redirect(302, started.url);
  }

  /** Google sends the browser back here with a code. Every check passes, or the person is sent to the log-in page with a plain message. */
  @Get('auth/google/callback')
  async googleCallback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Query('error') error: string | undefined, @Req() req: Request, @Res() res: Response) {
    const cleared = this.loginCookie('', 0);
    const failed = () => { res.setHeader('Set-Cookie', cleared); return res.redirect(302, `${this.origin}/login?error=google`); };
    if (!this.googleLogin.enabled || error || !code || !state) return failed();
    const signedIn = await this.googleLogin.finish(code, state, new RegExp(`(?:^|; )${LOGIN_COOKIE}=([^;]*)`).exec(req.headers.cookie ?? '')?.[1], address(req));
    if (!signedIn) return failed();
    res.setHeader('Set-Cookie', [sessionCookie(signedIn.token, signedIn.maxAgeSeconds, this.config.cookieSecure), cleared]);
    return res.redirect(302, `${this.origin}/app`);
  }

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

  /** Confirms the address the link was sent to. */
  @Post('auth/verify-email')
  @HttpCode(204)
  async verifyEmail(@Body() body: unknown, @Req() req: Request) {
    await this.recovery.verify(parse(verifyEmailSchema, body).token, address(req));
  }

  /** The signed-in person asks for a new confirmation link. */
  @Post('auth/resend-verification')
  @HttpCode(204)
  async resendVerification(@Req() req: Request) {
    const me = await this.auth.me(tokenOf(req));
    if (!me) throw new UnauthorizedException('You are not signed in.');
    await this.recovery.resendVerification(me.user);
  }

  /** Same answer whether or not the address has an account. */
  @Post('auth/forgot-password')
  @HttpCode(204)
  async forgotPassword(@Body() body: unknown, @Req() req: Request) {
    await this.recovery.forgot(parse(forgotPasswordSchema, body).email, address(req));
  }

  @Post('auth/reset-password')
  @HttpCode(204)
  async resetPassword(@Body() body: unknown, @Req() req: Request) {
    const input = parse(resetPasswordSchema, body);
    await this.recovery.reset(input.token, input.password, address(req));
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
