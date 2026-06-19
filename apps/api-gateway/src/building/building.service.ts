import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import {
  buildingSnapshots,
  assets,
  sensors,
  alerts,
  sensorReadings,
} from '@digital-twin-fm/db';

export interface BuildingSnapshot {
  healthScore: number;
  totalAssets: number;
  onlineAssets: number;
  warningAssets: number;
  criticalAssets: number;
  offlineAssets: number;
  activeAlerts: number;
  criticalAlerts: number;
  sensorUptime: number;
  totalSensors: number;
  onlineSensors: number;
  avgEnergyKw: number;
  computedAt: string;
}

export interface SnapshotHistoryEntry {
  healthScore: number;
  computedAt: string;
}

@Injectable()
export class BuildingService {
  constructor(@Inject('DB') private readonly db: NodePgDatabase) {}

  /**
   * Get the latest building snapshot (health score with breakdown).
   */
  async getLatestSnapshot(buildingId: string): Promise<BuildingSnapshot | null> {
    const rows = await this.db
      .select()
      .from(buildingSnapshots)
      .where(eq(buildingSnapshots.buildingId, buildingId))
      .orderBy(desc(buildingSnapshots.computedAt))
      .limit(1);

    if (!rows.length) {
      // No snapshot exists yet — compute one on the fly
      return this.computeAndStoreSnapshot(buildingId);
    }

    const s = rows[0];
    return {
      healthScore: s.healthScore,
      totalAssets: s.totalAssets ?? 0,
      onlineAssets: s.onlineAssets ?? 0,
      warningAssets: s.warningAssets ?? 0,
      criticalAssets: s.criticalAssets ?? 0,
      offlineAssets: s.offlineAssets ?? 0,
      activeAlerts: s.activeAlerts ?? 0,
      criticalAlerts: s.criticalAlerts ?? 0,
      sensorUptime: s.sensorUptime ?? 0,
      totalSensors: s.totalSensors ?? 0,
      onlineSensors: s.onlineSensors ?? 0,
      avgEnergyKw: s.avgEnergyKw ?? 0,
      computedAt: s.computedAt,
    };
  }

  /**
   * Get health score history for the last N hours (for trend sparkline).
   */
  async getSnapshotHistory(
    buildingId: string,
    hours: number = 24,
  ): Promise<SnapshotHistoryEntry[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const rows = await this.db
      .select({
        healthScore: buildingSnapshots.healthScore,
        computedAt: buildingSnapshots.computedAt,
      })
      .from(buildingSnapshots)
      .where(
        and(
          eq(buildingSnapshots.buildingId, buildingId),
          gte(buildingSnapshots.computedAt, cutoff),
        ),
      )
      .orderBy(desc(buildingSnapshots.computedAt))
      .limit(288); // max 288 entries = 24h at 5-min intervals

    return rows.map((r) => ({
      healthScore: r.healthScore,
      computedAt: r.computedAt,
    }));
  }

  /**
   * Compute a health score snapshot from current DB state and store it.
   */
  async computeAndStoreSnapshot(
    buildingId: string,
  ): Promise<BuildingSnapshot> {
    // Gather all metrics in parallel
    const assetStats = await this.db
      .select({
        total: sql<number>`count(*)`.as('total'),
        ok: sql<number>`count(*) filter (where status = 'ok')`.as('ok'),
        warning: sql<number>`count(*) filter (where status = 'warning')`.as('warning'),
        critical: sql<number>`count(*) filter (where status = 'critical')`.as('critical'),
      })
      .from(assets)
      .where(eq(assets.buildingId, buildingId))
      .then((r) => r[0] ?? { total: 0, ok: 0, warning: 0, critical: 0 });

    const sensorStats = await this.db
      .select({
        total: sql<number>`count(*)`.as('total'),
        online: sql<number>`count(*) filter (where last_reading_at > now() - interval '5 minutes')`.as('online'),
      })
      .from(sensors)
      .then((r) => r[0] ?? { total: 0, online: 0 });

    const alertStats = await this.db
      .select({
        active: sql<number>`count(*)`.as('active'),
        critical: sql<number>`count(*) filter (where severity = 'critical')`.as('critical'),
      })
      .from(alerts)
      .where(
        sql`status NOT IN ('cancelled', 'resolved', 'closed')`,
      )
      .then((r) => r[0] ?? { active: 0, critical: 0 });

    const energyResult = await this.db
      .select({
        avgKw: sql<number>`coalesce(avg(sr.value), 0)`.as('avg_kw'),
      })
      .from(sensorReadings)
      .innerJoin(sensors, sql`${sensors.id} = ${sensorReadings.sensorId}`)
      .where(
        and(
          sql`${sensors.type} = 'power'`,
          gte(sensorReadings.timestamp, new Date(Date.now() - 15 * 60 * 1000).toISOString()),
        ),
      )
      .then((r) => r[0] ?? { avgKw: 0 });

    // ── Balanced health score formula ──
    // Base from online assets  (max 50)
    const assetBase = assetStats.total > 0
      ? (assetStats.ok / assetStats.total) * 50
      : 0;
    // Penalties for warning/critical assets (max -25)
    const warningPen = assetStats.warning * 3;
    const criticalPen = assetStats.critical * 10;
    const assetPenalty = Math.min(warningPen + criticalPen, 25);
    // Alert burden (max -15)
    const alertPenalty = Math.min(
      alertStats.critical * 4 + alertStats.active * 0.5, 15
    );
    // Sensor bonus (max +20)
    const sensorBonus = sensorStats.total > 0
      ? (sensorStats.online / sensorStats.total) * 20
      : 0;
    // Energy efficiency bonus (max +5 if under 50 kW avg)
    const energyBonus = energyResult.avgKw > 0 && energyResult.avgKw < 50
      ? 5
      : 0;

    const healthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(assetBase + sensorBonus + energyBonus - assetPenalty - alertPenalty),
      ),
    );

    const offline =
      assetStats.total - assetStats.ok - assetStats.warning - assetStats.critical;
    const sensorUptime = sensorStats.total > 0
      ? Math.round((sensorStats.online / sensorStats.total) * 1000) / 10
      : 0;

    const row = await this.db
      .insert(buildingSnapshots)
      .values({
        buildingId,
        healthScore,
        totalAssets: assetStats.total,
        onlineAssets: assetStats.ok,
        warningAssets: assetStats.warning,
        criticalAssets: assetStats.critical,
        offlineAssets: offline,
        activeAlerts: alertStats.active,
        criticalAlerts: alertStats.critical,
        sensorUptime,
        totalSensors: sensorStats.total,
        onlineSensors: sensorStats.online,
        avgEnergyKw: Math.round(energyResult.avgKw * 100) / 100,
      })
      .returning()
      .then((r) => r[0]);

    return {
      healthScore: row.healthScore,
      totalAssets: row.totalAssets,
      onlineAssets: row.onlineAssets,
      warningAssets: row.warningAssets,
      criticalAssets: row.criticalAssets,
      offlineAssets: row.offlineAssets,
      activeAlerts: row.activeAlerts,
      criticalAlerts: row.criticalAlerts,
      sensorUptime: row.sensorUptime ?? 0,
      totalSensors: row.totalSensors,
      onlineSensors: row.onlineSensors,
      avgEnergyKw: row.avgEnergyKw ?? 0,
      computedAt: row.computedAt,
    };
  }
}
