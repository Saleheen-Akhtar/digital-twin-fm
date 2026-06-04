import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || "dtfm_user",
  password: process.env.POSTGRES_PASSWORD || "dtfm_pass",
  database: process.env.POSTGRES_DB || "dtfm_db"
});

export const db = drizzle(pool, { schema });
export * from "./schema";
