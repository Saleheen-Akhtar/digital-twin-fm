import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import {
  buildingSnapshots,
  buildings,
  assets,
  sensors,
  alerts,
  sensorReadings,
  workOrders,
  floors,
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
  activeAlerts: number;
  onlineAssets: number;
  avgEnergyKw: number;
  computedAt: string;
}

export interface BuildingAiContextAsset {
  id: string;
  name: string;
  type: string;
  status: string;
  floorLevel: number | null;
}

export interface BuildingAiContextSensor {
  id: string;
  type: string;
  unit: string;
  lastValue: number | null;
  lastReadingAt: string | null;
  assetName: string;
  assetType: string;
  floorLevel: number | null;
  isLive: boolean;
}

export interface BuildingAiContextAlert {
  id: string;
  title: string;
  severity: string;
  status: string;
  assetId: string | null;
  assetName: string | null;
  createdAt: string;
}

export interface BuildingAiContextWorkOrder {
  id: string;
  title: string;
  status: string;
  priority: string;
  assetId: string;
  assetName: string | null;
}

export interface BuildingAiContext {
  buildingId: string;
  buildingName: string;
  dataAsOf: string;
  snapshot: BuildingSnapshot;
  assets: BuildingAiContextAsset[];
  sensors: BuildingAiContextSensor[];
  alerts: BuildingAiContextAlert[];
  workOrders: BuildingAiContextWorkOrder[];
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

    if (rows.length > 0) {
      const s = rows[0];
      // If the cached snapshot is less than 60s old, serve it directly
      const age = Date.now() - new Date(s.computedAt).getTime();
      if (age < 60_000) {
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
    }

    // No cached snapshot, or stale (>= 60s old) — recompute
    return this.computeAndStoreSnapshot(buildingId);
  }

  /**
   * Get health score history for the last N hours (for trend sparkline).
   */
  async getSnapshotHistory(
    buildingId: string,
    hours: number = 24,
  ): Promise<SnapshotHistoryEntry[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().replace('Z', '');
    const rows = await this.db
      .select({
        healthScore: buildingSnapshots.healthScore,
        activeAlerts: buildingSnapshots.activeAlerts,
        onlineAssets: buildingSnapshots.onlineAssets,
        avgEnergyKw: buildingSnapshots.avgEnergyKw,
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
      activeAlerts: r.activeAlerts ?? 0,
      onlineAssets: r.onlineAssets ?? 0,
      avgEnergyKw: r.avgEnergyKw ?? 0,
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
        online: sql<number>`count(*) filter (where last_reading_at > now() at time zone 'utc' - interval '5 minutes')`.as('online'),
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
        avgKw: sql<number>`coalesce(avg(${sensorReadings}.value), 0)`.as('avg_kw'),
      })
      .from(sensorReadings)
      .innerJoin(sensors, sql`${sensors.id} = ${sensorReadings.sensorId}`)
      .where(
        and(
          sql`${sensors.type} = 'power'`,
          gte(sensorReadings.timestamp, new Date(Date.now() - 15 * 60 * 1000).toISOString().replace('Z', '')),
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

  /**
   * Build a rich, live context payload for the AI copilot.
   * Pulls snapshot metrics, assets, live sensor values, alerts, and work orders
   * scoped to the requested building.
   */
  async buildAiContext(buildingId: string): Promise<BuildingAiContext | null> {
    const buildingRows = await this.db
      .select({ id: buildings.id, name: buildings.name })
      .from(buildings)
      .where(eq(buildings.id, buildingId))
      .limit(1);

    if (!buildingRows.length) {
      return null;
    }

    const snapshot = await this.computeAndStoreSnapshot(buildingId);
    const liveCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const assetRows = await this.db
      .select({
        id: assets.id,
        name: assets.name,
        type: assets.type,
        status: assets.status,
        floorLevel: floors.level,
      })
      .from(assets)
      .leftJoin(floors, eq(assets.floorId, floors.id))
      .where(eq(assets.buildingId, buildingId));

    const sensorRows = await this.db
      .select({
        id: sensors.id,
        type: sensors.type,
        unit: sensors.unit,
        lastValue: sensors.lastValue,
        lastReadingAt: sensors.lastReadingAt,
        assetName: assets.name,
        assetType: assets.type,
        floorLevel: floors.level,
      })
      .from(sensors)
      .innerJoin(assets, eq(sensors.assetId, assets.id))
      .leftJoin(floors, eq(assets.floorId, floors.id))
      .where(eq(assets.buildingId, buildingId))
      .orderBy(desc(sensors.lastReadingAt))
      .limit(60);

    const alertRows = await this.db
      .select({
        id: alerts.id,
        message: alerts.message,
        severity: alerts.severity,
        status: alerts.status,
        assetId: alerts.assetId,
        assetName: assets.name,
        createdAt: alerts.createdAt,
      })
      .from(alerts)
      .innerJoin(assets, eq(alerts.assetId, assets.id))
      .where(
        and(
          eq(assets.buildingId, buildingId),
          sql`${alerts.status} NOT IN ('cancelled', 'resolved', 'closed')`,
        ),
      )
      .orderBy(desc(alerts.createdAt))
      .limit(20);

    const workOrderRows = await this.db
      .select({
        id: workOrders.id,
        title: workOrders.title,
        status: workOrders.status,
        priority: workOrders.priority,
        assetId: workOrders.assetId,
        assetName: assets.name,
      })
      .from(workOrders)
      .innerJoin(assets, eq(workOrders.assetId, assets.id))
      .where(
        and(
          eq(assets.buildingId, buildingId),
          sql`${workOrders.status} NOT IN ('completed', 'cancelled')`,
        ),
      )
      .orderBy(desc(workOrders.createdAt))
      .limit(10);

    return {
      buildingId,
      buildingName: buildingRows[0].name,
      dataAsOf: new Date().toISOString(),
      snapshot,
      assets: assetRows.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        status: a.status,
        floorLevel: a.floorLevel,
      })),
      sensors: sensorRows.map((s) => ({
        id: s.id,
        type: s.type,
        unit: s.unit,
        lastValue: s.lastValue,
        lastReadingAt: s.lastReadingAt,
        assetName: s.assetName,
        assetType: s.assetType,
        floorLevel: s.floorLevel,
        isLive: Boolean(s.lastReadingAt && s.lastReadingAt >= liveCutoff),
      })),
      alerts: alertRows.map((a) => ({
        id: a.id,
        title: a.message?.slice(0, 80) || a.id.slice(0, 8),
        severity: a.severity,
        status: a.status,
        assetId: a.assetId,
        assetName: a.assetName,
        createdAt: a.createdAt,
      })),
      workOrders: workOrderRows.map((wo) => ({
        id: wo.id,
        title: wo.title,
        status: wo.status,
        priority: wo.priority,
        assetId: wo.assetId,
        assetName: wo.assetName,
      })),
    };
  }
}
