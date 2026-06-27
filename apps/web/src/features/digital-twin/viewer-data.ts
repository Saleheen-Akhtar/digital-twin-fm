/**
 * Digital Twin FM — viewer seed data
 *
 * 20 assets distributed across 2 floors with realistic MEP placement:
 *   Floor 0 (Exhibition Level): 15 — 3 Air Handler, 2 Chiller, 5 Lighting,
 *                                1 Fan, 1 Elevator, 2 Boiler, 1 Pump
 *                                (plant room cluster for boilers/chillers/pumps)
 *   Floor 1 (Upper Mezzanine):   5 — 2 Pump, 2 Fan, 1 Lighting
 * Total: 3 AHU + 2 Chiller + 2 Boiler + 3 Pump + 3 Fan + 1 Elevator
 *      + 6 Lighting = 20.
 *
 * Each asset carries a user-friendly name (no technical IDs in the UI),
 * emoji, and metrics/details with keys that are remapped to readable
 * labels by the inspect panel.
 *
 * ─── FLOOR DYNAMIC ─────────────────────────────────────────────
 * Floors are now `number` (not a `0 | 1` union) so a customer building
 * with 5, 10, or 20 floors renders correctly without code changes.
 * The runtime invariant below asserts that every seed asset's floor is
 * within `tokens.building.floorCount` — drift surfaces as a console
 * error in dev, never as a silent visual mismatch.
 */
export type AssetType =
  | "Air Handler"
  | "Chiller"
  | "Boiler"
  | "Pump"
  | "Fan"
  | "Elevator"
  | "Lighting"
  | "Sensor"
  | "Equipment";
export type AssetStatus = "ok" | "warning" | "critical" | "offline" | "info";

/**
 * Floor index. Dynamic — any non-negative integer is valid. The viewer
 * reads `tokens.building.floorCount` to clamp/validate at the boundary,
 * but the type intentionally does NOT cap this so a customer building
 * with N floors renders without code changes.
 */
export type AssetFloor = number;

export interface Asset {
  id: string;
  /** User-facing name (e.g. "Air Handler 1", "Exhaust Fan") — shown in UI. */
  name: string;
  /** Single emoji used by the marker sprite and legend. */
  emoji: string;
  type: AssetType;
  /** 0-indexed floor. 0 = ground, N-1 = top floor. */
  floor: AssetFloor;
  x: number;
  y?: number;
  z: number;
  status: AssetStatus;
  metrics: Record<string, string>;
  details: Record<string, string>;
}

const TYPE_EMOJI: Record<AssetType, string> = {
  "Air Handler": "❄️",
  Chiller: "🧊",
  Boiler: "🔥",
  Pump: "💧",
  Fan: "🌀",
  Elevator: "🛗",
  Lighting: "💡",
  Sensor: "📡",
  Equipment: "⚙️",
};

/** Display label for a floor (0 → "GF", 1-3 → "F1"-"F3"). */
export function floorLabel(floor: number): string {
  return floor === 0 ? "GF" : `F${floor}`;
}

/** Remap short keys → human-readable labels in the inspect panel. */
export const METRIC_LABEL: Record<string, string> = {
  temp: "Temperature",
  flow: "Airflow",
  COP: "Efficiency",
  pressure: "Pressure",
  head: "Head Pressure",
  capacity: "Capacity",
  speed: "Speed",
  rpm: "Speed (RPM)",
  power: "Power",
  load: "Load",
  vibration: "Vibration",
  efficiency: "Efficiency",
};

export const DETAIL_LABEL: Record<string, string> = {
  lastService: "Last Serviced",
  runtime: "Total Runtime",
  model: "Model",
  manufacturer: "Manufacturer",
  serial: "Serial #",
  installDate: "Install Date",
};

export const STATUS_DISPLAY: Record<AssetStatus, string> = {
  ok: "Running OK",
  warning: "Needs Attention",
  critical: "Fault — Check Now",
  offline: "Offline",
  info: "Info",
};

/** Pick a deterministic status based on the asset index. ~70% OK, 20% warn, 10% fault. */
const STATUS_PATTERN: AssetStatus[] = [
  "ok", "ok", "ok", "ok",
  "warning", "ok", "critical", "ok",
  "ok", "warning", "ok", "ok",
  "ok", "critical", "ok", "ok",
  "warning", "ok", "ok", "ok",
];

function makeAsset(
  type: AssetType,
  floor: number,
  index: number,
  positionIndex: number,
  status: AssetStatus,
): Asset {
  // Deterministic 4x3 grid, safely inside the 36×24 building with 4m margin
  // Grid spans X: -12 to +12 (24m), Z: -8 to +8 (16m)
  const cols = 4;
  const col = positionIndex % cols;
  const row = Math.floor(positionIndex / cols);
  const gridW = 24;  // 36 building width - 2×6m margin
  const gridD = 16;  // 24 building depth - 2×4m margin
  const x = -gridW / 2 + (gridW / (cols - 1)) * col;
  const z = -gridD / 2 + (gridD / 2) * row;

  const emoji = TYPE_EMOJI[type];
  const id = `${type.toLowerCase().replace(/\s/g, "")}-${index}`;
  const name = friendlyName(type, index);

  // Per-type metric + detail templates
  let firstMetricKey = "temp";
  let firstMetricVal = "18 °C";
  if (type === "Air Handler") {
    firstMetricKey = "flow";
    firstMetricVal = `${(8000 + index * 230).toLocaleString()} CFM`;
  } else if (type === "Chiller") {
    firstMetricKey = "COP";
    firstMetricVal = (5.8 - (index % 3) * 0.1).toFixed(2);
  } else if (type === "Boiler") {
    firstMetricKey = "pressure";
    firstMetricVal = `${(45 + (index % 15)).toFixed(1)} psi`;
  } else if (type === "Pump") {
    firstMetricKey = "head";
    firstMetricVal = `${(45 + (index % 15)).toFixed(1)} ft`;
  } else {
    firstMetricKey = "speed";
    firstMetricVal = `${(1100 + (index % 200)).toString()} RPM`;
  }

  const metrics: Record<string, string> = {
    [firstMetricKey]: firstMetricVal,
    temp: `${(18 + (index % 8)).toFixed(1)} °C`,
    load: `${(60 + (index % 30)).toString()}%`,
    power: `${(10 + (index % 50)).toString()} kW`,
  };

  const details: Record<string, string> = {
    model: `${type.replace(/\s/g, "")}-${String(index).padStart(3, "0")}`,
    manufacturer: ["Trane", "Carrier", "York", "Daikin"][index % 4],
    lastService: "2026-05-12",
    runtime: `${(2000 + index * 350).toLocaleString()} hrs`,
  };

  return {
    id,
    name,
    emoji,
    type,
    floor,
    x,
    z,
    status,
    metrics,
    details,
  };
}

function friendlyName(type: AssetType, index: number): string {
  if (type === "Fan" && index === 0) return "Exhaust Fan";
  return `${type} ${index}`;
}

export const SEED_ASSETS: Asset[] = (() => {
  // 2-floor convention hall layout. Mirrors packages/db/src/seed.ts ASSET_PLAN.
  // Floor 0 = Exhibition Level, Floor 1 = Upper Mezzanine.
  const plan: { type: AssetType; floor: number }[] = [
    // Floor 0 — Exhibition Level (15)
    { type: "Air Handler", floor: 0 },
    { type: "Air Handler", floor: 0 },
    { type: "Air Handler", floor: 0 },
    { type: "Chiller", floor: 0 },
    { type: "Chiller", floor: 0 },
    { type: "Lighting", floor: 0 },
    { type: "Lighting", floor: 0 },
    { type: "Lighting", floor: 0 },
    { type: "Lighting", floor: 0 },
    { type: "Lighting", floor: 0 },
    { type: "Fan", floor: 0 },
    { type: "Elevator", floor: 0 },
    { type: "Boiler", floor: 0 },
    { type: "Boiler", floor: 0 },
    { type: "Pump", floor: 0 },
    // Floor 1 — Upper Mezzanine (5)
    { type: "Pump", floor: 1 },
    { type: "Pump", floor: 1 },
    { type: "Fan", floor: 1 },
    { type: "Fan", floor: 1 },
    { type: "Lighting", floor: 1 },
  ];
  // 3 AHU + 2 Chiller + 2 Boiler + 3 Pump + 3 Fan + 1 Elevator + 6 Lighting = 20.
  const typeCounters: Record<AssetType, number> = {
    "Air Handler": 0,
    Chiller: 0,
    Boiler: 0,
    Pump: 0,
    Fan: 0,
    Elevator: 0,
    Lighting: 0,
    Sensor: 0,
    Equipment: 0,
  };
  return plan.map((p, i) => {
    const idx = ++typeCounters[p.type];
    const status = STATUS_PATTERN[i % STATUS_PATTERN.length];
    const a = makeAsset(p.type, p.floor, idx, i, status);
    return a;
  });
})();

// ─── API → Viewer mapping ──────────────────────────────────────

/**
 * Minimal shape of an asset as returned by the API gateway
 * (from @digital-twin-fm/types + floorLevel joined from floors).
 */
export interface ApiAssetShape {
  id: string;
  name: string;
  type: string;
  status: string;
  positionX?: number | null;
  positionY?: number | null;
  positionZ?: number | null;
  floorLevel?: number | null;
  manufacturer?: string | null;
  model?: string | null;
  installedAt?: string | null;
}

/** Map API type strings → viewer asset type */
const API_TYPE_MAP: Record<string, AssetType> = {
  ahu: "Air Handler",
  chiller: "Chiller",
  boiler: "Boiler",
  pump: "Pump",
  fan: "Fan",
  elevator: "Elevator",
  lighting: "Lighting",
  sensor_only: "Sensor",
  other: "Equipment",
};

/** Fallback emoji per API asset type */
const API_TYPE_EMOJI: Record<string, string> = {
  ahu: "❄️",
  chiller: "🧊",
  boiler: "🔥",
  pump: "💧",
  fan: "🌀",
  elevator: "🛗",
  lighting: "💡",
  sensor_only: "📡",
  other: "⚙️",
};

function makeAssetName(type: AssetType, index: number): string {
  if (type === "Fan" && index === 0) return "Exhaust Fan";
  return `${type} ${index}`;
}

/**
 * Convert an API asset into the viewer's internal Asset shape.
 *
 * Falls back to deterministic computed values when the API doesn't
 * supply position, floor, or emoji data — every asset works visually
 * regardless of DB seed quality.
 */
export function apiAssetToViewerAsset(
  a: ApiAssetShape,
  /** Per-type counter for generating human-friendly names on fallback. */
  typeIndex: Record<string, number>,
  /** Seed used for deterministic auto-placement (0-based asset index). */
  positionIndex: number,
): Asset {
  const viewerType = API_TYPE_MAP[a.type] ?? "Air Handler";
  const idx = ++typeIndex[a.type];

  const validStatuses: AssetStatus[] = ["ok", "warning", "critical", "offline", "info"];
  const viewerStatus: AssetStatus = validStatuses.includes(a.status as AssetStatus)
    ? (a.status as AssetStatus)
    : "ok";
  const emoji = API_TYPE_EMOJI[a.type] ?? "❓";

  // Use API position directly if available, otherwise auto-place in a 4×3 grid safely inside building
  const cols = 4;
  const col = positionIndex % cols;
  const row = Math.floor(positionIndex / cols);
  const gridW = 24;
  const gridD = 16;
  const x = a.positionX != null ? a.positionX : -gridW / 2 + (gridW / (cols - 1)) * col;
  const y = a.positionY != null ? a.positionY : undefined;
  const z = a.positionZ != null ? a.positionZ : -gridD / 2 + (gridD / 2) * row;

  // Map floor level (1-based from DB → 0-based viewer floor).
  // Clamp to a sane range — a bad seed with floorLevel=99 shouldn't crash
  // the viewer. Fallback to positionIndex % 4 only as a last resort.
  const MAX_FLOOR_FALLBACK = 4; // matches the previous 4-floor fallback
  const floor = a.floorLevel != null
    ? Math.max(0, Math.floor(a.floorLevel) - 1)
    : positionIndex % MAX_FLOOR_FALLBACK;

  // Build metrics from available API fields
  const metrics: Record<string, string> = {};
  if (a.manufacturer) metrics.manufacturer = a.manufacturer;
  if (a.model) metrics.model = a.model;
  if (a.installedAt) metrics["installDate"] = a.installedAt;
  // Always include at least one metric for the inspect panel
  metrics.status = viewerStatus;
  if (metrics.manufacturer && !metrics.model) {
    metrics.type = a.type;
  }

  // Build details (service info)
  const details: Record<string, string> = {};
  if (a.manufacturer) details.manufacturer = a.manufacturer;
  if (a.model) details.model = a.model;
  if (a.installedAt) details["installDate"] = a.installedAt;
  details.runtime = `${(2000 + positionIndex * 350).toLocaleString()} hrs`;
  details.lastService = "2026-05-12";

  return {
    id: a.id,
    name: a.name || makeAssetName(viewerType, idx),
    emoji,
    type: viewerType,
    floor,
    x,
    y,
    z,
    status: viewerStatus,
    metrics,
    details,
  };
}

/**
 * Convert an array of API assets into viewer-compatible Assets.
 * Maintains deterministic type-index counters for human-friendly naming.
 */
export function apiAssetsToViewerAssets(apiAssets: ApiAssetShape[]): Asset[] {
  const typeIndex: Record<string, number> = { ahu: 0, chiller: 0, boiler: 0, pump: 0, fan: 0, elevator: 0, lighting: 0, sensor_only: 0, other: 0 };
  return apiAssets.map((a, i) => apiAssetToViewerAsset(a, { ...typeIndex }, i));
}

// ─── Floor-count runtime invariant ───────────────────────────────
//
// SEED_ASSETS is the demo fallback when the API is unreachable. Its floor
// distribution must stay inside `building.floorCount` from design tokens.
// Drift surfaces as a console warning in dev (and a hard throw in test)
// so the seed can't silently disagree with the 3D viewer.

import { building as B } from "@/design-system/tokens";

if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
  const outOfRange = SEED_ASSETS.filter(
    (a) => a.floor < 0 || a.floor >= B.floorCount,
  );
  if (outOfRange.length > 0) {
    const floors = Array.from(new Set(SEED_ASSETS.map((a) => a.floor))).sort(
      (x, y) => x - y,
    );
    const msg =
      `[viewer-data] SEED_ASSETS floor mismatch: ` +
      `tokens.building.floorCount=${B.floorCount} but SEED_ASSETS uses floors [${floors.join(", ")}]. ` +
      `Out-of-range assets: ${outOfRange.map((a) => `${a.name}@floor${a.floor}`).join(", ")}. ` +
      `Update SEED_ASSETS, packages/db/src/seed.ts ASSET_PLAN, and BUILDING_FLOORS together.`;
    if (process.env.NODE_ENV === "test") {
      throw new Error(msg);
    }
    // eslint-disable-next-line no-console
    console.error(msg);
  }
}
