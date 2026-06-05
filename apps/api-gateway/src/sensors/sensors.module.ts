import { Module } from '@nestjs/common';
import { SensorsController } from './sensors.controller';
import { SensorReadingsController } from './sensor-readings.controller';
import { SensorsService } from './sensors.service';

@Module({
  controllers: [SensorsController, SensorReadingsController],
  providers: [SensorsService],
  exports: [SensorsService],
})
export class SensorsModule {}
