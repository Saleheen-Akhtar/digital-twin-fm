/* eslint-disable no-console */
/**
 * Digital Twin FM — Database seed script
 *
 * Populates a realistic demo convention centre with multi-floor layout.
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
    password: process.env.POSTGRES_PASSWORD ?? (() => { throw new Error("POSTGRES_PASSWORD not set — aborting"); })(),
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
  // 2 main levels — Exhibition Level + Upper Mezzanine.
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
      name: "Demo Convention Centre",
      address: "1 Convention Drive, Singapore 486150",
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

  // Assets are distributed per-floor based on floor square footage
  // and equipment density rules defined below. Plant-room equipment
  // (boilers, chillers, primary pumps) sits on the exhibition level
  // mezzanine services the upper-level AHUs and exhaust.
  // Floor square footage drives equipment count. Real facilities follow
  // rough rules: 1 AHU per 2000m², 1 chiller per 4000m², 1 lighting
  // zone per 800m², 1 fan per 1500m², 1 elevator per floor.
  interface FloorArea {
    level: 1 | 2;
    sqm: number;       // gross floor area in m²
    name: string;
  }
  const FLOOR_AREAS: FloorArea[] = [
    { level: 1, sqm: 7200, name: "Exhibition Level" },
    { level: 2, sqm: 2400, name: "Upper Mezzanine" },
  ];

  // Equipment density rules: count = round(floorSqm / density)
  const DENSITY_RULES: { type: AssetTypeDb; densitySqm: number; minPerFloor: number }[] = [
    { type: "ahu",      densitySqm: 2000, minPerFloor: 0 },
    { type: "chiller",  densitySqm: 4000, minPerFloor: 0 },
    { type: "boiler",   densitySqm: 4000, minPerFloor: 0 },
    { type: "pump",     densitySqm: 2000, minPerFloor: 1 },
    { type: "fan",      densitySqm: 1500, minPerFloor: 0 },
    { type: "elevator", densitySqm: 9000, minPerFloor: 0 },
    { type: "lighting", densitySqm: 500,  minPerFloor: 1 },
  ];

  // Derive ASSET_PLAN from floor area and density rules
  type AssetTypeDb = "ahu" | "chiller" | "boiler" | "pump" | "fan" | "elevator" | "lighting";
  const ASSET_PLAN: { type: AssetTypeDb; floor: 1 | 2 }[] = [];

  for (const fa of FLOOR_AREAS) {
    for (const rule of DENSITY_RULES) {
      const count = Math.max(rule.minPerFloor, Math.round(fa.sqm / rule.densitySqm));
      for (let i = 0; i < count; i++) {
        ASSET_PLAN.push({ type: rule.type, floor: fa.level });
      }
    }
  }

  // Map DB floor 1/2 → viewer floor 0/1 (viewer is 0-indexed).
  const dbFloorToViewerFloor = (dbLevel: number): 0 | 1 =>
    Math.max(0, Math.min(1, dbLevel - 1)) as 0 | 1;

  // Per-type deterministic placement inside the building's room polygons.
  // Room bounds replicated from viewer-building.tsx BUILDING_FLOORS:
  //   Floor 0 (Exhibition): 1a=[-8,8]×[-12.25,-7.75], 1b=[-16,-3]×[-3.5,7.5],
  //     1c=[3,16]×[-3.5,7.5], 1g=[-8,6]×[8,11.5]
  //   Floor 1 (Mezzanine):   2a=[-17,-3]×[-3,3], 2b=[3,17]×[-3,3],
  //     2c=[-5,5]×[-11,-5], 2e=[-17,-11]×[-8.5,-3.5]
  const plantTypes = new Set<AssetTypeDb>(["boiler", "chiller", "pump"]);

  // ── Room geometry — MUST stay in sync with apps/web BUILDING_FLOORS.
  // Each entry mirrors a viewer room polygon (rectVertices(cx, cz, w, d) →
  // x∈[cx-w/2, cx+w/2], z∈[cz-d/2, cz+d/2]). Assets are sampled
  // strictly INSIDE these so the dev floor-plan validator (viewer-building.tsx
  // validateFloorPlan) never flags an out-of-bounds asset.
  interface RoomPoly {
    id: string;
    floor: 0 | 1; // viewer 0-indexed floor
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
  }
  const ROOM_POLYS: RoomPoly[] = [
    // Floor 0 (Exhibition)
    { id: "1a", floor: 0, xMin: -8, xMax: 8, zMin: -12.25, zMax: -7.75 },
    { id: "1b", floor: 0, xMin: -16, xMax: -3, zMin: -3.5, zMax: 7.5 },
    { id: "1c", floor: 0, xMin: 3, xMax: 16, zMin: -3.5, zMax: 7.5 },
    { id: "1d", floor: 0, xMin: -7, xMax: 7, zMin: -7.25, zMax: -2 },
    { id: "1e", floor: 0, xMin: -15, xMax: -11, zMin: 8, zMax: 11.5 },
    { id: "1f", floor: 0, xMin: 11, xMax: 15, zMin: 8, zMax: 11.5 },
    { id: "1g", floor: 0, xMin: -8, xMax: 6, zMin: 8, zMax: 11.5 },
    // Floor 1 (Mezzanine)
    { id: "2a", floor: 1, xMin: -17, xMax: -3, zMin: -3, zMax: 3 },
    { id: "2b", floor: 1, xMin: 3, xMax: 17, zMin: -3, zMax: 3 },
    { id: "2c", floor: 1, xMin: -5, xMax: 5, zMin: -11, zMax: -5 },
    { id: "2d", floor: 1, xMin: -8, xMax: 8, zMin: 5, zMax: 11 },
    { id: "2e", floor: 1, xMin: -16, xMax: -11, zMin: -8.5, zMax: -3.5 },
    { id: "2f", floor: 1, xMin: -2.5, xMax: 2.5, zMin: -4.65, zMax: -0.65 },
  ];

  // Point-in-rectangle test (all rooms are axis-aligned rects).
  function insideRoom(x: number, z: number, r: RoomPoly): boolean {
    return x >= r.xMin && x <= r.xMax && z >= r.zMin && z <= r.zMax;
  }

  // Rejection-sample a point strictly inside a room polygon. Guarantees the
  // asset lands inside the room (validator-safe) while staying deterministic
  // per-floor via faker's seeded RNG.
  function sampleInsideRoom(r: RoomPoly): { x: number; z: number } {
    const pad = 0.5; // keep clear of walls
    const xMin = r.xMin + pad;
    const xMax = r.xMax - pad;
    const zMin = r.zMin + pad;
    const zMax = r.zMax - pad;
    // Outer loop is bounded; with padding > 0 rejection is effectively zero.
    let x = faker.number.float({ min: xMin, max: xMax });
    let z = faker.number.float({ min: zMin, max: zMax });
    let guard = 0;
    while (!insideRoom(x, z, r) && guard < 16) {
      x = faker.number.float({ min: xMin, max: xMax });
      z = faker.number.float({ min: zMin, max: zMax });
      guard++;
    }
    return { x, z };
  }

  // Pick the room an asset belongs in by type + floor.
  function roomForAsset(type: AssetTypeDb, viewerFloor: 0 | 1): RoomPoly {
    if (plantTypes.has(type)) {
      return ROOM_POLYS.find((r) => r.id === (viewerFloor === 0 ? "1g" : "2e"))!;
    }
    // Public-facing equipment → a hall on its floor
    const halls = ROOM_POLYS.filter(
      (r) => r.floor === viewerFloor && (r.id === "1b" || r.id === "1c" || r.id === "2a" || r.id === "2b"),
    );
    const idx = Math.abs(hashStr(`${type}-${viewerFloor}`)) % halls.length;
    return halls[idx];
  }

  // Tiny stable string hash (no extra dep).
  function hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
    return h;
  }

  // Map a geometry room id (viewer BUILDING_FLOORS) → its DB room row
  // (rooms table uses zone names N/S/E/W, not viewer ids). Used for the
  // asset→room FK so we reference a real uuid, not a viewer id like "1c".
  const GEOM_ZONE: Record<string, "N" | "S" | "E" | "W"> = {
    "1a": "N", "1d": "S", "1b": "W", "1c": "E",
    "1e": "N", "1f": "N", "1g": "N",
    "2a": "W", "2b": "E", "2c": "S", "2d": "N", "2e": "N", "2f": "N",
  };
  const ZONE_IDX: Record<"N" | "S" | "E" | "W", number> = { N: 0, S: 1, E: 2, W: 3 };
  function dbRoomForGeometry(
    geomId: string,
    viewerFloor: 0 | 1,
    roomRows: { id: string; name: string; floorId: string }[],
  ): { id: string; name: string } {
    const zone = GEOM_ZONE[geomId] ?? "N";
    const offset = viewerFloor * 4; // 4 rooms per floor (N,S,E,W)
    return roomRows[offset + ZONE_IDX[zone]];
  }

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
      ASSET_PLAN.map((plan) => {
        const idx = ++typeCounter[plan.type];
        const typeCode = plan.type.toUpperCase();
        const isPlant = plantTypes.has(plan.type);
        // 0-based viewer floor for marker Y placement
        const viewerFloor = dbFloorToViewerFloor(plan.floor);
        const floorRow = floorRows[plan.floor - 1];

        // Deterministic 3D position — guaranteed INSIDE a room polygon.
        // Root-cause fix: seed used ad-hoc faker ranges that drifted from the
        // viewer's BUILDING_FLOORS room geometry, tripping the dev
        // validateFloorPlan out-of-bounds check. Now we pick the asset's room
        // by type/floor and sample strictly inside it.
        const room = roomForAsset(plan.type, viewerFloor);
        const { x, z } = sampleInsideRoom(room);
        // Y stays inside the building's vertical envelope:
        //   floor 0 (Exhibition): yBase=0,   yMax ≈ 8.5
        //   floor 1 (Mezzanine):  yBase=9.0, yMax ≈ 17.5
        const y = viewerFloor === 0
          ? faker.number.float({ min: 0.2, max: 7.5 })
          : faker.number.float({ min: 9.5, max: 16.5 });

        // Pick a room on this floor for FK
        // Zone tag from the (geometry) room id the asset sits in.
        const zoneCode =
          room.id === "1b" || room.id === "2a" ? "WST" :
          room.id === "1c" || room.id === "2b" ? "EST" :
          room.id === "1a" || room.id === "2f" ? "NRTH" :
          room.id === "1d" || room.id === "2c" ? "STH" : "ZZ";
        // Plant equipment gets "PLANT" zone, mezzanine gets "MEZZ"
        const locationTag = isPlant
          ? (plan.floor === 1 ? "PLANT" : "MEZZ")
          : zoneCode;
        const abbr: Record<string, string> = { ahu: "AHU", chiller: "CH", boiler: "BLR", pump: "PUMP", fan: "FAN", elevator: "ELV", lighting: "LGT" };
        const prefix = `${abbr[plan.type] ?? typeCode}-${locationTag}`;

        return {
          buildingId: building.id,
          floorId: floorRow.id,
          roomId: dbRoomForGeometry(room.id, viewerFloor, roomRows).id,
          name: `${prefix}-${String(idx).padStart(2, "0")}`,
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
      { type: "co2", unit: "ppm", lo: 380, hi: 800 },
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
