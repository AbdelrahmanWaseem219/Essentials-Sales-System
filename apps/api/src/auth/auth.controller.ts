import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RegisterCustomerDto } from './dto/auth.dto';

const ACCESS_COOKIE = 'es_access';
const REFRESH_COOKIE = 'es_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private meta(req: Request) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  /** Set the access + refresh tokens as httpOnly cookies (invisible to JS, so
   *  immune to XSS token theft). Secure only in production (dev is plain http). */
  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const prod = this.config.get<string>('env') === 'production';
    const base = {
      httpOnly: true,
      secure: prod,
      sameSite: 'lax' as const,
      path: '/',
    };
    res.cookie(ACCESS_COOKIE, accessToken, {
      ...base,
      maxAge: (this.config.get<number>('jwt.accessTtl') ?? 900) * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...base,
      maxAge: (this.config.get<number>('jwt.refreshTtl') ?? 2592000) * 1000,
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  @Public()
  @Post('staff/login')
  async staffLogin(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, ...rest } = await this.auth.loginUser(dto, this.meta(req));
    this.setAuthCookies(res, accessToken, refreshToken);
    return rest; // { user } — tokens go in cookies, never the JS-readable body
  }

  @Public()
  @Post('customer/login')
  async customerLogin(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, ...rest } = await this.auth.loginCustomer(dto, this.meta(req));
    this.setAuthCookies(res, accessToken, refreshToken);
    return rest;
  }

  @Public()
  @Post('customer/register')
  async customerRegister(
    @Body() dto: RegisterCustomerDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, ...rest } = await this.auth.registerCustomer(dto, this.meta(req));
    this.setAuthCookies(res, accessToken, refreshToken);
    return rest;
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = (req as any).cookies?.[REFRESH_COOKIE] ?? (req.body as any)?.refreshToken;
    if (!rt) throw new UnauthorizedException('No refresh token');
    const tokens = await this.auth.refresh(rt, this.meta(req));
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { ok: true };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = (req as any).cookies?.[REFRESH_COOKIE] ?? (req.body as any)?.refreshToken;
    if (rt) await this.auth.logout(rt);
    this.clearAuthCookies(res);
    return { ok: true };
  }
}
