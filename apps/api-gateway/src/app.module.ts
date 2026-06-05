import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { BuildingsModule } from './buildings/buildings.module';
import { AssetsModule } from './assets/assets.module';
import { SensorsModule } from './sensors/sensors.module';
import { AlertsModule } from './alerts/alerts.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    AuthModule,
    BuildingsModule,
    AssetsModule,
    SensorsModule,
    AlertsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Per Finding 4 (Critical): every business endpoint is now protected by
    // JwtAuthGuard. Routes can opt out with @Public(). RolesGuard runs after
    // JwtAuthGuard so req.user is set, and any @Roles('admin', ...) route is
    // additionally role-checked.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
