/**
 * Digital Twin FM — viewer seed data
 *
 * 20 assets distributed across 4 floors with at least 3 per floor:
 *   Floor 0: 6 (3 Chiller, 2 Boiler, 1 Pump)
 *   Floor 1: 5 (3 Air Handler, 2 Pump)
 *   Floor 2: 5 (2 Air Handler, 1 Chiller, 1 Pump, 1 Fan)
 *   Floor 3: 4 (1 Chiller, 2 Boiler, 1 Fan)
 * Total: 5 AHU, 4 Chiller, 4 Boiler, 4 Pump, 3 Fan = 20.
 *
 * Each asset carries a user-friendly name (no technical IDs in the UI),
 * emoji, and metrics/details with keys that are remapped to readable
 * labels by the inspect panel.
 */
export type AssetType =
  | "Air Handler"
  | "Chiller"
  | "Boiler"
  | "Pump"
  | "Fan";
export type AssetStatus = "operational" | "warning" | "fault";

export interface Asset {
  id: string;
  /** User-facing name (e.g. "Air Handler 1", "Exhaust Fan") — shown in UI. */
  name: string;
  /** Single emoji used by the marker sprite and legend. */
  emoji: string;
  type: AssetType;
  /** 0 = ground floor, 1-3 = upper floors. */
  floor: 0 | 1 | 2 | 3;
  x: number;
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
  operational: "Running OK",
  warning: "Needs Attention",
  fault: "Fault — Check Now",
};

/** Pick a deterministic status based on the asset index. ~70% OK, 20% warn, 10% fault. */
const STATUS_PATTERN: AssetStatus[] = [
  "operational", "operational", "operational", "operational",
  "warning", "operational", "fault", "operational",
  "operational", "warning", "operational", "operational",
  "operational", "fault", "operational", "operational",
  "warning", "operational", "operational", "operational",
];

function makeAsset(
  type: AssetType,
  floor: 0 | 1 | 2 | 3,
  index: number,
  positionIndex: number,
  status: AssetStatus,
): Asset {
  // Deterministic 5x4 grid spread across the 18x14 floor footprint
  const cols = 5;
  const col = positionIndex % cols;
  const row = Math.floor(positionIndex / cols);
  const W = 16;
  const D = 12;
  const x = -W / 2 + (W / (cols - 1)) * col;
  const z = -D / 2 + (D / 3) * row;

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
  // Distribution: ≥3 per floor
  const plan: { type: AssetType; floor: 0 | 1 | 2 | 3 }[] = [
    // Floor 0 — mechanical room (6)
    { type: "Chiller", floor: 0 },
    { type: "Chiller", floor: 0 },
    { type: "Chiller", floor: 0 },
    { type: "Boiler", floor: 0 },
    { type: "Boiler", floor: 0 },
    { type: "Pump", floor: 0 },
    // Floor 1 (5)
    { type: "Air Handler", floor: 1 },
    { type: "Air Handler", floor: 1 },
    { type: "Air Handler", floor: 1 },
    { type: "Pump", floor: 1 },
    { type: "Pump", floor: 1 },
    // Floor 2 (5)
    { type: "Air Handler", floor: 2 },
    { type: "Air Handler", floor: 2 },
    { type: "Chiller", floor: 2 },
    { type: "Pump", floor: 2 },
    { type: "Fan", floor: 2 },
    // Floor 3 (4)
    { type: "Boiler", floor: 3 },
    { type: "Boiler", floor: 3 },
    { type: "Chiller", floor: 3 },
    { type: "Fan", floor: 3 },
  ];
  // 5 AHU, 4 Chiller, 4 Boiler, 4 Pump, 3 Fan = 20. Fan indices: 1 (F2), 1 (F3).
  // We need to pick status per asset index. Track a running counter per type.
  const typeCounters: Record<AssetType, number> = {
    "Air Handler": 0,
    Chiller: 0,
    Boiler: 0,
    Pump: 0,
    Fan: 0,
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

/** Map API status strings → viewer status */
const API_STATUS_MAP: Record<string, AssetStatus> = {
  ok: "operational",
  warning: "warning",
  critical: "fault",
  offline: "fault",
  info: "operational",
};

/** Map API type strings → viewer asset type */
const API_TYPE_MAP: Record<string, AssetType> = {
  ahu: "Air Handler",
  chiller: "Chiller",
  boiler: "Boiler",
  pump: "Pump",
  fan: "Fan",
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

  const viewerStatus = API_STATUS_MAP[a.status] ?? "operational";
  const emoji = API_TYPE_EMOJI[a.type] ?? "❓";

  // Use API position if available, otherwise auto-place in a 5×4 grid
  const cols = 5;
  const col = positionIndex % cols;
  const row = Math.floor(positionIndex / cols);
  const W = 16;
  const D = 12;
  const x = a.positionZ != null ? a.positionZ : -W / 2 + (W / (cols - 1)) * col;
  const z = a.positionX != null ? a.positionX : -D / 2 + (D / 3) * row;

  // Map floor level (1-based from DB → 0-based viewer floor)
  const floor = a.floorLevel != null
    ? (Math.max(0, a.floorLevel - 1) as 0 | 1 | 2 | 3)
    : ((positionIndex % 4) as 0 | 1 | 2 | 3);

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
