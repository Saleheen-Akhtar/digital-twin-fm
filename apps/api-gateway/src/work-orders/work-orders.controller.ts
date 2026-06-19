import { Controller, Get, Post, Param, Patch, Body, Query, NotFoundException } from '@nestjs/common';
import { WorkOrdersService, ListWorkOrdersFilter } from './work-orders.service';
import { WorkOrderDto } from './dto/work-order.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';

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

  @Post()
  create(@Body() dto: CreateWorkOrderDto): Promise<WorkOrderDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkOrderDto): Promise<WorkOrderDto> {
    return this.service.update(id, dto);
  }
}
