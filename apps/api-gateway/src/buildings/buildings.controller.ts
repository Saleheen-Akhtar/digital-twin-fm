import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import type { Building } from '@digital-twin-fm/types';

@Controller('buildings')
export class BuildingsController {
  constructor(private readonly service: BuildingsService) {}

  @Get()
  findAll(): Promise<Building[]> {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Building> {
    const building = await this.service.findOne(id);
    if (!building) throw new NotFoundException(`Building ${id} not found`);
    return building;
  }
}
