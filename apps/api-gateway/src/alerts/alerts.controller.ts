import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { AlertsService, ListAlertsFilter } from './alerts.service';
import { AlertDto } from './dto/alert.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  findAll(@Query() q: ListAlertsFilter): Promise<AlertDto[]> {
    return this.service.findAll(q);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AlertDto> {
    const a = await this.service.findOne(id);
    if (!a) throw new NotFoundException(`Alert ${id} not found`);
    return a;
  }
}
