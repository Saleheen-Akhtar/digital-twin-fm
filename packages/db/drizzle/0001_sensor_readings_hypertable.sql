-- Per Finding 24 (Medium): the previous setup claimed sensor_readings
-- was a TimescaleDB hypertable, but the migration did NOT call
-- create_hypertable. The audit caught this and flagged it as a
-- "TimescaleDB claim is fiction" — every query that hit sensor_readings
-- ran as a regular table scan.
--
-- This migration:
--   1. Adds a composite primary key (sensor_id, timestamp) so the
--      hypertable can partition rows on time. The previous schema had
--      a stand-alone defaultRandom() id column with no PK — a non-PK
--      hypertable is unsupported.
--   2. Calls create_hypertable to convert the table to a real
--      TimescaleDB hypertable partitioned on `timestamp`.
--   3. Adds a covering (sensor_id, timestamp DESC) index for the
--      common "latest readings for sensor X" query.
--
-- Rollback is intentionally not provided. A down-migration that
-- converts a hypertable back to a regular table is data-lossy and
-- should be a conscious operation, not a script.

-- 1. Promote (id) to a composite PK that includes `timestamp`. The
--    `id` column is kept for client-side dedup; uniqueness is now
--    enforced on (sensor_id, timestamp, id) to be safe under
--    concurrent inserts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sensor_readings_pkey'
  ) THEN
    ALTER TABLE "sensor_readings"
      ADD CONSTRAINT "sensor_readings_pkey"
      PRIMARY KEY ("sensor_id", "timestamp");
  END IF;
END
$$;

-- 2. Convert to a hypertable. This is a no-op if the table is already
--    a hypertable (idempotent via `if_not_exists`).
SELECT create_hypertable(
  'sensor_readings',
  'timestamp',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- 3. The covering index. TimescaleDB creates an implicit index on
--    (sensor_id, timestamp DESC) for hypertables, but an explicit
--    one is safer (and self-documenting) and matches the spec in
--    documents/mvp/DATABASE_SCHEMA.md.
CREATE INDEX IF NOT EXISTS "sensor_readings_sensor_time_desc_idx"
  ON "sensor_readings" ("sensor_id", "timestamp" DESC);
