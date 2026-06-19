/**
 * Digital Twin FM — Ingestion Worker
 *
 * Subscribes to Valkey/Redis `sensor.reading` channel,
 * validates readings, writes to TimescaleDB (sensor_readings),
 * updates sensor.last_value / last_reading_at,
 * checks thresholds and creates alerts if needed,
 * publishes `asset.updated` events to `asset.updates` channel.
 */
import { Redis } from "ioredis";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sensorReadings, sensors, alerts } from "@digital-twin-fm/db";
import { eq, and } from "drizzle-orm";

const POSTGRES_URL = process.env.POSTGRES_URL || "postgresql://dtfm_user:t3stp4ss@localhost:5432/dtfm_db";
const REDIS_URL = process.env.REDIS_URL || "redis://:dtfm_redis_pass_2024@localhost:6379/0";

interface SensorReadingMessage {
  sensorId: string;
  assetId: string;
  timestamp: string;
  value: number;
  unit: string;
  quality: "good" | "uncertain" | "bad";
}

async function upsertSensorReading(db: ReturnType<typeof drizzle>, reading: SensorReadingMessage) {
  await db.insert(sensorReadings).values({
    sensorId: reading.sensorId,
    assetId: reading.assetId,
    timestamp: reading.timestamp,
    value: reading.value,
    quality: reading.quality,
  });

  await db
    .update(sensors)
    .set({
      lastValue: reading.value,
      lastReadingAt: reading.timestamp,
    })
    .where(eq(sensors.id, reading.sensorId));
}

async function checkThresholdsAndAlert(db: ReturnType<typeof drizzle>, reading: SensorReadingMessage) {
  const sensor = await db.select().from(sensors).where(eq(sensors.id, reading.sensorId)).limit(1);
  if (!sensor[0]) return;

  const { thresholdLow, thresholdHigh, assetId } = sensor[0];
  let severity: "low" | "medium" | "high" | "critical" | null = null;
  let message = "";

  if (thresholdLow !== null && reading.value < thresholdLow) {
    severity = reading.value < thresholdLow * 0.8 ? "critical" : "medium";
    message = `${reading.sensorId} value ${reading.value} ${reading.unit} below low threshold ${thresholdLow}`;
  } else if (thresholdHigh !== null && reading.value > thresholdHigh) {
    severity = reading.value > thresholdHigh * 1.2 ? "critical" : "medium";
    message = `${reading.sensorId} value ${reading.value} ${reading.unit} above high threshold ${thresholdHigh}`;
  }

  if (severity) {
    const existing = await db
      .select()
      .from(alerts)
      .where(
        and(
          eq(alerts.sensorId, reading.sensorId),
          eq(alerts.status, "open")
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(alerts).values({
        sensorId: reading.sensorId,
        assetId,
        severity,
        status: "open",
        message,
      });
      console.log(`[worker] ALERT ${severity}: ${message}`);
    }
  }
}

async function publishAssetUpdate(pubRedis: Redis, assetId: string) {
  const event = {
    assetId,
    timestamp: new Date().toISOString(),
    type: "asset.updated" as const,
  };
  await pubRedis.publish("asset.updates", JSON.stringify(event));
}

async function main() {
  console.log("[worker] Starting ingestion worker...");
  console.log(`[worker] Redis: ${REDIS_URL}`);

  const redis = new Redis({ host: 'localhost', port: 6379, password: process.env.REDIS_PASSWORD || 'dtfm_redis_pass_2024', maxRetriesPerRequest: 3, lazyConnect: false });
  const pubRedis = new Redis({ host: 'localhost', port: 6379, password: process.env.REDIS_PASSWORD || 'dtfm_redis_pass_2024', maxRetriesPerRequest: 3, lazyConnect: false });
  const pool = new Pool({ connectionString: POSTGRES_URL });
  const db = drizzle(pool);

  redis.on("error", (err) => console.error("[worker] Redis error:", err));
  pubRedis.on("error", (err) => console.error("[worker] pubRedis error:", err));

  await redis.subscribe("sensor.reading");
  console.log("[worker] Subscribed to sensor.reading");

  redis.on("message", async (channel, message) => {
    if (channel !== "sensor.reading") return;

    try {
      const reading: SensorReadingMessage = JSON.parse(message);

      // Validate
      if (!reading.sensorId || !reading.assetId || typeof reading.value !== "number") {
        console.warn("[worker] Invalid reading payload:", reading);
        return;
      }

      await upsertSensorReading(db, reading);
      await checkThresholdsAndAlert(db, reading);
      await publishAssetUpdate(pubRedis, reading.assetId);

      console.log(`[worker] ${reading.sensorId}: ${reading.value} ${reading.unit}`);
    } catch (err) {
      console.error("[worker] Error processing message:", err);
    }
  });

  console.log("[worker] Running. Press Ctrl+C to stop.");

  process.on("SIGINT", async () => {
    console.log("\n[worker] Shutting down...");
    await redis.unsubscribe("sensor.reading");
    await redis.quit();
    await pubRedis.quit();
    await pool.end();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});