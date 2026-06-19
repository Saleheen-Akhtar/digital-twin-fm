-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Per Finding 17 (Medium): the previous init-db.sql created no app role
-- and no grants. The bootstrap connection (per docker-compose.yml) used
-- POSTGRES_USER, which the official TimescaleDB image initializes as
-- a superuser. That means the api-gateway and seed script connect as
-- a superuser to the application database, which is a privilege
-- escalation risk if any SQL-injection bug exists in the Drizzle layer.
--
-- The new script:
--   1. Creates a least-privilege `dtfm_app` role.
--   2. Grants only the privileges the app actually needs
--      (CONNECT on the DB, USAGE on schema public, CRUD on
--      application tables, USAGE/SELECT on all sequences).
--   3. Runs the TimescaleDB extension as superuser (only superuser
--      can CREATE EXTENSION).
--
-- Note: this script runs as POSTGRES_USER on first init only. After
-- the first boot, the role persists in the postgres_data volume.

-- 1. Create the application role (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dtfm_app') THEN
    CREATE ROLE dtfm_app WITH LOGIN PASSWORD 'CHANGEME-dtfm_app';
  END IF;
END
$$;

-- 2. Grant the minimum required privileges.
GRANT CONNECT ON DATABASE current_database() TO dtfm_app;
GRANT USAGE ON SCHEMA public TO dtfm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dtfm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dtfm_app;

-- 3. Future tables / sequences created by Drizzle migrations should
--    inherit the same grants (default privileges for the bootstrap user).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dtfm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO dtfm_app;
