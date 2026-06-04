import { pgTable, pgSchema, timestamp, varchar, doublePrecision, uuid } from "drizzle-orm/pg-core";

export const schema = pgSchema("public");

export const buildings = schema.table("buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow()
});

export const sensorReadings = schema.table("sensor_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").notNull(),
  timestamp: timestamp("timestamp", { mode: "string" }).notNull(),
  temperature: doublePrecision("temperature"),
  humidity: doublePrecision("humidity"),
  powerConsumption: doublePrecision("power_consumption"),
  vibration: doublePrecision("vibration")
});
