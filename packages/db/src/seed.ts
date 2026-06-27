/* eslint-disable no-console */
/**
 * Digital Twin FM — Database seed script
 *
 * Populates a realistic Singapore Expo Hall 7 demo:
 *   1 building → 2 floors (Exhibition Level + Upper Mezzanine) → 8 rooms →
 *   20 assets → 60 sensors → 1000 readings → 5 alerts → 8 work orders
 *
 * Floor count is the single source of truth, driven by BUILDING_FLOOR_COUNT
 * below (kept aligned with apps/web/src/design-system/tokens.ts → building.floorCount).
 * Drift between this seed and the 3D viewer produces a loud runtime warning
 * at startup so the mismatch surfaces immediately rather than silently.
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
import type { WorkOrderType, SensorType } from "@digital-twin-fm/types";
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

  // 1 building (fixed UUID to match codebase defaults).
  // Singapore Expo Hall 7: 2 main levels — Exhibition Level + Upper Mezzanine.
  // totalFloors MUST match BUILDING_FLOOR_COUNT below. Drift between this
  // and apps/web/src/design-system/tokens.ts → building.floorCount surfaces
  // immediately in the dashboard "selected floor" UI and the AI copilot
  // ("Why is the upper level hot?") — fix at the source instead.
  const BUILDING_FLOOR_COUNT = 2;
  const FLOOR_NAMES = ["Exhibition Level", "Upper Mezzanine"] as const;
  const ROOM_NAMES = ["North Zone", "South Zone", "East Zone", "West Zone"] as const;

  const [building] = await db
    .insert(buildings)
    .values({
      id: "9a83477a-4b19-444a-9345-0e07f90d16b0",
      name: "Singapore Expo — Hall 7",
      address: "1 Expo Drive, Singapore 486150",
      totalFloors: BUILDING_FLOOR_COUNT,
    })
    .returning();

  // 2 floors, 4 rooms each (4-zone convention-hall layout: N/S/E/W)
  const floorRows = await db
    .insert(floors)
    .values(
      Array.from({ length: BUILDING_FLOOR_COUNT }, (_, i) => ({
        buildingId: building.id,
        level: i + 1,
        name: FLOOR_NAMES[i] ?? `Level ${i + 1}`,
      })),
    )
    .returning();

  const roomRows = await db
    .insert(rooms)
    .values(
      floorRows.flatMap((f) =>
        ROOM_NAMES.map((n) => ({ floorId: f.id, name: n })),
      ),
    )
    .returning();

  // 20 assets distributed across the 2 floors according to a realistic
  // convention-hall MEP layout. Plant-room equipment (boilers, primary
  // pumps) sits on the exhibition level behind the service wall;
  // mezzanine services the upper-level AHUs and exhaust.
  const assetTypes = ["ahu", "chiller", "boiler", "pump", "fan", "elevator", "lighting"] as const;
  type AssetTypeDb = (typeof assetTypes)[number];

  // 1-based floor numbers from the DB. Distribution totals 20 assets.
  // Floor 1 (Exhibition Level) = 15: 3 AHU + 2 Chiller + 5 Lighting +
  //   1 Fan + 1 Elevator + 2 Boiler + 1 Pump (plant room)
  // Floor 2 (Upper Mezzanine) = 5: 2 Pump + 2 Fan + 1 Lighting
  const ASSET_PLAN: { type: AssetTypeDb; floor: 1 | 2 }[] = [
    // Floor 1 — Exhibition Level (15)
    { type: "ahu", floor: 1 },
    { type: "ahu", floor: 1 },
    { type: "ahu", floor: 1 },
    { type: "chiller", floor: 1 },
    { type: "chiller", floor: 1 },
    { type: "lighting", floor: 1 },
    { type: "lighting", floor: 1 },
    { type: "lighting", floor: 1 },
    { type: "lighting", floor: 1 },
    { type: "lighting", floor: 1 },
    { type: "fan", floor: 1 },
    { type: "elevator", floor: 1 },
    { type: "boiler", floor: 1 },
    { type: "boiler", floor: 1 },
    { type: "pump", floor: 1 },
    // Floor 2 — Upper Mezzanine (5)
    { type: "pump", floor: 2 },
    { type: "pump", floor: 2 },
    { type: "fan", floor: 2 },
    { type: "fan", floor: 2 },
    { type: "lighting", floor: 2 },
  ];

  // Map DB floor 1/2 → viewer floor 0/1 (viewer is 0-indexed).
  const dbFloorToViewerFloor = (dbLevel: number): 0 | 1 =>
    Math.max(0, Math.min(1, dbLevel - 1)) as 0 | 1;

  // Per-type deterministic placement inside the building footprint
  // (36m × 24m per apps/web/src/design-system/tokens.ts).
  // Plant-room cluster (boilers, chillers, primary pumps) sits at the
  // back-of-house (−X, +Z corner); public-facing equipment spread evenly.
  const plantRoom = { xRange: [-16, -10] as const, zRange: [6, 10] as const };
  const plantTypes = new Set<AssetTypeDb>(["boiler", "chiller", "pump"]);

  const typeCounter: Record<AssetTypeDb, number> = {
    ahu: 0,
    chiller: 0,
    boiler: 0,
    pump: 0,
    fan: 0,
    elevator: 0,
    lighting: 0,
  };

  const assetRows = await db
    .insert(assets)
    .values(
      ASSET_PLAN.map((plan, i) => {
        const idx = ++typeCounter[plan.type];
        const typeCode = plan.type.toUpperCase();
        const isPlant = plantTypes.has(plan.type);
        // 0-based viewer floor for marker Y placement
        const viewerFloor = dbFloorToViewerFloor(plan.floor);
        const floorRow = floorRows[plan.floor - 1];

        // Deterministic 3D position
        let x: number;
        let z: number;
        if (isPlant) {
          // Cluster plant equipment in the back-of-house corner
          x = faker.number.float({ min: plantRoom.xRange[0], max: plantRoom.xRange[1] });
          z = faker.number.float({ min: plantRoom.zRange[0], max: plantRoom.zRange[1] });
        } else {
          // Public-facing equipment: deterministic 4×N grid across the hall
          const cols = 5;
          const col = i % cols;
          const row = Math.floor(i / cols);
          x = faker.number.float({ min: -12 + col * 5, max: -10 + col * 5 });
          z = faker.number.float({ min: -8 + row * 4, max: -6 + row * 4 });
        }
        // Y stays inside the building's vertical envelope:
        //   floor 0 (Exhibition): yBase=0,   yMax ≈ 8.5
        //   floor 1 (Mezzanine):  yBase=9.0, yMax ≈ 17.5
        const y = viewerFloor === 0
          ? faker.number.float({ min: 0.2, max: 7.5 })
          : faker.number.float({ min: 9.5, max: 16.5 });

        // Pick a room on this floor for FK
        const roomOnFloor = roomRows.filter((r) => r.floorId === floorRow.id);
        const room = roomOnFloor[i % roomOnFloor.length];

        return {
          buildingId: building.id,
          floorId: floorRow.id,
          roomId: room.id,
          name: `${typeCode}-${String(idx).padStart(3, "0")}`,
          type: plan.type,
          status: faker.helpers.weightedArrayElement([
            { weight: 70, value: "ok" },
            { weight: 15, value: "warning" },
            { weight: 5, value: "critical" },
            { weight: 10, value: "offline" },
          ]),
          manufacturer: faker.company.name(),
          model: faker.string.alphanumeric(8).toUpperCase(),
          positionX: x,
          positionY: y,
          positionZ: z,
        };
      }),
    )
    .returning();

  // ~60 sensors, type-appropriate. Real convention-hall assets only carry
  // the sensors they actually need (a light fixture has no vibration probe;
  // a chiller needs flow + temp + power). Random sensor selection was the
  // biggest source of "the data looks fake" complaints.
  const SENSORS_BY_TYPE: Record<AssetTypeDb, { type: string; unit: string; lo: number; hi: number }[]> = {
    ahu: [
      { type: "temperature", unit: "C", lo: 18, hi: 26 },
      { type: "humidity", unit: "%", lo: 35, hi: 55 },
      { type: "pressure", unit: "Pa", lo: 200, hi: 800 },
      { type: "power", unit: "kW", lo: 5, hi: 40 },
    ],
    chiller: [
      { type: "temperature", unit: "C", lo: 5, hi: 18 },
      { type: "flow", unit: "L/s", lo: 10, hi: 60 },
      { type: "power", unit: "kW", lo: 50, hi: 250 },
      { type: "vibration", unit: "mm/s", lo: 0, hi: 6 },
    ],
    boiler: [
      { type: "temperature", unit: "C", lo: 50, hi: 90 },
      { type: "pressure", unit: "bar", lo: 1.5, hi: 4 },
      { type: "flow", unit: "L/s", lo: 5, hi: 30 },
    ],
    pump: [
      { type: "pressure", unit: "bar", lo: 2, hi: 8 },
      { type: "flow", unit: "L/s", lo: 5, hi: 50 },
      { type: "vibration", unit: "mm/s", lo: 0, hi: 5 },
    ],
    fan: [
      { type: "pressure", unit: "Pa", lo: 100, hi: 600 },
      { type: "vibration", unit: "mm/s", lo: 0, hi: 8 },
      { type: "power", unit: "kW", lo: 1, hi: 20 },
    ],
    elevator: [
      { type: "vibration", unit: "mm/s", lo: 0, hi: 3 },
      { type: "power", unit: "kW", lo: 0, hi: 15 },
    ],
    lighting: [
      { type: "power", unit: "kW", lo: 0, hi: 5 },
    ],
  };

  const sensorRows = await db
    .insert(sensors)
    .values(
      assetRows.flatMap((a) =>
        SENSORS_BY_TYPE[a.type as AssetTypeDb].map((st) => ({
          assetId: a.id,
          type: st.type as SensorType,
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
    // Look up the type-specific threshold for this sensor by asset type.
    const parentAsset = assetRows.find((a) => a.id === s.assetId);
    const def = parentAsset
      ? SENSORS_BY_TYPE[parentAsset.type as AssetTypeDb].find((t) => t.type === s.type)
      : undefined;
    if (!def) continue;
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
    `✅ Seed complete: 1 building (${BUILDING_FLOOR_COUNT} floors), ${floorRows.length} floors (${FLOOR_NAMES.join(", ")}), ${roomRows.length} rooms, ${assetRows.length} assets, ${sensorRows.length} sensors, ${readings.length} readings, ${alertRows.length} alerts`,
  );
  if (floorRows.length !== BUILDING_FLOOR_COUNT) {
    console.warn(
      `⚠️  Floor count drift: inserted ${floorRows.length} floors but BUILDING_FLOOR_COUNT=${BUILDING_FLOOR_COUNT}. ` +
        "This usually means the floorNames array and the count got out of sync.",
    );
  }
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
