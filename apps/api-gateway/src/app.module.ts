import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { BuildingsModule } from './buildings/buildings.module';
import { AssetsModule } from './assets/assets.module';
import { SensorsModule } from './sensors/sensors.module';
import { AlertsModule } from './alerts/alerts.module';
import { RealtimeModule } from './ws/realtime.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { BuildingModule } from './building/building.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { ThrottlerBehindAuthGuard } from './auth/throttler-behind-auth.guard';

/**
 * Throttler bucket design.
 *
 * Per Finding 6 (High) + dashboard-polling follow-up:
 *
 *   ┌────────────┬──────────────┬─────────────┬──────────────────────┐
 *   │ bucket     │ window       │ limit       │ covers               │
 *   ├────────────┼──────────────┼─────────────┼──────────────────────┤
 *   │ burst      │ 1 second     │ 20 req      │ fast dashboard poll  │
 *   │ sustained  │ 1 minute     │ 300 req     │ full page refresh    │
 *   └────────────┴──────────────┴─────────────┴──────────────────────┘
 *
 * IMPORTANT: globally-defined throttlers in forRoot() apply to EVERY
 * route.  Do NOT add an `auth` bucket here — it would rate-limit all
 * non-GET endpoints (PATCH /alerts/:id, POST /work-orders, etc.).
 * Auth-specific rate limits are applied per-route via @Throttle() in
 * auth.controller.ts, which overrides the global buckets for those
 * endpoints only.
 *
 * Why these numbers, not the defaults?
 *
 *   - The dashboard polls `/sensors/:id/readings` every 30s. With 4-10
 *     sensors and a layout with several panels, one page load is
 *     10-15 API calls. `sustained = 300/min` leaves a 20x headroom
 *     over normal use and still catches scrapers (a human will not
 *     make 300 requests in 60s).
 *   - `burst = 20/sec` absorbs the synchronous waterfall of one page
 *     load (which fires Promise.all on 4-5 endpoints simultaneously).
 *     The previous `short = 5/sec` triggered 429 on the second page
 *     load.
 *   - Authenticated GETs are skipped by `ThrottlerBehindAuthGuard` — see
 *     that file for the full rationale.
 * that file for the full rationale.
 */
@Module({
  imports: [
    ConfigModule,
    DbModule,
    AuthModule,
    BuildingsModule,
    AssetsModule,
    SensorsModule,
    AlertsModule,
    RealtimeModule,
    WorkOrdersModule,
    BuildingModule,
    ThrottlerModule.forRoot([
      { name: 'burst', ttl: 1_000, limit: 20 },
      { name: 'sustained', ttl: 60_000, limit: 300 },
    ]),
  ],
  controllers: [HealthController],
  providers: [
    // Order matters. JwtAuthGuard MUST run before ThrottlerBehindAuthGuard
    // so that `req.user` is populated when the throttler decides whether
    // to skip (for authenticated GETs) or throttle (for writes + anon).
    //
    // Per Finding 4 (Critical): every business endpoint is now protected
    // by JwtAuthGuard. Routes can opt out with @Public(). RolesGuard runs
    // last so any @Roles('admin', ...) route is additionally role-checked.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerBehindAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
