import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { assets, floors } from '@digital-twin-fm/db';
import type { Asset, AssetStatus, AssetType } from '@digital-twin-fm/types';

export interface ListAssetsFilter {
  buildingId?: string;
  status?: AssetStatus;
  type?: AssetType;
}

interface AssetRow {
  id: string;
  buildingId: string;
  floorId: string | null;
  roomId: string | null;
  name: string;
  type: AssetType;
  status: AssetStatus;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  installedAt: string | null;
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  createdAt: string;
  updatedAt: string;
  floorLevel: number | null;
}

@Injectable()
export class AssetsService {
  constructor(@Inject('DB') private readonly db: NodePgDatabase) {}

  async findAll(filter: ListAssetsFilter = {}): Promise<AssetRow[]> {
    const conditions = [];
    if (filter.buildingId) conditions.push(eq(assets.buildingId, filter.buildingId));
    if (filter.status) conditions.push(eq(assets.status, filter.status));
    if (filter.type) conditions.push(eq(assets.type, filter.type));
    const where = conditions.length === 0 ? undefined :
      conditions.length === 1 ? conditions[0] : and(...conditions);

    const rows = await this.db
      .select({
        id: assets.id,
        buildingId: assets.buildingId,
        floorId: assets.floorId,
        roomId: assets.roomId,
        name: assets.name,
        type: assets.type,
        status: assets.status,
        manufacturer: assets.manufacturer,
        model: assets.model,
        serialNumber: assets.serialNumber,
        installedAt: assets.installedAt,
        positionX: assets.positionX,
        positionY: assets.positionY,
        positionZ: assets.positionZ,
        createdAt: assets.createdAt,
        updatedAt: assets.updatedAt,
        floorLevel: floors.level,
      })
      .from(assets)
      .leftJoin(floors, eq(assets.floorId, floors.id))
      .where(where);

    return rows as AssetRow[];
  }

  async findOne(id: string): Promise<Asset | null> {
    const rows = await this.db
      .select({
        id: assets.id,
        buildingId: assets.buildingId,
        floorId: assets.floorId,
        roomId: assets.roomId,
        name: assets.name,
        type: assets.type,
        status: assets.status,
        manufacturer: assets.manufacturer,
        model: assets.model,
        serialNumber: assets.serialNumber,
        installedAt: assets.installedAt,
        positionX: assets.positionX,
        positionY: assets.positionY,
        positionZ: assets.positionZ,
        createdAt: assets.createdAt,
        updatedAt: assets.updatedAt,
        floorLevel: floors.level,
      })
      .from(assets)
      .leftJoin(floors, eq(assets.floorId, floors.id))
      .where(eq(assets.id, id))
      .limit(1);
    return (rows[0] as AssetRow | undefined) ?? null;
  }
}
