import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
