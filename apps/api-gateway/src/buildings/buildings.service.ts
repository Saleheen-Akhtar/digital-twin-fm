import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { buildings } from '@digital-twin-fm/db';
import { BuildingDto } from './dto/building.dto';

@Injectable()
export class BuildingsService {
  constructor(@Inject('DB') private readonly db: NodePgDatabase) {}

  async findAll(): Promise<BuildingDto[]> {
    return this.db.select().from(buildings);
  }

  async findOne(id: string): Promise<BuildingDto | null> {
    const rows = await this.db.select().from(buildings).where(eq(buildings.id, id)).limit(1);
    return rows[0] ?? null;
  }
}
