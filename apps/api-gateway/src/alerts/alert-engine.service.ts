import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, desc, isNotNull, inArray } from 'drizzle-orm';
import { alerts, sensors, sensorReadings, workOrders, assets } from '@digital-twin-fm/db';

@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  constructor(
    @Inject('DB') private readonly db: NodePgDatabase,
  ) {}

  /**
   * Runs every 5 minutes: evaluates sensor thresholds and auto-creates alerts.
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

    // The lookback window for recent readings (last 5 minutes)
    const windowStart = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    for (const sensor of thresholdSensors) {
      let breached = false;

      try {
        // Get the most recent reading within the window
        const reading = await this.db
          .select({ value: sensorReadings.value, timestamp: sensorReadings.timestamp })
          .from(sensorReadings)
          .where(
            and(
              eq(sensorReadings.sensorId, sensor.id),
              gte(sensorReadings.timestamp, windowStart),
            ),
          )
          .orderBy(desc(sensorReadings.timestamp))
          .limit(1);

        if (reading.length === 0) continue;

        const latest = reading[0];

        // Check thresholds
        if (sensor.thresholdHigh !== null && latest.value > sensor.thresholdHigh) {
          breached = true;
        } else if (sensor.thresholdLow !== null && latest.value < sensor.thresholdLow) {
          breached = true;
        }

        if (!breached) continue;

        // 2. Deduplicate: don't create another open alert for the same sensor
        const existingOpen = await this.db
          .select({ id: alerts.id })
          .from(alerts)
          .where(
            and(
              eq(alerts.sensorId, sensor.id),
              inArray(alerts.status, ['open', 'acknowledged', 'in_progress'] as const),
            ),
          )
          .limit(1);

        if (existingOpen.length > 0) {
          this.logger.debug(`Open alert already exists for sensor ${sensor.id} — skipping`);
          continue;
        }

        // 3. Determine severity based on how far the reading is past the threshold
        const high = sensor.thresholdHigh!;
        const low = sensor.thresholdLow!;
        const value = latest.value;
        const severity = detectSeverity(value, low, high);

        // 4. Build the alert message
        const message = buildAlertMessage(sensor, value, latest.timestamp, low, high);

        // 5. Create the alert
        const [alert] = await this.db
          .insert(alerts)
          .values({
            sensorId: sensor.id,
            assetId: sensor.assetId,
            severity,
            status: 'open',
            message,
          })
          .returning();

        this.logger.log(`Created alert ${alert.id} (${severity}) for sensor ${sensor.id}: ${message}`);

        // 6. Auto-create work order for critical / high alerts
        if (severity === 'critical' || severity === 'high') {
          const asset = await this.db
            .select({ name: assets.name })
            .from(assets)
            .where(eq(assets.id, sensor.assetId))
            .limit(1);

          const assetName = asset[0]?.name ?? 'Unknown';
          await this.db.insert(workOrders).values({
            assetId: sensor.assetId,
            alertId: alert.id,
            title: `Auto: ${severity} — ${sensor.type} threshold breach on ${assetName}`,
            description: message,
            type: 'corrective',
            priority: severity,
            status: 'open',
          });

          this.logger.log(`Auto-created work order for alert ${alert.id}`);
        }
      } catch (err) {
        this.logger.error({ err, sensorId: sensor.id }, 'Error evaluating sensor threshold');
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

  return `[${severityLabel(value, low, high)}] ${sensorName} reading ${value.toFixed(1)} ${sensor.unit} is ${direction} ${threshold} threshold at ${new Date(timestamp).toLocaleString()}.`;
}

function severityLabel(value: number, low: number, high: number): string {
  const range = high - low;
  const mid = (low + high) / 2;
  const deviation = Math.abs(value - mid) / (range / 2);
  if (deviation > 2.5) return 'CRITICAL';
  if (deviation > 1.5) return 'HIGH';
  if (deviation > 1.0) return 'MEDIUM';
  return 'LOW';
}
