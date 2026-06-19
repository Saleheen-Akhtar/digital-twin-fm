import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || "dtfm_user",
    password: process.env.POSTGRES_PASSWORD || "dtfm_pass",
    database: process.env.POSTGRES_DB || "dtfm_db",
  },
});
