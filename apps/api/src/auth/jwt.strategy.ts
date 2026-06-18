import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../common/decorators/current-user.decorator';

/** Read the access token from the httpOnly cookie (primary) so it's never exposed
 *  to JavaScript; fall back to the Authorization header for API clients/tests. */
const cookieExtractor = (req: Request): string | null =>
  (req as any)?.cookies?.es_access ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret'),
    });
  }

  /** The payload returned here is attached to request.user. */
  async validate(payload: AuthUser): Promise<AuthUser> {
    return {
      sub: payload.sub,
      role: payload.role,
      type: payload.type,
      email: payload.email,
    };
  }
}
