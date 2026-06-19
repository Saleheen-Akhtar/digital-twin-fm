/* eslint-disable no-console */
/**
 * Digital Twin FM — Database reset script
 *
 * Resets the demo state non-destructively:
 *   1. Clears alerts, work orders, maintenance logs, and sensor readings.
 *   2. Resets assets and sensors statuses back to 'ok'.
 *   3. Populates 1 hour of normal baseline readings for each sensor.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { faker } from "@faker-js/faker";
import {
  assets,
  sensors,
  sensorReadings,
  alerts,
  workOrders,
  maintenanceLogs,
} from "./schema";
import { eq } from "drizzle-orm";

faker.seed(42);

function assertDevEnvironment(): void {
  const env = process.env.NODE_ENV ?? "development";
  if (env === "production" || env === "staging") {
    throw new Error(
      `reset.ts refuses to run in NODE_ENV=${env}. ` +
        "The reset script is a development tool only.",
    );
  }
}

async function main() {
  assertDevEnvironment();

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || "dtfm_user",
    password: process.env.POSTGRES_PASSWORD || "dtfm_pass",
    database: process.env.POSTGRES_DB || "dtfm_db",
  });
  const db = drizzle(pool);

  console.log("🌱 Resetting Digital Twin FM database to baseline...");

  // Wipe mutable transaction/event tables
  await db.delete(maintenanceLogs);
  await db.delete(workOrders);
  await db.delete(alerts);
  await db.delete(sensorReadings);

  console.log("🧹 Cleared maintenance logs, work orders, alerts, and sensor readings.");

  // Reset asset statuses to 'ok'
  await db.update(assets).set({
    status: "ok",
  });

  // Reset sensor statuses and telemetry fields
  await db.update(sensors).set({
    status: "ok",
    lastValue: null,
    lastReadingAt: null,
  });

  console.log("✅ Reset asset and sensor status flags to 'ok'.");

  // Fetch all sensors to insert baseline readings
  const sensorRows = await db.select().from(sensors);
  console.log(`📈 Injecting baseline readings for ${sensorRows.length} sensors...`);

  const sensorTypes = [
    { type: "temperature", lo: 18, hi: 28 },
    { type: "humidity", lo: 30, hi: 60 },
    { type: "power", lo: 10, hi: 80 },
    { type: "vibration", lo: 0.5, hi: 3 },
    { type: "co2", lo: 400, hi: 700 },
  ];

  const now = Date.now();
  const readings: typeof sensorReadings.$inferInsert[] = [];

  // Generate last 1 hour of readings (every 3 minutes = 20 readings per sensor)
  for (const s of sensorRows) {
    const def = sensorTypes.find((t) => t.type === s.type) || { type: s.type, lo: 10, hi: 50 };
    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(now - i * 180_000).toISOString();
      const val = faker.number.float({ min: def.lo, max: def.hi, fractionDigits: 2 });
      readings.push({
        sensorId: s.id,
        assetId: s.assetId,
        timestamp,
        value: val,
        quality: "good",
      });

      // Set the last value on the sensor record to match the most recent reading (i = 0)
      if (i === 0) {
        await db.update(sensors).set({
          lastValue: val,
          lastReadingAt: timestamp,
        }).where(eq(sensors.id, s.id));
      }
    }
  }

  // Insert readings in chunks to prevent postgres parameter limit issues if we have many rows
  const chunkSize = 200;
  for (let i = 0; i < readings.length; i += chunkSize) {
    const chunk = readings.slice(i, i + chunkSize);
    await db.insert(sensorReadings).values(chunk);
  }

  console.log(`✨ Successfully generated and stored ${readings.length} baseline readings.`);
  
  await pool.end();
  console.log("🎉 Database reset complete!");
}

main().catch((err) => {
  console.error("❌ Reset failed:", err);
  process.exit(1);
});
