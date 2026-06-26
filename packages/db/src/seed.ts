/* eslint-disable no-console */
/**
 * Digital Twin FM — Database seed script
 *
 * Populates a realistic convention centre demo:
 *   1 building → 5 floors → 10 rooms → 20 assets → 60 sensors → 1000 readings → 5 alerts → 8 work orders
 *
 * Run with:  pnpm --filter @digital-twin-fm/db seed
 *
 * Per Finding 25 (Medium): the previous version hardcoded
 *   passwordHash: "REPLACE_WITH_BCRYPT_HASH"
 * into the database. Anyone who ran the seed script and then logged
 * in with the literal placeholder string (or a known-empty hash) could
 * impersonate the demo admin. The new behavior:
 *
 *   1. Refuses to run in production. The seed is a demo/dev tool only.
 *   2. Accepts an optional `--password=<value>` CLI argument; if
 *      omitted, a random 24-byte password is generated and printed
 *      to stdout (so a developer can copy it into the login form).
 *   3. Hashes the password with argon2id before storing.
 *   4. Requires argon2 as a runtime dep (already used by the
 *      api-gateway; seed shares the same primitive).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { faker } from "@faker-js/faker";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";
import type { WorkOrderType } from "@digital-twin-fm/types";
import {
  buildings,
  floors,
  rooms,
  assets,
  sensors,
  sensorReadings,
  alerts,
  workOrders,
  users,
} from "./schema";

faker.seed(42); // deterministic seed

/**
 * Refuse to run in any non-development environment. The seed script
 * is a developer tool — it deletes all rows from 8 tables and inserts
 * demo data. Running it in production is always wrong.
 */
function assertDevEnvironment(): void {
  const env = process.env.NODE_ENV ?? "development";
  if (env === "production" || env === "staging") {
    throw new Error(
      `seed.ts refuses to run in NODE_ENV=${env}. ` +
        "The seed script is a development tool only.",
    );
  }
}

/**
 * Resolve the demo admin password.
 *
 *   1. --password=<value> CLI argument (highest priority)
 *   2. SEED_ADMIN_PASSWORD env var
 *   3. Random 24-byte base64url string (logged once on stdout)
 */
async function resolveAdminPassword(): Promise<string> {
  const cliArg = process.argv.find((a) => a.startsWith("--password="));
  if (cliArg) return cliArg.slice("--password=".length);
  if (process.env.SEED_ADMIN_PASSWORD) return process.env.SEED_ADMIN_PASSWORD;
  return randomBytes(24).toString("base64url");
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

  console.log("🌱 Seeding Digital Twin FM demo data…");

  // Wipe in dependency order
  await db.delete(workOrders);
  await db.delete(alerts);
  await db.delete(sensorReadings);
  await db.delete(sensors);
  await db.delete(assets);
  await db.delete(rooms);
  await db.delete(floors);
  await db.delete(buildings);
  await db.delete(users);

  // 1 admin user — real argon2id hash, not a literal placeholder.
  const adminPassword = await resolveAdminPassword();
  const adminHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@dtfm.local",
      passwordHash: adminHash,
      fullName: "Demo Admin",
      role: "admin",
    })
    .returning();
  console.log(
    `👤 Admin user created: admin@dtfm.local / ${adminPassword}\n` +
      "   (password shown once; copy it now or use --password=<value> next time)",
  );

  // 1 building
  const [building] = await db
    .insert(buildings)
    .values({
      name: "Singapore Convention Centre — Hall 7",
      address: "1 Convention Drive, Singapore 486150",
      totalFloors: 5,
    })
    .returning();

  // 5 floors, 2 rooms each
  const floorRows = await db
    .insert(floors)
    .values(
      Array.from({ length: 5 }, (_, i) => ({
        buildingId: building.id,
        level: i + 1,
        name: `Level ${i + 1}`,
      })),
    )
    .returning();

  const roomRows = await db
    .insert(rooms)
    .values(
      floorRows.flatMap((f) => [
        { floorId: f.id, name: "North Zone" },
        { floorId: f.id, name: "South Zone" },
      ]),
    )
    .returning();

  // 20 assets
  const assetTypes = ["ahu", "chiller", "boiler", "pump", "fan", "elevator", "lighting"] as const;
  const assetRows = await db
    .insert(assets)
    .values(
      Array.from({ length: 20 }, (_, i) => {
        const room = roomRows[i % roomRows.length];
        return {
          buildingId: building.id,
          floorId: room.floorId,
          roomId: room.id,
          name: `${faker.helpers
            .arrayElement(assetTypes)
            .toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
          type: faker.helpers.arrayElement(assetTypes),
          status: faker.helpers.weightedArrayElement([
            { weight: 70, value: "ok" },
            { weight: 15, value: "warning" },
            { weight: 5, value: "critical" },
            { weight: 10, value: "offline" },
          ]),
          manufacturer: faker.company.name(),
          model: faker.string.alphanumeric(8).toUpperCase(),
          positionX: faker.number.float({ min: -10, max: 10 }),
          positionY: faker.number.float({ min: 0, max: 14.65 }),
          positionZ: faker.number.float({ min: -10, max: 10 }),
        };
      }),
    )
    .returning();

  // 60 sensors (3 per asset on average)
  const sensorTypes = [
    { type: "temperature", unit: "C", lo: 18, hi: 28 },
    { type: "humidity", unit: "%", lo: 30, hi: 60 },
    { type: "power", unit: "kW", lo: 0, hi: 100 },
    { type: "vibration", unit: "mm/s", lo: 0, hi: 10 },
    { type: "co2", unit: "ppm", lo: 400, hi: 1000 },
  ] as const;

  const sensorRows = await db
    .insert(sensors)
    .values(
      assetRows.flatMap((a) =>
        faker.helpers.arrayElements(sensorTypes, { min: 2, max: 4 }).map((st) => ({
          assetId: a.id,
          type: st.type,
          unit: st.unit,
          thresholdLow: st.lo,
          thresholdHigh: st.hi,
          status: a.status,
        })),
      ),
    )
    .returning();

  // 1000 readings (last 24h, sampled every ~90s)
  const now = Date.now();
  const readings: typeof sensorReadings.$inferInsert[] = [];
  for (const s of sensorRows) {
    const def = sensorTypes.find((t) => t.type === s.type)!;
    for (let i = 0; i < Math.ceil(1000 / sensorRows.length); i++) {
      readings.push({
        sensorId: s.id,
        assetId: s.assetId,
        timestamp: new Date(now - i * 90_000).toISOString(),
        value: faker.number.float({ min: def.lo, max: def.hi, fractionDigits: 2 }),
        quality: "good",
      });
    }
  }
  await db.insert(sensorReadings).values(readings);

  // 5 alerts
  const alertRows = await db
    .insert(alerts)
    .values(
      Array.from({ length: 5 }, () => {
        const sensor = faker.helpers.arrayElement(sensorRows);
        return {
          sensorId: sensor.id,
          assetId: sensor.assetId,
          severity: faker.helpers.arrayElement(["low", "medium", "high", "critical"] as const),
          status: faker.helpers.arrayElement(["open", "acknowledged", "in_progress"] as const),
          message: faker.helpers.arrayElement([
            "Temperature above threshold",
            "Vibration detected outside normal range",
            "CO2 level elevated",
            "Sensor offline",
          ]),
        };
      }),
    )
    .returning();

  // 8 work orders
  await db.insert(workOrders).values(
    alertRows.map((a, i) => ({
      assetId: a.assetId!,
      alertId: a.id,
      title: `Inspect ${faker.helpers.arrayElement(assetRows).name}`,
      description: faker.lorem.sentence(),
      type: (i % 2 === 0 ? "corrective" : "preventive") as WorkOrderType,
      priority: a.severity,
      status: faker.helpers.arrayElement(["open", "assigned", "in_progress"] as const),
      assignedTo: admin.id,
    })),
  );

  console.log(
    `✅ Seed complete: 1 building, ${floorRows.length} floors, ${roomRows.length} rooms, ${assetRows.length} assets, ${sensorRows.length} sensors, ${readings.length} readings, ${alertRows.length} alerts`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
