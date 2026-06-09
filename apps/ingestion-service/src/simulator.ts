/**
 * Digital Twin FM — Sensor Simulator
 */
import { Redis } from "ioredis";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sensors, assets } from "@digital-twin-fm/db";
import { eq } from "drizzle-orm";

const POSTGRES_URL = process.env.POSTGRES_URL || "postgresql://dtfm_user:t3stp4ss@localhost:5432/dtfm_db";
const REDIS_URL = process.env.REDIS_URL || "redis://:dtfm_redis_pass_2024@localhost:6379/0";
const SIMULATOR_INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS) || 5000;

interface SensorConfig {
  id: string;
  assetId: string;
  type: string;
  unit: string;
  min: number;
  max: number;
  baseline: number;
  drift: number;
}

const SENSOR_TYPES: Record<string, { unit: string; min: number; max: number; baseline: number; drift: number }> = {
  temperature: { unit: "C", min: 10, max: 35, baseline: 22, drift: 0.5 },
  humidity: { unit: "%", min: 20, max: 80, baseline: 45, drift: 1 },
  pressure: { unit: "Pa", min: 90000, max: 110000, baseline: 101325, drift: 50 },
  flow: { unit: "L/s", min: 0, max: 50, baseline: 12, drift: 0.3 },
  vibration: { unit: "mm/s", min: 0, max: 10, baseline: 1.5, drift: 0.1 },
  power: { unit: "kW", min: 0, max: 500, baseline: 45, drift: 2 },
  co2: { unit: "ppm", min: 350, max: 2000, baseline: 450, drift: 10 },
  voc: { unit: "ppb", min: 0, max: 500, baseline: 50, drift: 2 },
};

async function loadSensorConfigs(): Promise<SensorConfig[]> {
  const pool = new Pool({ connectionString: POSTGRES_URL });
  const db = drizzle(pool);

  const allSensors = await db.select().from(sensors);
  const allAssets = await db.select().from(assets);
  const assetMap = new Map(allAssets.map(a => [a.id, a]));

  const configs: SensorConfig[] = [];

  for (const sensor of allSensors) {
    const asset = assetMap.get(sensor.assetId);
    if (!asset) continue;

    const typeKey = sensor.type.toLowerCase();
    const typeConfig = SENSOR_TYPES[typeKey] || SENSOR_TYPES.temperature;

    const assetHash = asset.id.split('-').reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
    const baselineVariation = (assetHash % 10 - 5) * 0.1 * typeConfig.baseline;

    configs.push({
      id: sensor.id,
      assetId: sensor.assetId,
      type: sensor.type,
      unit: typeConfig.unit,
      min: typeConfig.min,
      max: typeConfig.max,
      baseline: typeConfig.baseline + baselineVariation,
      drift: typeConfig.drift,
    });
  }

  await pool.end();
  return configs;
}

function generateReading(config: SensorConfig, previousValue?: number): number {
  const base = previousValue ?? config.baseline;
  const change = (Math.random() - 0.5) * 2 * config.drift;
  const reversion = (config.baseline - base) * 0.1;
  let value = base + change + reversion;
  value = Math.max(config.min, Math.min(config.max, value));
  return Number(value.toFixed(2));
}

async function main() {
  console.log("[simulator] Starting sensor simulator...");
  console.log(`[simulator] Redis: ${REDIS_URL}`);
  console.log(`[simulator] Interval: ${SIMULATOR_INTERVAL_MS}ms`);

  const redis = new Redis({ host: 'localhost', port: 6379, password: process.env.REDIS_PASSWORD || 'dtfm_redis_pass_2024', maxRetriesPerRequest: 3, lazyConnect: false });
  redis.on("error", (err) => console.error("[simulator] Redis error:", err));

  const configs = await loadSensorConfigs();
  console.log(`[simulator] Loaded ${configs.length} sensors`);

  const lastValues = new Map<string, number>();

  setInterval(async () => {
    for (const config of configs) {
      const value = generateReading(config, lastValues.get(config.id));
      lastValues.set(config.id, value);

      const reading = {
        sensorId: config.id,
        assetId: config.assetId,
        timestamp: new Date().toISOString(),
        value,
        unit: config.unit,
        quality: "good" as const,
      };

      try {
        await redis.publish("sensor.reading", JSON.stringify(reading));
      } catch (err) {
        console.error(`[simulator] Failed to publish ${config.id}:`, err);
      }
    }
  }, SIMULATOR_INTERVAL_MS);

  console.log("[simulator] Running. Press Ctrl+C to stop.");

  process.on("SIGINT", async () => {
    console.log("\n[simulator] Shutting down...");
    await redis.quit();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[simulator] Fatal error:", err);
  process.exit(1);
});