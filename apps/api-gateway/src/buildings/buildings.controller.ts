import { Controller, Get, Param, Patch, Body, NotFoundException } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import type { Building, Floor, Room } from '@digital-twin-fm/types';

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

  @Get(':id/floors')
  async findFloors(@Param('id') id: string): Promise<Floor[]> {
    const building = await this.service.findOne(id);
    if (!building) throw new NotFoundException(`Building ${id} not found`);
    return this.service.findFloorsWithRooms(id);
  }

  @Patch(':buildingId/floors/:floorId/zones/:zoneId')
  async updateZone(
    @Param('buildingId') buildingId: string,
    @Param('floorId') floorId: string,
    @Param('zoneId') zoneId: string,
    @Body() dto: { name?: string; color?: string },
  ): Promise<Room> {
    const room = await this.service.updateZone(buildingId, floorId, zoneId, dto);
    if (!room) throw new NotFoundException(`Zone ${zoneId} not found under the specified building/floor`);
    return room;
  }
}
