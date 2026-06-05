import { Controller, Get, Param, Query } from '@nestjs/common';
import { SensorsService, ListReadingsFilter } from './sensors.service';
import { SensorReadingDto } from './dto/sensor.dto';

@Controller('sensors/:sensorId/readings')
export class SensorReadingsController {
  constructor(private readonly service: SensorsService) {}

  @Get()
  findAll(
    @Param('sensorId') sensorId: string,
    @Query() q: Omit<ListReadingsFilter, 'sensorId'>,
  ): Promise<SensorReadingDto[]> {
    return this.service.findReadings({ sensorId, ...q });
  }
}
