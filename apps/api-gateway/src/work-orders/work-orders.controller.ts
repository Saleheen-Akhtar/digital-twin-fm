import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { WorkOrdersService, ListWorkOrdersFilter } from './work-orders.service';
import { WorkOrderDto } from './dto/work-order.dto';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly service: WorkOrdersService) {}

  @Get()
  findAll(@Query() q: ListWorkOrdersFilter): Promise<WorkOrderDto[]> {
    return this.service.findAll(q);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<WorkOrderDto> {
    const wo = await this.service.findOne(id);
    if (!wo) throw new NotFoundException(`Work order ${id} not found`);
    return wo;
  }
}
