import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';

/**
 * Custom throttler guard that:
 *
 *  1. **Skips throttling for authenticated GET requests.** The dashboard
 *     polls `/sensors`, `/sensors/:id/readings`, `/alerts`, and
 *     `/buildings` on every render / refresh. A single user opening
 *     `/dashboard` triggers ~5-15 parallel API calls, and the live
 *     monitoring panel polls `/sensors/:id/readings` every 30 seconds.
 *     A flat 60 req/min ceiling punishes legitimate use.
 *
 *     Per the user's audit fix, "Authenticated read traffic is trusted
 *     by definition — JWT already validated before the guard runs." So
 *     we skip throttling for `req.user && req.method === 'GET'`.
 *
 *  2. **Tracks the bucket by `req.user.id` when authenticated, else by
 *     IP.** Two users behind the same NAT don't share a bucket. Public
 *     endpoints (which haven't been rejected by JwtAuthGuard because
 *     they're `@Public()`) still bucket by IP.
 *
 *  3. **Keeps all non-GET methods throttled.** Write traffic
 *     (POST/PUT/PATCH/DELETE) is never skipped, even for authenticated
 *     users — this is the brute-force / state-tampering floor.
 *
 * SECURITY MODEL (unchanged):
 *   - `/auth/login` and `/auth/refresh` are `@Public()` and writeable,
 *     so they hit the per-route `@Throttle({ auth: { ttl: 60_000, limit: 5 } })`
 *     binding. They are NEVER skipped (they're POST, not GET).
 *   - Unauthenticated requests to protected endpoints are rejected by
 *     JwtAuthGuard before this guard runs (APP_GUARD ordering ensures
 *     JwtAuthGuard → ThrottlerGuard).
 */
@Injectable()
export class ThrottlerBehindAuthGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    // Only skip for GETs from an authenticated user. POST/PUT/PATCH/DELETE
    // always go through throttling, and unauthenticated requests (which
    // reached us because they're @Public() or because the request came
    // through to a non-Guard-protected path) are also throttled.
    if (req?.user && req?.method === 'GET') return true;
    return false;
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    // Authenticated: bucket per user (multi-user NATs don't collide).
    // Unauthenticated: bucket per IP (the standard web DoS defense).
    const user = req?.user as { id?: string } | undefined;
    if (user?.id) return Promise.resolve(`user:${user.id}`);
    const ip = (req?.ip as string | undefined) ?? 'unknown';
    return Promise.resolve(`ip:${ip}`);
  }
}
