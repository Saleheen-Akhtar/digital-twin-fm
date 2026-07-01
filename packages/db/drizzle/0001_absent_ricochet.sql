CREATE TABLE IF NOT EXISTS "building_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid,
	"health_score" integer NOT NULL,
	"total_assets" integer DEFAULT 0 NOT NULL,
	"online_assets" integer DEFAULT 0 NOT NULL,
	"warning_assets" integer DEFAULT 0 NOT NULL,
	"critical_assets" integer DEFAULT 0 NOT NULL,
	"offline_assets" integer DEFAULT 0 NOT NULL,
	"active_alerts" integer DEFAULT 0 NOT NULL,
	"critical_alerts" integer DEFAULT 0 NOT NULL,
	"sensor_uptime" double precision,
	"total_sensors" integer DEFAULT 0 NOT NULL,
	"online_sensors" integer DEFAULT 0 NOT NULL,
	"avg_energy_kw" double precision,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "model_url" text;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "model_format" varchar(16);--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "color" varchar(32);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "building_snapshots_building_time_idx" ON "building_snapshots" ("building_id","computed_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "building_snapshots" ADD CONSTRAINT "building_snapshots_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
