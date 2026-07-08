/**
 * Digital Twin FM — Sensor Simulator
 *
 * TWO MODES:
 *   backfill: one-shot — updates sensor.lastReadingAt / lastValue to "now" so
 *             the health score snapshot sees online sensors and recent data.
 *   run:      continuous loop — every 30s generates fresh readings with
 *             realistic drift, updates sensors, and checks thresholds.
 *
 * Usage:
 *   pnpm --filter @digital-twin-fm/db tsx src/simulator.ts backfill   ← run once
 *   pnpm --filter @digital-twin-fm/db tsx src/simulator.ts run        ← keep running
 *   pnpm --filter @digital-twin-fm/db tsx src/simulator.ts run 10     ← 10 iterations then exit
 */

/* eslint-disable no-console */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, sql, desc } from "drizzle-orm";
import Redis from "ioredis";
import {
  sensors,
  sensorReadings,
  alerts,
  assets,
} from "./schema";

// ── Config ──────────────────────────────────────────────────────────────
const INTERVAL_MS = 30_000; // 30s between ticks

/** Nominal baselines and realistic drift ranges per sensor type */
const PROFILES: Record<
  string,
  { base: number; amplitude: number; noise: number; unit: string }
> = {
  temperature: { base: 22, amplitude: 3, noise: 0.5, unit: "°C" },
  humidity:    { base: 55, amplitude: 8, noise: 1.5, unit: "%" },
  power:       { base: 45, amplitude: 15, noise: 3, unit: "kW" },
  vibration:   { base: 1.5, amplitude: 1.5, noise: 0.4, unit: "mm/s" },
  co2:         { base: 450, amplitude: 100, noise: 20, unit: "ppm" },
};

// ── Redis helpers ────────────────────────────────────────────────────────
function createRedisClient() {
  const host = process.env.REDIS_HOST || "localhost";
  const port = Number(process.env.REDIS_PORT) || 6379;
  const password = process.env.REDIS_PASSWORD;
  if (!password) {
    console.warn("   [redis] REDIS_PASSWORD not set — alerts won't be published to Valkey");
    return null;
  }
  const client = new Redis({
    host, port, password,
    lazyConnect: true,
    maxRetriesPerRequest: 0,     // don't retry — crash on auth failure
    retryStrategy: () => null,   // disable reconnect
    enableOfflineQueue: false,   // don't queue commands while disconnected
  });
  client.on("error", (err) => {
    console.error("   [redis] Connection error (non-fatal):", (err as Error).message);
  });
  return client;
}

async function publishAlert(
  redis: Redis | null,
  alert: { id: string; assetId: string; severity: string; message: string },
) {
  if (!redis) return;
  try {
    const subs = await redis.publish("alert.created", JSON.stringify(alert));
    console.log(`   [redis] Published alert to ${subs} subscriber(s): ${alert.severity} - ${alert.message.slice(0, 60)}`);
  } catch (err: unknown) {
    console.warn(`   [redis] Publish failed (non-fatal): ${(err as Error).message}`);
  }
}

// ── DB helpers ──────────────────────────────────────────────────────────
function createPool() {
  return new Pool({
    host: process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || "dtfm_user",
    password: process.env.POSTGRES_PASSWORD ?? (() => { throw new Error("POSTGRES_PASSWORD not set — aborting"); })(),
    database: process.env.POSTGRES_DB || "dtfm_db",
  });
}

/** Generate a single realistic sensor value */
function generateValue(
  type: string,
  lastValue: number | null,
  tick: number,
): number {
  const profile = PROFILES[type];
  if (!profile) return (lastValue ?? 50) + (Math.random() - 0.5) * 0.2;

  const drift = (Math.random() - 0.5) * profile.noise * 2;
  const wave = Math.sin(tick * 0.1 + type.length) * profile.amplitude * 0.3;
  const current = lastValue ?? profile.base;
  return Math.max(0, +(current + drift + wave).toFixed(2));
}

// ── Backfill ────────────────────────────────────────────────────────────
async function backfill() {
  console.log("🔄 Backfilling sensor.lastReadingAt / lastValue …");
  const pool = createPool();
  const db = drizzle(pool);

  const allSensors = await db.select().from(sensors);
  console.log(`   Found ${allSensors.length} sensors`);

  let updated = 0;
  for (const s of allSensors) {
    // Find the most recent reading
    const lastReading = await db
      .select({ value: sensorReadings.value, timestamp: sensorReadings.timestamp })
      .from(sensorReadings)
      .where(eq(sensorReadings.sensorId, s.id))
      .orderBy(desc(sensorReadings.timestamp))
      .limit(1);

    const now = new Date().toISOString();

    if (lastReading.length > 0) {
      // Replay it with a fresh timestamp
      await db
        .update(sensors)
        .set({
          lastValue: lastReading[0].value,
          lastReadingAt: now,
        })
        .where(eq(sensors.id, s.id));
    } else {
      // Generate a fallback
      const profile = PROFILES[s.type];
      const val = profile ? profile.base + (Math.random() - 0.5) * profile.amplitude : 50;
      await db
        .update(sensors)
        .set({ lastValue: +val.toFixed(2), lastReadingAt: now })
        .where(eq(sensors.id, s.id));
    }
    updated++;
  }

  // Also inject a fresh reading per sensor so the 5-min uptime window works
  const now = new Date();
  const freshReadings: (typeof sensorReadings.$inferInsert)[] = [];
  for (const s of allSensors) {
    const profile = PROFILES[s.type];
    const val = profile
      ? profile.base + (Math.random() - 0.5) * profile.amplitude
      : 50;
    freshReadings.push({
      sensorId: s.id,
      assetId: s.assetId,
      timestamp: new Date(now.getTime() - Math.random() * 120_000).toISOString(),
      value: +val.toFixed(2),
      quality: "good",
    });
  }
  await db.insert(sensorReadings).values(freshReadings);

  console.log(`✅ Backfill complete: ${updated} sensors updated, ${freshReadings.length} fresh readings inserted`);
  await pool.end();
}

// ── Continuous loop ─────────────────────────────────────────────────────
async function runLoop(maxIterations?: number) {
  console.log("🚀 Sensor simulator starting …");
  const pool = createPool();
  const db = drizzle(pool);

  // Cache sensor list (refreshed each iteration in case of new sensors)
  let allSensors = await db.select().from(sensors);
  console.log(`   Monitoring ${allSensors.length} sensors, tick every ${INTERVAL_MS / 1000}s`);

  let tick = 0;
  const redis = createRedisClient();

  async function tickOnce() {
    tick++;

    // 1. Reload sensor list and last values
    allSensors = await db.select().from(sensors);

    const now = new Date();
    const newReadings: (typeof sensorReadings.$inferInsert)[] = [];

    for (const s of allSensors) {
      const val = generateValue(s.type, s.lastValue, tick);

      newReadings.push({
        sensorId: s.id,
        assetId: s.assetId,
        timestamp: now.toISOString(),
        value: val,
        quality: "good",
      });

      // Update sensor.lastValue + lastReadingAt
      await db
        .update(sensors)
        .set({ lastValue: val, lastReadingAt: now.toISOString() })
        .where(eq(sensors.id, s.id));

      // 2. Threshold check — both high AND low
      const high = s.thresholdHigh;
      const low = s.thresholdLow;
      let breached = false;
      let direction: "high" | "low" = "high";
      let exceededValue: number | null = null;

      if (high != null && val > high) {
        breached = true;
        direction = "high";
        exceededValue = high;
      } else if (low != null && val < low) {
        breached = true;
        direction = "low";
        exceededValue = low;
      }

      if (breached && exceededValue !== null) {
        // Deduplicate: don't create another open alert for the same sensor
        const existing = await db
          .select({ id: alerts.id })
          .from(alerts)
          .where(
            sql`${alerts.sensorId} = ${s.id}
              AND ${alerts.status} NOT IN ('cancelled', 'resolved', 'closed')
              AND ${alerts.createdAt} > ${new Date(Date.now() - 3600_000).toISOString()}`,
          )
          .limit(1);

        if (existing.length === 0) {
          // Deviation-based severity matching the AlertEngineService formula
          const range = (high ?? 100) - (low ?? 0);
          const mid = ((high ?? 100) + (low ?? 0)) / 2;
          const deviation = Math.abs(val - mid) / (range / 2);
          const severity =
            deviation > 2.5 ? "critical" :
            deviation > 1.5 ? "high" :
            deviation > 1.0 ? "medium" : "low";

          const asset = await db
            .select({ name: assets.name })
            .from(assets)
            .where(eq(assets.id, s.assetId))
            .limit(1)
            .then((r) => r[0]?.name ?? "Unknown");

          const [newAlert] = await db.insert(alerts)
            .values({
              sensorId: s.id,
              assetId: s.assetId,
              severity,
              status: "open",
              message: `${s.type} ${direction} threshold breached on ${asset}: ${val}${s.unit} (${direction} ${exceededValue}${s.unit})`,
            })
            .returning({ id: alerts.id });

          // Publish to Redis so the WebSocket pushes a real-time notification
          if (newAlert) {
            await publishAlert(redis, {
              id: newAlert.id,
              assetId: s.assetId,
              severity,
              message: `${s.type} ${direction} threshold breached on ${asset}: ${val}${s.unit} (${direction} ${exceededValue}${s.unit})`,
            });
          }
        }
      }
    }

    // 3. Batch-insert all new readings
    if (newReadings.length > 0) {
      await db.insert(sensorReadings).values(newReadings);

      // Publish live readings to Redis for WebSocket broadcasting
      if (redis) {
        for (const r of newReadings) {
          try {
            await redis.publish(
              "sensor.reading",
              JSON.stringify({
                sensorId: r.sensorId,
                assetId: r.assetId,
                value: r.value,
                timestamp: new Date().toISOString(),
              }),
            );
          } catch {
            // non-fatal
          }
        }
      }
    }

    const totalSensors = allSensors.length;
    const onlineSensors = allSensors.filter(
      (s) => s.lastReadingAt && s.lastReadingAt > new Date(Date.now() - 300_000).toISOString(),
    ).length;
    console.log(
      `   [tick ${tick}] ${newReadings.length} readings pushed · ${onlineSensors}/${totalSensors} sensors online`,
    );
  }

  // Run first tick immediately
  await tickOnce();

  // Then loop
  const interval = setInterval(async () => {
    try {
      await tickOnce();
      if (maxIterations && tick >= maxIterations) {
        clearInterval(interval);
        console.log("✅ Simulator finished (max iterations reached)");
        await pool.end();
      }
    } catch (err: unknown) {
      console.error("❌ Simulator tick error:", err);
    }
  }, INTERVAL_MS);

  // Graceful shutdown
  const shutdown = async () => {
    clearInterval(interval);
    console.log("\n🛑 Simulator stopping …");
    await pool.end();
    if (redis) await redis.quit().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep alive
  await new Promise(() => {});
}

// ── CLI ─────────────────────────────────────────────────────────────────
async function main() {
  const mode = process.argv[2] ?? "backfill";
  if (mode === "backfill") {
    await backfill();
  } else if (mode === "run") {
    const maxIters = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
    await runLoop(maxIters);
  } else {
    console.error("Usage: tsx src/simulator.ts [backfill|run [iterations]]");
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("❌ Simulator failed:", err);
  process.exit(1);
});
