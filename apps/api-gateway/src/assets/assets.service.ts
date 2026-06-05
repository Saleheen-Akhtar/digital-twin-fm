import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { assets } from '@digital-twin-fm/db';
import { AssetDto } from './dto/asset.dto';

export interface ListAssetsFilter {
  buildingId?: string;
  status?: string;
  type?: string;
}

@Injectable()
export class AssetsService {
  constructor(@Inject('DB') private readonly db: NodePgDatabase) {}

  async findAll(filter: ListAssetsFilter = {}): Promise<AssetDto[]> {
    const conditions = [];
    if (filter.buildingId) conditions.push(eq(assets.buildingId, filter.buildingId));
    if (filter.status) conditions.push(eq(assets.status, filter.status));
    if (filter.type) conditions.push(eq(assets.type, filter.type));
    const where = conditions.length === 0 ? undefined :
      conditions.length === 1 ? conditions[0] : and(...conditions);
    return this.db.select().from(assets).where(where);
  }

  async findOne(id: string): Promise<AssetDto | null> {
    const rows = await this.db.select().from(assets).where(eq(assets.id, id)).limit(1);
    return rows[0] ?? null;
  }
}
