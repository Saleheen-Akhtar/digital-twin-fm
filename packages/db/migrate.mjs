#!/usr/bin/env node
/**
 * Apply all generated Drizzle migrations to the database.
 * Cross-platform (no psql required, no bash required).
 *
 * Run via:  pnpm --filter @digital-twin-fm/db db:migrate
 * Or:       node packages/db/migrate.mjs
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, "drizzle");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function connectWithRetry(maxRetries = 15, delay = 2000) {
  const connectionString = process.env.DATABASE_URL;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const pool = connectionString
        ? new Pool({ connectionString, connectionTimeoutMillis: 5000 })
        : new Pool({
            host: process.env.POSTGRES_HOST || "localhost",
            port: Number(process.env.POSTGRES_PORT) || 5432,
            user: process.env.POSTGRES_USER || "dtfm_user",
            password: process.env.POSTGRES_PASSWORD || "dtfm_pass",
            database: process.env.POSTGRES_DB || "dtfm_db",
            connectionTimeoutMillis: 5000,
          });
      // Test the connection
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log(`✅ DB connected after ${attempt} attempt(s)`);
      return pool;
    } catch (err) {
      console.log(
        `⏳ DB not ready (attempt ${attempt}/${maxRetries}): ${err.message}`,
      );
      if (attempt < maxRetries) await sleep(delay);
    }
  }
  throw new Error(`Failed to connect to Postgres after ${maxRetries} attempts`);
}

const pool = await connectWithRetry();

const db = drizzle(pool);

console.log("🔄 Applying Drizzle migrations from", MIGRATIONS_DIR);

if (!existsSync(MIGRATIONS_DIR)) {
  console.error("❌ No drizzle/ directory found. Run `pnpm db:generate` first.");
  process.exit(1);
}

try {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  console.log("✅ Migrations applied");
} catch (err) {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
