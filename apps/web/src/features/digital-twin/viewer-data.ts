/**
 * Digital Twin FM — viewer seed data
 *
 * 20 assets distributed across 4 floors (5 AHU, 4 Chiller, 4 Boiler,
 * 4 Pump, 3 Fan) with realistic per-asset metrics and service details.
 * Deterministic so the demo always shows the same scene.
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
  name: string;
  type: AssetType;
  /** 0 = ground floor, 1-3 = upper floors */
  floor: 0 | 1 | 2 | 3;
  x: number;
  z: number;
  status: AssetStatus;
  metrics: Record<string, string>;
  details: Record<string, string>;
}

const TYPE_DISTRIBUTION: { type: AssetType; prefix: string }[] = [
  { type: "Air Handler", prefix: "AHU" },
  { type: "Chiller", prefix: "CH" },
  { type: "Boiler", prefix: "BL" },
  { type: "Pump", prefix: "PP" },
  { type: "Fan", prefix: "FN" },
];

/** Deterministic grid layout: 5x4 columns, spread across the 18x14 floor. */
function gridPosition(index: number, floor: number): { x: number; z: number } {
  const cols = 5;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const W = 16;
  const D = 12;
  const xOffset = -W / 2 + (W / (cols - 1)) * col;
  const zOffset = -D / 2 + (D / 3) * row;
  return { x: xOffset, z: zOffset };
}

const STATUS_ROTATION: AssetStatus[] = [
  "operational",
  "operational",
  "operational",
  "operational",
  "warning",
  "operational",
  "fault",
  "operational",
  "operational",
  "warning",
  "operational",
  "operational",
  "operational",
  "fault",
  "operational",
  "operational",
  "warning",
  "operational",
  "operational",
  "operational",
];

function makeAsset(
  index: number,
  type: AssetType,
  prefix: string,
  floor: 0 | 1 | 2 | 3,
): Asset {
  const { x, z } = gridPosition(index, floor);
  const num = String(index + 1).padStart(3, "0");
  const status = STATUS_ROTATION[index % STATUS_ROTATION.length];

  const baseMetrics: Record<string, string> = {};
  const baseDetails: Record<string, string> = {
    Manufacturer: ["Trane", "Carrier", "York", "Daikin"][index % 4],
    Model: `${prefix}-${num}`,
    "Serial #": `SN${(index * 7919 + 100003).toString().padStart(8, "0")}`,
    "Install Date": "2022-03-15",
    "Last Service": "2026-05-12",
  };

  if (type === "Air Handler") {
    Object.assign(baseMetrics, {
      Airflow: `${(8000 + index * 230).toLocaleString()} CFM`,
      "Supply Temp": `${(13 + (index % 3)).toFixed(1)} °C`,
      "Return Temp": `${(22 + (index % 2)).toFixed(1)} °C`,
      "Fan Speed": `${(60 + (index % 25)).toString()}%`,
      "Filter ΔP": `${(0.4 + (index % 5) * 0.1).toFixed(2)} inH₂O`,
    });
  } else if (type === "Chiller") {
    Object.assign(baseMetrics, {
      "Leaving Water": `${(6.5 + (index % 2)).toFixed(1)} °C`,
      "Entering Water": `${(12 + (index % 2)).toFixed(1)} °C`,
      Load: `${(70 + (index % 25)).toString()}%`,
      "Power Draw": `${(180 + index * 8).toString()} kW`,
      COP: (5.8 - (index % 3) * 0.1).toFixed(2),
    });
  } else if (type === "Boiler") {
    Object.assign(baseMetrics, {
      "Outlet Temp": `${(82 + (index % 5)).toFixed(1)} °C`,
      "Inlet Temp": `${(65 + (index % 3)).toFixed(1)} °C`,
      Firing: `${(55 + (index % 35)).toString()}%`,
      Efficiency: `${(88 + (index % 8)).toFixed(1)}%`,
      "Flue Temp": `${(180 + index * 2).toString()} °C`,
    });
  } else if (type === "Pump") {
    Object.assign(baseMetrics, {
      Flow: `${(120 + index * 5).toString()} GPM`,
      Head: `${(45 + (index % 15)).toFixed(1)} ft`,
      "Motor Power": `${(15 + (index % 10)).toFixed(1)} kW`,
      RPM: `${(1750 + (index % 50)).toString()}`,
      "Bearing Temp": `${(52 + (index % 10)).toFixed(1)} °C`,
    });
  } else if (type === "Fan") {
    Object.assign(baseMetrics, {
      Airflow: `${(4500 + index * 120).toLocaleString()} CFM`,
      "Static Pressure": `${(1.8 + (index % 4) * 0.2).toFixed(2)} inH₂O`,
      RPM: `${(1100 + (index % 200)).toString()}`,
      "Motor Power": `${(7.5 + (index % 5)).toFixed(1)} kW`,
      Vibration: `${(0.3 + (index % 4) * 0.15).toFixed(2)} in/s`,
    });
  }

  return {
    id: `${prefix}-${num}`,
    name: `${prefix}-${num}`,
    type,
    floor,
    x,
    z,
    status,
    metrics: baseMetrics,
    details: baseDetails,
  };
}

/** 20 assets total, distributed across 4 floors (5 per floor). */
export const SEED_ASSETS: Asset[] = (() => {
  const out: Asset[] = [];
  let counter = 0;
  // 5 AHU → all on floor 1
  for (let i = 0; i < 5; i++, counter++) {
    out.push(makeAsset(counter, "Air Handler", "AHU", 1));
  }
  // 4 Chiller → floor 0 (mechanical room)
  for (let i = 0; i < 4; i++, counter++) {
    out.push(makeAsset(counter, "Chiller", "CH", 0));
  }
  // 4 Boiler → floor 0
  for (let i = 0; i < 4; i++, counter++) {
    out.push(makeAsset(counter, "Boiler", "BL", 0));
  }
  // 4 Pump → spread across floors 0-1
  for (let i = 0; i < 4; i++, counter++) {
    out.push(makeAsset(counter, "Pump", "PP", i < 2 ? 0 : 1));
  }
  // 3 Fan → floors 2-3
  for (let i = 0; i < 3; i++, counter++) {
    out.push(makeAsset(counter, "Fan", "FN", (i + 2) as 2 | 3));
  }
  return out;
})();

/** Display label for a floor (0 → "GF", 1-3 → "F1"-"F3"). */
export function floorLabel(floor: number): string {
  return floor === 0 ? "GF" : `F${floor}`;
}
