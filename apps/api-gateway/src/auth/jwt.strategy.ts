import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export type AppRole = 'admin' | 'facility_manager' | 'technician' | 'viewer';

export interface JwtPayload {
  sub: string;
  email: string;
  role: AppRole;
  iat: number;
  exp: number;
  iss: string;
  aud: string | string[];
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AppRole;
}

/**
 * JWT strategy — validates access tokens issued by /auth/login.
 *
 * Tokens are HS256-signed, with aud="digital-twin-fm.web" and
 * iss="digital-twin-fm.api-gateway". The same values are set at sign time
 * (see AuthService.login). If the token is expired, has the wrong audience,
 * wrong issuer, or wrong signature, Passport returns 401 to the caller.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const accessSecret = config.get<string>('jwt.accessSecret');
    if (!accessSecret) {
      throw new Error('jwt.accessSecret is not configured — cannot start JwtStrategy');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
      audience: 'digital-twin-fm.web',
      issuer: 'digital-twin-fm.api-gateway',
      algorithms: ['HS256'],
    });
  }

  /**
   * Called by Passport after the token signature, expiry, audience and
   * issuer have all been validated. Returning a truthy object attaches
   * `req.user` for downstream handlers; throwing forces a 401.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
