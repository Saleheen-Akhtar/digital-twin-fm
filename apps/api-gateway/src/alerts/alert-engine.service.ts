import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, inArray, sql, isNotNull } from 'drizzle-orm';
import { alerts, sensors, sensorReadings, workOrders, assets } from '@digital-twin-fm/db';
import { RealtimeGateway } from '../ws/realtime.gateway';

@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  constructor(
    @Inject('DB') private readonly db: NodePgDatabase,
    private readonly gateway: RealtimeGateway,
  ) {}

  /**
   * Runs every 5 minutes: evaluates sensor thresholds and auto-creates alerts.
   * Batched query design avoids N+1 per-sensor round-trips.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluate() {
    this.logger.log('Running alert evaluation…');

    // 1. Find all sensors that have thresholds defined
    const thresholdSensors = await this.db
      .select()
      .from(sensors)
      .where(
        and(
          isNotNull(sensors.thresholdHigh),
          isNotNull(sensors.thresholdLow),
        ),
      );

    if (thresholdSensors.length === 0) {
      this.logger.log('No sensors with thresholds configured — skipping');
      return;
    }

    this.logger.debug(`Evaluating ${thresholdSensors.length} sensors with thresholds`);

    const windowStart = new Date(Date.now() - 5 * 60 * 1000);

    // 2. Fetch latest reading per sensor IN ONE QUERY using Drizzle's SQL builder
    const sensorIds = thresholdSensors.map((s) => s.id);
    const latestReadings = await this.db.execute<{
      sensor_id: string;
      value: number;
      timestamp: string;
    }>(
      sql`
        SELECT DISTINCT ON (sr.sensor_id)
          sr.sensor_id, sr.value, sr.timestamp
        FROM ${sensorReadings} sr
        WHERE sr.sensor_id = ANY(ARRAY[${sql.join(sensorIds.map((id) => sql`${id}::uuid`), sql`, `)}])
          AND sr.timestamp >= ${windowStart.toISOString()}
        ORDER BY sr.sensor_id, sr.timestamp DESC
      `,
    );

    if (!latestReadings.rows || latestReadings.rows.length === 0) {
      this.logger.log('No recent readings found — skipping');
      return;
    }

    // Build a map: sensorId → reading
    const readingBySensor = new Map<string, { value: number; timestamp: string }>();
    for (const row of latestReadings.rows) {
      readingBySensor.set(row.sensor_id, { value: row.value, timestamp: row.timestamp });
    }

    // 3. Determine which sensors breached a threshold
    const breachedSensorIds = new Set<string>();
    for (const s of thresholdSensors) {
      const latest = readingBySensor.get(s.id);
      if (!latest) continue;
      if (s.thresholdHigh !== null && latest.value > s.thresholdHigh) {
        breachedSensorIds.add(s.id);
      } else if (s.thresholdLow !== null && latest.value < s.thresholdLow) {
        breachedSensorIds.add(s.id);
      }
    }

    if (breachedSensorIds.size === 0) {
      this.logger.log('No thresholds breached — skipping');
      return;
    }

    // 4. Deduplicate: find sensors that already have an open alert (single query)
    const existingAlerts = await this.db
      .select({ sensorId: alerts.sensorId })
      .from(alerts)
      .where(
        and(
          inArray(alerts.sensorId, Array.from(breachedSensorIds)),
          inArray(alerts.status, ['open', 'acknowledged', 'in_progress'] as const),
        ),
      );

    const existingAlertSensorIds = new Set(existingAlerts.map((a) => a.sensorId));

    // 5. For sensors needing a new alert, batch-insert and auto-create work orders
    const newAlertsData: Array<{
      sensorId: string;
      assetId: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
    }> = [];

    for (const s of thresholdSensors) {
      if (!breachedSensorIds.has(s.id)) continue;
      if (existingAlertSensorIds.has(s.id)) continue;

      const latest = readingBySensor.get(s.id)!;
      const severity = detectSeverity(latest.value, s.thresholdLow!, s.thresholdHigh!);
      const message = buildAlertMessage(s, latest.value, latest.timestamp, s.thresholdLow!, s.thresholdHigh!);

      newAlertsData.push({
        sensorId: s.id,
        assetId: s.assetId,
        severity,
        message,
      });
    }

    if (newAlertsData.length === 0) {
      this.logger.log('All breached sensors already have open alerts — skipping');
      return;
    }

    // Batch-insert all new alerts in one query
    const insertedAlerts = await this.db
      .insert(alerts)
      .values(
        newAlertsData.map((a) => ({
          sensorId: a.sensorId,
          assetId: a.assetId,
          severity: a.severity,
          status: 'open' as const,
          message: a.message,
        })),
      )
      .returning();

    this.logger.log(`Created ${insertedAlerts.length} new alerts`);

    // Broadcast each alert via WebSocket (non-blocking — don't await)
    for (const alert of insertedAlerts) {
      try {
        this.gateway.broadcastAlert({
          id: alert.id,
          assetId: alert.assetId,
          severity: alert.severity,
          message: alert.message,
        });
      } catch {
        // WebSocket broadcast is non-fatal
      }
    }

    // 6. Auto-create work orders for critical/high alerts
    //    Fetch all needed asset names in one query
    const criticalAlertIds = insertedAlerts.filter(
      (a) => a.severity === 'critical' || a.severity === 'high',
    );

    if (criticalAlertIds.length > 0) {
      // Work order title uses severity from the alert

      const workOrderValues = criticalAlertIds.map((a) => ({
        assetId: a.assetId!,
        alertId: a.id,
        title: `Auto: ${a.severity} — threshold breach`,
        description: a.message,
        type: 'corrective' as const,
        priority: a.severity,
        status: 'open' as const,
      }));

      await this.db.insert(workOrders).values(workOrderValues as any);
      this.logger.log(`Auto-created ${workOrderValues.length} work orders`);

      // Broadcast work order updates (non-blocking)
      for (const wo of workOrderValues) {
        try {
          this.gateway.broadcastWorkOrderUpdate({
            alertId: wo.alertId,
            assetId: wo.assetId,
            severity: wo.priority,
            message: wo.description,
          });
        } catch {
          // WebSocket broadcast is non-fatal
        }
      }
    }

    this.logger.log('Alert evaluation complete');
  }
}

function detectSeverity(value: number, low: number, high: number): 'low' | 'medium' | 'high' | 'critical' {
  const range = high - low;
  const mid = (low + high) / 2;

  if (value > high || value < low) {
    const deviation = Math.abs(value - mid) / (range / 2);
    if (deviation > 2.5) return 'critical';
    if (deviation > 1.5) return 'high';
    if (deviation > 1.0) return 'medium';
    return 'low';
  }

  return 'low';
}

function buildAlertMessage(
  sensor: typeof sensors.$inferSelect,
  value: number,
  timestamp: string,
  low: number,
  high: number,
): string {
  const sensorName = `${sensor.type} sensor ${sensor.id.slice(0, 8)}`;
  const direction = value > high ? 'above' : 'below';
  const threshold = value > high ? `high (${high})` : `low (${low})`;
  const sev = detectSeverity(value, low, high);

  return `[${sev.toUpperCase()}] ${sensorName} reading ${value.toFixed(1)} ${sensor.unit} is ${direction} ${threshold} threshold at ${new Date(timestamp).toLocaleString()}.`;
}
