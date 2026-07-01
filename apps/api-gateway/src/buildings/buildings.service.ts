import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray } from 'drizzle-orm';
import { buildings, floors, rooms } from '@digital-twin-fm/db';
import type { Building, Floor, Room } from '@digital-twin-fm/types';

@Injectable()
export class BuildingsService {
  constructor(@Inject('DB') private readonly db: NodePgDatabase) {}

  async findAll(): Promise<Building[]> {
    return this.db.select().from(buildings);
  }

  async findOne(id: string): Promise<Building | null> {
    const rows = await this.db.select().from(buildings).where(eq(buildings.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findFloorsWithRooms(buildingId: string): Promise<Floor[]> {
    const floorRows = await this.db
      .select()
      .from(floors)
      .where(eq(floors.buildingId, buildingId))
      .orderBy(floors.level);

    const floorIds = floorRows.map((f) => f.id);
    if (floorIds.length === 0) return [];

    const roomRows = await this.db
      .select()
      .from(rooms)
      .where(inArray(rooms.floorId, floorIds));

    return floorRows.map((f) => ({
      id: f.id,
      buildingId: f.buildingId,
      level: f.level,
      name: f.name,
      rooms: roomRows.filter((r) => r.floorId === f.id),
    }));
  }

  async updateZone(
    buildingId: string,
    floorId: string,
    zoneId: string,
    dto: { name?: string; color?: string },
  ): Promise<Room | null> {
    // Verify the zone belongs to a floor that belongs to the specified building
    const matchingFloor = await this.db
      .select()
      .from(floors)
      .where(and(eq(floors.id, floorId), eq(floors.buildingId, buildingId)))
      .limit(1);

    if (!matchingFloor[0]) return null;

    const updateFields: Record<string, string> = {};
    if (dto.name !== undefined) updateFields.name = dto.name;
    if (dto.color !== undefined) updateFields.color = dto.color;

    if (Object.keys(updateFields).length === 0) {
      // No-op — return the existing room
      const existing = await this.db
        .select()
        .from(rooms)
        .where(and(eq(rooms.id, zoneId), eq(rooms.floorId, floorId)))
        .limit(1);
      return existing[0] ?? null;
    }

    const [updated] = await this.db
      .update(rooms)
      .set(updateFields)
      .where(and(eq(rooms.id, zoneId), eq(rooms.floorId, floorId)))
      .returning();

    if (!updated) return null;

    return {
      id: updated.id,
      floorId: updated.floorId,
      name: updated.name,
      color: updated.color,
    };
  }
}
