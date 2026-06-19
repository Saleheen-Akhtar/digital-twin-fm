/**
 * Digital Twin FM — Sensor Simulator
 */
import { Redis } from "ioredis";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sensors, assets, floors } from "@digital-twin-fm/db";

const POSTGRES_URL = process.env.POSTGRES_URL || "postgresql://dtfm_user:t3stp4ss@localhost:5432/dtfm_db";
const REDIS_URL = process.env.REDIS_URL || "redis://:dtfm_redis_pass_2024@localhost:6379/0";
const SIMULATOR_INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS) || 5000;

type Scenario = "normal" | "chiller_failure" | "power_surge_floor_3" | "severe_temp_breach";
let activeScenario: Scenario = "normal";

interface SensorConfig {
  id: string;
  assetId: string;
  assetName: string;
  assetType: string;
  floorLevel: number;
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
  const allFloors = await db.select().from(floors);
  
  const assetMap = new Map(allAssets.map(a => [a.id, a]));
  const floorMap = new Map(allFloors.map(f => [f.id, f]));

  const configs: SensorConfig[] = [];

  for (const sensor of allSensors) {
    const asset = assetMap.get(sensor.assetId);
    if (!asset) continue;

    const floor = asset.floorId ? floorMap.get(asset.floorId) : null;
    const floorLevel = floor ? floor.level : 0;

    const typeKey = sensor.type.toLowerCase();
    const typeConfig = SENSOR_TYPES[typeKey] || SENSOR_TYPES.temperature;

    const assetHash = asset.id.split('-').reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
    const baselineVariation = (assetHash % 10 - 5) * 0.1 * typeConfig.baseline;

    configs.push({
      id: sensor.id,
      assetId: sensor.assetId,
      assetName: asset.name,
      assetType: asset.type,
      floorLevel,
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

  if (activeScenario === "chiller_failure") {
    // Chiller failure: Chiller temp spikes, Chiller power drops to near 0
    if (config.assetType.toLowerCase() === "chiller") {
      if (config.type.toLowerCase() === "temperature") {
        const value = base + 1.5 + (Math.random() - 0.5) * 0.2;
        return Number(Math.min(45, value).toFixed(2));
      }
      if (config.type.toLowerCase() === "power") {
        return Number((0.1 + Math.random() * 0.2).toFixed(2));
      }
    }
  } else if (activeScenario === "power_surge_floor_3") {
    // Power surge on Floor 3: power sensors on floor 3 spike
    if (config.floorLevel === 3 && config.type.toLowerCase() === "power") {
      const value = config.baseline * 6 + (Math.random() - 0.5) * 30;
      return Number(value.toFixed(2));
    }
  } else if (activeScenario === "severe_temp_breach") {
    // Severe temp breach: Temperature sensors on AHUs spike steadily up to 42C
    if (config.assetType.toLowerCase() === "ahu" && config.type.toLowerCase() === "temperature") {
      const value = base + 1.2 + (Math.random() - 0.5) * 0.2;
      return Number(Math.min(42, value).toFixed(2));
    }
  }

  // Normal scenario - random walk
  const change = (Math.random() - 0.5) * 2 * config.drift;
  const reversion = (config.baseline - base) * 0.1;
  let value = base + change + reversion;
  value = Math.max(config.min, Math.min(config.max, value));
  return Number(value.toFixed(2));
}

function switchScenario(scenario: Scenario) {
  activeScenario = scenario;
  console.log(`\n🚨 [simulator] Switched active scenario to: ${scenario.toUpperCase()}`);
}

let redis: Redis;
let controlRedis: Redis;
let intervalId: NodeJS.Timeout;

async function cleanupAndExit() {
  console.log("\n[simulator] Shutting down simulator...");
  if (intervalId) clearInterval(intervalId);
  try {
    if (redis) await redis.quit();
    if (controlRedis) await controlRedis.quit();
  } catch (err) {
    console.error("[simulator] Error closing Redis connections:", err);
  }
  process.exit(0);
}

function setupTerminalKeyboard() {
  if (!process.stdin.isTTY) {
    console.log("[simulator] Non-TTY stdin, interactive keyboard controls disabled.");
    return;
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  console.log("\n[simulator] Interactive keyboard controls active:");
  console.log("  Press [c] - Chiller Failure");
  console.log("  Press [p] - Floor 3 Power Surge");
  console.log("  Press [t] - Severe Temperature Breach");
  console.log("  Press [n] - Reset to Normal Scenario");
  console.log("  Press [Ctrl+C] - Exit\n");

  process.stdin.on("data", (key: string) => {
    // Ctrl+C
    if (key === "\u0003") {
      cleanupAndExit();
    }

    switch (key.toLowerCase()) {
      case "c":
        switchScenario("chiller_failure");
        break;
      case "p":
        switchScenario("power_surge_floor_3");
        break;
      case "t":
        switchScenario("severe_temp_breach");
        break;
      case "n":
        switchScenario("normal");
        break;
    }
  });
}

async function main() {
  console.log("[simulator] Starting sensor simulator...");
  console.log(`[simulator] Redis: ${REDIS_URL}`);
  console.log(`[simulator] Interval: ${SIMULATOR_INTERVAL_MS}ms`);

  redis = new Redis({ host: 'localhost', port: 6379, password: process.env.REDIS_PASSWORD || 'dtfm_redis_pass_2024', maxRetriesPerRequest: 3, lazyConnect: false });
  controlRedis = new Redis({ host: 'localhost', port: 6379, password: process.env.REDIS_PASSWORD || 'dtfm_redis_pass_2024', maxRetriesPerRequest: 3, lazyConnect: false });

  redis.on("error", (err) => console.error("[simulator] Redis error:", err));
  controlRedis.on("error", (err) => console.error("[simulator] Control Redis error:", err));

  // Subscribe to Redis control channel
  await controlRedis.subscribe("simulator.control");
  console.log("[simulator] Subscribed to simulator.control Redis channel");

  controlRedis.on("message", (channel, message) => {
    if (channel !== "simulator.control") return;
    try {
      const data = JSON.parse(message);
      if (data && typeof data.scenario === "string") {
        const scenario = data.scenario as Scenario;
        if (["normal", "chiller_failure", "power_surge_floor_3", "severe_temp_breach"].includes(scenario)) {
          switchScenario(scenario);
        } else {
          console.warn("[simulator] Unknown scenario received:", scenario);
        }
      }
    } catch (err) {
      console.error("[simulator] Error parsing control message:", err);
    }
  });

  const configs = await loadSensorConfigs();
  console.log(`[simulator] Loaded ${configs.length} sensors`);

  setupTerminalKeyboard();

  const lastValues = new Map<string, number>();

  intervalId = setInterval(async () => {
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
    await cleanupAndExit();
  });
}

main().catch((err) => {
  console.error("[simulator] Fatal error:", err);
  process.exit(1);
});