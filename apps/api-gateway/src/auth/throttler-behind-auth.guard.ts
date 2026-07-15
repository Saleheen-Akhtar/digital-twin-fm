import { ThrottlerGuard } from '@nestjs/throttler';
import { THROTTLER_SKIP } from '@nestjs/throttler/dist/throttler.constants';
import { THROTTLER_OPTIONS } from '@nestjs/throttler/dist/throttler.constants';
import { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';
import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

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
 *  2. **Honors @SkipThrottle() for internal service-to-service reads.**
 *     The ai-service fans out to `/predictive/sensor-readings/:id` once
 *     per asset (43 GETs) with no JWT. Without honoring @SkipThrottle(),
 *     those unauthenticated calls hit the burst limit (20 req/s) and
 *     ~half 429 → "Insufficient data" on the predictive tab. The base
 *     guard only consults the @SkipThrottle() metadata inside
 *     canActivate() AFTER shouldSkip() returns false, so an
 *     unconditionally-false shouldSkip() would make the decorator dead
 *     for unauthenticated traffic. We check it here explicitly.
 *
 *  3. **Tracks the bucket by `req.user.id` when authenticated, else by
 *     IP.** Two users behind the same NAT don't share a bucket. Public
 *     endpoints still bucket by IP.
 *
 *  4. **Keeps all non-GET methods throttled.** Write traffic
 *     (POST/PUT/PATCH/DELETE) is never skipped, even for authenticated
 *     users — this is the brute-force / state-tampering floor.
 */
@Injectable()
export class ThrottlerBehindAuthGuard extends ThrottlerGuard {
  constructor(
    @Inject(THROTTLER_OPTIONS) options: unknown,
    @Inject(ThrottlerStorage) storageService: unknown,
    @Inject(Reflector) refl: Reflector,
  ) {
    // ThrottlerGuard's constructor signature is (options, storage, reflector).
    // We re-inject the same tokens and forward them so the base class stays
    // fully initialized (its own reflector is private, so we keep our own
    // under a non-clashing name).
    super(options as never, storageService as never, refl as never);
    this.localReflector = refl;
  }

  private readonly localReflector: Reflector;

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    // Authenticated GETs: trusted by definition, never throttle.
    if (req?.user && req?.method === 'GET') return true;

    // Unauthenticated GETs: honor @SkipThrottle() (internal reads).
    // `@SkipThrottle()` (no args) writes metadata under the key
    // THROTTLER:SKIP + 'default' (see throttler.decorator.js), so we
    // check that key. We also check each named throttler bucket for
    // completeness.
    if (req?.method === 'GET') {
      const handler = context.getHandler();
      const classRef = context.getClass();
      const keys = ['default', ...(this.throttlers ?? []).map((t) => t.name)];
      for (const key of keys) {
        const skip = this.localReflector.getAllAndOverride<boolean>(
          THROTTLER_SKIP + key,
          [handler, classRef],
        );
        if (skip) return true;
      }
    }
    return false;
  }
}
