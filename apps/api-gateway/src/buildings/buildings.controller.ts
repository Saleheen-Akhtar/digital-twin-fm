import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { BuildingDto } from './dto/building.dto';

@Controller('buildings')
export class BuildingsController {
  constructor(private readonly service: BuildingsService) {}

  @Get()
  findAll(): Promise<BuildingDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<BuildingDto> {
    const building = await this.service.findOne(id);
    if (!building) throw new NotFoundException(`Building ${id} not found`);
    return building;
  }
}
