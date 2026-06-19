import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { buildings } from '@digital-twin-fm/db';
import type { Building } from '@digital-twin-fm/types';

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
}
