import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppRole, AuthenticatedUser } from './jwt.strategy';

export const ROLES_KEY = 'roles';

/**
 * Require one of the given roles. Use after JwtAuthGuard has set req.user.
 *
 *   @Roles('admin', 'facility_manager')
 *   @Delete(':id')
 *   remove() { ... }
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    // No @Roles() on the route → no role restriction (still requires JWT).
    if (!required || required.length === 0) {
      return true;
    }
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user || !required.includes(req.user.role)) {
      throw new ForbiddenException('Insufficient role for this resource');
    }
    return true;
  }
}
