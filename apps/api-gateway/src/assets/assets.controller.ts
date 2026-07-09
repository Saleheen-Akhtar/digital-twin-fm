import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { Asset, Sensor, SensorReading } from '@digital-twin-fm/types';
import { AssetsService, ListAssetsFilter } from './assets.service';

@Controller('assets')
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get()
  findAll(@Query() q: ListAssetsFilter): Promise<Asset[]> {
    return this.service.findAll(q);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Asset> {
    const a = await this.service.findOne(id);
    if (!a) throw new NotFoundException(`Asset ${id} not found`);
    return a;
  }

  @Get(':id/sensors')
  async findSensors(@Param('id') id: string): Promise<{ sensors: Sensor[]; readingsBySensor: Record<string, SensorReading[]> }> {
    const a = await this.service.findOne(id);
    if (!a) throw new NotFoundException(`Asset ${id} not found`);
    return this.service.findSensorsWithReadings(id);
  }
}
