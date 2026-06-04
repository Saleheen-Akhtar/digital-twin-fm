import { pgTable, pgSchema, timestamp, varchar, doublePrecision } from "drizzle-orm/pg-core";

export const schema = pgSchema("public");

export const buildings = schema.table("buildings", {
  id: varchar("id", { length: 36 }).primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow()
});

export const sensorReadings = schema.table("sensor_readings", {
  id: varchar("id", { length: 36 }).primaryKey().defaultRandom(),
  assetId: varchar("asset_id", { length: 36 }).notNull(),
  timestamp: timestamp("timestamp", { mode: "string" }).notNull(),
  temperature: doublePrecision("temperature"),
  humidity: doublePrecision("humidity"),
  powerConsumption: doublePrecision("power_consumption"),
  vibration: doublePrecision("vibration")
});
