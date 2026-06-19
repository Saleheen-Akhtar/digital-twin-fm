import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opt a handler or controller out of JWT verification.
 *
 *   @Public()
 *   @Get('health')
 *   check() { ... }
 *
 * Routes that do NOT have @Public() are protected by the global JwtAuthGuard
 * (registered in AppModule via APP_GUARD).
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Global JWT guard. Registered as APP_GUARD in AppModule so it applies to
 * every controller without per-controller boilerplate.
 *
 * @Public() opt-out short-circuits to `true`. Everything else falls through
 * to Passport's AuthGuard('jwt') which validates the Bearer token signature,
 * expiry, audience, and issuer.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
