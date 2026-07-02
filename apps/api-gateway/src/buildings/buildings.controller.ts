import { Controller, Get, Post, Delete, Param, Patch, Body, NotFoundException, ConflictException } from '@nestjs/common';
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

  // ─── Floor CRUD ────────────────────────────────

  @Post(':buildingId/floors')
  async createFloor(
    @Param('buildingId') buildingId: string,
    @Body() dto: { name: string; level: number },
  ): Promise<Floor> {
    const building = await this.service.findOne(buildingId);
    if (!building) throw new NotFoundException(`Building ${buildingId} not found`);
    try {
      return await this.service.createFloor(buildingId, dto);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        throw new ConflictException(`Floor level ${dto.level} already exists in this building`);
      }
      throw err;
    }
  }

  @Delete(':buildingId/floors/:floorId')
  async deleteFloor(
    @Param('buildingId') buildingId: string,
    @Param('floorId') floorId: string,
  ): Promise<{ deleted: boolean }> {
    const ok = await this.service.deleteFloor(buildingId, floorId);
    if (!ok) throw new NotFoundException(`Floor ${floorId} not found under building ${buildingId}`);
    return { deleted: true };
  }

  // ─── Zone CRUD ─────────────────────────────────

  @Post(':buildingId/floors/:floorId/zones')
  async createZone(
    @Param('buildingId') buildingId: string,
    @Param('floorId') floorId: string,
    @Body() dto: { name: string; color?: string },
  ): Promise<Room> {
    try {
      return await this.service.createZone(buildingId, floorId, dto);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('not found')) throw new NotFoundException(msg);
      throw err;
    }
  }

  @Delete(':buildingId/floors/:floorId/zones/:zoneId')
  async deleteZone(
    @Param('buildingId') buildingId: string,
    @Param('floorId') floorId: string,
    @Param('zoneId') zoneId: string,
  ): Promise<{ deleted: boolean }> {
    const ok = await this.service.deleteZone(buildingId, floorId, zoneId);
    if (!ok) throw new NotFoundException(`Zone ${zoneId} not found`);
    return { deleted: true };
  }

  // ─── Zone update ───────────────────────────────

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
