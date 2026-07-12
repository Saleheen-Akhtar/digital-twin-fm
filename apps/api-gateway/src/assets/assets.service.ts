import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import { assets, floors, rooms, sensors, sensorReadings } from '@digital-twin-fm/db';
import type { Asset, AssetStatus, AssetType, Sensor, SensorReading } from '@digital-twin-fm/types';

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
  floorName: string | null;
  roomName: string | null;
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
        floorName: floors.name,
        roomName: rooms.name,
      })
      .from(assets)
      .leftJoin(floors, eq(assets.floorId, floors.id))
      .leftJoin(rooms, eq(assets.roomId, rooms.id))
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
        floorName: floors.name,
        roomName: rooms.name,
      })
      .from(assets)
      .leftJoin(floors, eq(assets.floorId, floors.id))
      .leftJoin(rooms, eq(assets.roomId, rooms.id))
      .where(eq(assets.id, id))
      .limit(1);
    return (rows[0] as AssetRow | undefined) ?? null;
  }

  async findSensorsWithReadings(assetId: string): Promise<{
    sensors: Sensor[];
    readingsBySensor: Record<string, SensorReading[]>;
    roomName: string | null;
    floorName: string | null;
    floorLevel: number | null;
  }> {
    const sensorRows = await this.db
      .select()
      .from(sensors)
      .where(eq(sensors.assetId, assetId));
    const allSensors = sensorRows as unknown as Sensor[];

    if (allSensors.length === 0) {
      return { sensors: [], readingsBySensor: {}, roomName: null, floorName: null, floorLevel: null };
    }

    // Batch-fetch latest readings: for each sensor, get the 10 most recent
    // Use raw SQL for the DISTINCT ON + LATERAL pattern Drizzle can't express
    const sensorIdLiterals = allSensors.map((s) => sql`${s.id}::uuid`);
    const inClause = sql.join(sensorIdLiterals, sql.raw(', '));

    const readings = await this.db.execute<{
      sensor_id: string;
      id: string;
      value: number;
      quality: string;
      timestamp: string;
    }>(
      sql`
        WITH latest AS (
          SELECT DISTINCT ON (sr.sensor_id)
            sr.sensor_id, sr.id, sr.value, sr.quality, sr.timestamp
          FROM ${sensorReadings} sr
          WHERE sr.sensor_id IN (${inClause})
          ORDER BY sr.sensor_id, sr.timestamp DESC
          LIMIT 10
        )
        SELECT * FROM latest ORDER BY sensor_id, timestamp DESC
      `,
    );

    const readingsBySensor: Record<string, SensorReading[]> = {};
    for (const r of readings.rows ?? []) {
      if (!readingsBySensor[r.sensor_id]) readingsBySensor[r.sensor_id] = [];
      readingsBySensor[r.sensor_id].push({
        id: r.id,
        sensorId: r.sensor_id,
        assetId,
        timestamp: r.timestamp,
        value: r.value,
        // unit lives on the sensor, not the reading — pair sensor.unit on the client
        quality: r.quality as any,
      });
    }

    // Get location context for the response
    const assetDetail = await this.findOne(assetId);

    return {
      sensors: allSensors,
      readingsBySensor,
      roomName: assetDetail?.roomName ?? null,
      floorName: assetDetail?.floorName ?? null,
      floorLevel: assetDetail?.floorLevel ?? null,
    };
  }
}
