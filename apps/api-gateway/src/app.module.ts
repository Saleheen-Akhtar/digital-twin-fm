import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { BuildingsModule } from './buildings/buildings.module';
import { AssetsModule } from './assets/assets.module';
import { SensorsModule } from './sensors/sensors.module';
import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [ConfigModule, DbModule, AuthModule, BuildingsModule, AssetsModule, SensorsModule, AlertsModule],
  controllers: [HealthController],
})
export class AppModule {}
