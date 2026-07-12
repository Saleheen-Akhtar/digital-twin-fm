import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertEngineService } from './alert-engine.service';
import { RealtimeModule } from '../ws/realtime.module';

@Module({
  imports: [ScheduleModule.forRoot(), RealtimeModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertEngineService],
  exports: [AlertsService],
})
export class AlertsModule {}
