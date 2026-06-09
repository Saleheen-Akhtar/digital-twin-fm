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
