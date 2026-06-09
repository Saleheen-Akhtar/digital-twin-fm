/**
 * Digital Twin FM — Database schema (Drizzle / PostgreSQL + TimescaleDB)
 *
 * Conventions:
 *   - All tables use `id uuid primary key default gen_random_uuid()`
 *   - All tables have `created_at` and `updated_at` timestamps
 *   - `sensor_readings` is a TimescaleDB hypertable (see migration)
 *   - All enums are stored as varchar with a check constraint at the app layer
 */
import {
  pgTable,
  timestamp,
  varchar,
  doublePrecision,
  integer,
  uuid,
  text,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  UserRole,
  AssetType,
  AssetStatus,
  SensorType,
  AlertSeverity,
  AlertStatus,
  WorkOrderType,
  WorkOrderPriority,
  WorkOrderStatus
} from "@digital-twin-fm/types";

// ─────────────────────── Users ───────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }),
  role: varchar("role", { length: 32 }).$type<UserRole>().notNull().default("viewer"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

// ─────────────────────── Buildings / Floors / Rooms ───────────────────────
export const buildings = pgTable("buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }),
  totalFloors: integer("total_floors").notNull().default(1),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

export const floors = pgTable("floors", {
  id: uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id").notNull().references(() => buildings.id, { onDelete: "cascade" }),
  level: integer("level").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
}, (t) => ({
  buildingLevelIdx: uniqueIndex("floors_building_level_idx").on(t.buildingId, t.level),
}));

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  floorId: uuid("floor_id").notNull().references(() => floors.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
});

// ─────────────────────── Assets ───────────────────────
export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id").notNull().references(() => buildings.id, { onDelete: "cascade" }),
  floorId: uuid("floor_id").references(() => floors.id, { onDelete: "set null" }),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 64 }).$type<AssetType>().notNull(),
  status: varchar("status", { length: 32 }).$type<AssetStatus>().notNull().default("ok"),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  serialNumber: varchar("serial_number", { length: 255 }),
  installedAt: timestamp("installed_at", { mode: "string" }),
  // 3D position (for digital twin marker)
  positionX: doublePrecision("position_x"),
  positionY: doublePrecision("position_y"),
  positionZ: doublePrecision("position_z"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => ({
  buildingIdx: index("assets_building_idx").on(t.buildingId),
  statusIdx: index("assets_status_idx").on(t.status),
}));

// ─────────────────────── Sensors ───────────────────────
export const sensors = pgTable("sensors", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 64 }).$type<SensorType>().notNull(),
  unit: varchar("unit", { length: 16 }).notNull(),
  status: varchar("status", { length: 32 }).$type<AssetStatus>().notNull().default("ok"),
  thresholdLow: doublePrecision("threshold_low"),
  thresholdHigh: doublePrecision("threshold_high"),
  lastValue: doublePrecision("last_value"),
  lastReadingAt: timestamp("last_reading_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => ({
  assetIdx: index("sensors_asset_idx").on(t.assetId),
  typeIdx: index("sensors_type_idx").on(t.type),
}));

// ─────────────────────── Sensor readings (TimescaleDB hypertable) ───────────────────────
export const sensorReadings = pgTable("sensor_readings", {
  id: uuid("id").defaultRandom(),
  sensorId: uuid("sensor_id").notNull(),
  assetId: uuid("asset_id").notNull(),
  timestamp: timestamp("timestamp", { mode: "string" }).notNull(),
  value: doublePrecision("value").notNull(),
  quality: varchar("quality", { length: 16 }).notNull().default("good"),
}, (t) => ({
  // Note: in a real TimescaleDB migration you'd also:
  //   SELECT create_hypertable('sensor_readings', 'timestamp');
  //   CREATE INDEX sensor_readings_sensor_time_idx ON sensor_readings (sensor_id, timestamp DESC);
  sensorTimeIdx: index("sensor_readings_sensor_time_idx").on(t.sensorId, t.timestamp),
}));

// ─────────────────────── Alerts ───────────────────────
export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sensorId: uuid("sensor_id").references(() => sensors.id, { onDelete: "set null" }),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
  severity: varchar("severity", { length: 16 }).$type<AlertSeverity>().notNull(),
  status: varchar("status", { length: 32 }).$type<AlertStatus>().notNull().default("open"),
  message: text("message").notNull(),
  acknowledgedBy: uuid("acknowledged_by").references(() => users.id, { onDelete: "set null" }),
  acknowledgedAt: timestamp("acknowledged_at", { mode: "string" }),
  resolvedAt: timestamp("resolved_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("alerts_status_idx").on(t.status),
  assetIdx: index("alerts_asset_idx").on(t.assetId),
}));

// ─────────────────────── Work orders ───────────────────────
export const workOrders = pgTable("work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  alertId: uuid("alert_id").references(() => alerts.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 32 }).$type<WorkOrderType>().notNull().default("corrective"),
  priority: varchar("priority", { length: 16 }).$type<WorkOrderPriority>().notNull().default("medium"),
  status: varchar("status", { length: 32 }).$type<WorkOrderStatus>().notNull().default("open"),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  dueAt: timestamp("due_at", { mode: "string" }),
  startedAt: timestamp("started_at", { mode: "string" }),
  completedAt: timestamp("completed_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("work_orders_status_idx").on(t.status),
  assetIdx: index("work_orders_asset_idx").on(t.assetId),
  assignedIdx: index("work_orders_assigned_idx").on(t.assignedTo),
}));

// ─────────────────────── Maintenance logs ───────────────────────
export const maintenanceLogs = pgTable("maintenance_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 64 }).notNull(), // created | assigned | started | note | completed | cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});
