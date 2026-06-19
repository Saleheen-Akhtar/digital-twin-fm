import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { SensorDto } from './dto/sensor.dto';

@Controller('sensors')
export class SensorsController {
  constructor(private readonly service: SensorsService) {}

  @Get()
  findAll(): Promise<SensorDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<SensorDto> {
    const s = await this.service.findOne(id);
    if (!s) throw new NotFoundException(`Sensor ${id} not found`);
    return s;
  }
}
