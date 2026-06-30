/**
 * Digital Twin FM — Shared types
 * MIT-licensed. Used by web, api-gateway, and ingestion-service.
 */

// ──────────────────────────────────────────────
// Enums / unions
// ──────────────────────────────────────────────

export type AssetStatus = "ok" | "warning" | "critical" | "offline" | "info";
export type AssetType = "ahu" | "chiller" | "boiler" | "pump" | "fan" | "elevator" | "lighting" | "sensor_only" | "other";

export type SensorType = "temperature" | "humidity" | "power" | "vibration" | "co2" | "occupancy" | "pressure" | "flow";
export type ReadingQuality = "good" | "uncertain" | "bad";

export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "open" | "acknowledged" | "in_progress" | "resolved" | "cancelled" | "closed";

export type WorkOrderStatus = "open" | "assigned" | "in_progress" | "blocked" | "completed" | "cancelled";
export type WorkOrderPriority = "low" | "medium" | "high" | "critical";
export type WorkOrderType = "preventive" | "corrective" | "predictive" | "inspection";

export type UserRole = "admin" | "facility_manager" | "technician" | "viewer";

// ──────────────────────────────────────────────
// Domain entities
// ──────────────────────────────────────────────

export interface Building {
  id: string;
  name: string;
  address?: string | null;
  totalFloors: number;
  modelUrl?: string | null;
  modelFormat?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  buildingId: string;
  floorId?: string | null;
  roomId?: string | null;
  name: string;
  type: AssetType;
  status: AssetStatus;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  installedAt?: string | null;
  positionX?: number | null; // for 3D marker
  positionY?: number | null;
  positionZ?: number | null;
  floorLevel?: number | null; // floor level (1-based, from floors table)
  createdAt: string;
  updatedAt: string;
}

export interface Sensor {
  id: string;
  assetId: string;
  type: SensorType;
  unit: string;
  status: AssetStatus;
  thresholdLow?: number | null;
  thresholdHigh?: number | null;
  lastValue?: number | null;
  lastReadingAt?: string | null;
  createdAt: string;
}

export interface SensorReading {
  id?: string;
  sensorId: string;
  assetId: string;
  timestamp: string;
  value: number;
  unit?: string;
  quality?: ReadingQuality;
}

export interface Alert {
  id: string;
  sensorId?: string | null;
  assetId?: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  assetId: string;
  alertId?: string;
  title: string;
  description?: string;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignedTo?: string;
  createdAt: string;
  dueAt?: string;
  completedAt?: string;
}

// ──────────────────────────────────────────────
// Realtime events (WebSocket / Redis pub-sub)
// ──────────────────────────────────────────────

export type RealtimeEvent =
  | { type: "sensor.reading"; payload: SensorReading }
  | { type: "alert.created"; payload: Alert }
  | { type: "alert.updated"; payload: Alert }
  | { type: "work_order.updated"; payload: WorkOrder }
  | { type: "asset.status_changed"; payload: { assetId: string; status: AssetStatus } };
