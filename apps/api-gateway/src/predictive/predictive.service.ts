import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, desc } from 'drizzle-orm';
import { sensors, sensorReadings, assets, floors } from '@digital-twin-fm/db';

export interface SensorReadingRow {
  sensorId: string;
  assetId: string;
  type: string;
  unit: string;
  value: number;
  timestamp: string;
}

@Injectable()
export class PredictiveService {
  private readonly logger = new Logger(PredictiveService.name);

  constructor(@Inject('DB') private readonly db: NodePgDatabase) {}

  /**
   * Fetch minimal asset list (public, for ai-service health scoring).
   */
  async getAssets(): Promise<Array<{ id: string; name: string; type: string; floorLevel: number | null }>> {
    const rows = await this.db
      .select({
        id: assets.id,
        name: assets.name,
        type: assets.type,
        floorLevel: floors.level,
      })
      .from(assets)
      .leftJoin(floors, eq(assets.floorId, floors.id));
    return rows;
  }

  /**
   * Fetch recent sensor readings for all sensors belonging to an asset.
   */
  async getAssetReadings(assetId: string, hours: number = 2): Promise<SensorReadingRow[]> {
    const since = new Date(
      Date.now() - hours * 60 * 60 * 1000,
    ).toISOString();

    const assetSensors = await this.db
      .select()
      .from(sensors)
      .where(eq(sensors.assetId, assetId));

    if (assetSensors.length === 0) {
      return [];
    }

    const results: SensorReadingRow[] = [];

    for (const s of assetSensors) {
      const rows = await this.db
        .select({
          value: sensorReadings.value,
          timestamp: sensorReadings.timestamp,
        })
        .from(sensorReadings)
        .where(
          and(
            eq(sensorReadings.sensorId, s.id),
            gte(sensorReadings.timestamp, since),
          ),
        )
        .orderBy(desc(sensorReadings.timestamp))
        .limit(100);

      for (const r of rows) {
        results.push({
          sensorId: s.id,
          assetId,
          type: s.type,
          unit: s.unit ?? '',
          value: Number(r.value),
          timestamp: r.timestamp,
        });
      }
    }

    return results;
  }
}
