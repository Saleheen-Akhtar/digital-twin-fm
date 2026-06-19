/**
 * Digital Twin FM — DB package
 *
 * Exports:
 *   - Re-exports of the Drizzle schema (tables, types)
 *   - `createDb(pool)` factory: build a typed Drizzle client from a pg.Pool
 *
 * We deliberately do NOT create a Pool or Drizzle instance at module load.
 * Consumers (api-gateway) create their own Pool with their own config and
 * call createDb(pool) to get the typed client. This avoids hanging on
 * module import when the database is briefly unreachable.
 */
export * from './schema';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as buildingsTable from './schema';
export type Schema = typeof buildingsTable;

/**
 * Build a Drizzle client from a pg.Pool. Call this lazily (e.g. inside a
 * Nest factory provider) so the Pool isn't created at module-load time.
 */
export function createDb(pool: Pool): NodePgDatabase<Schema> {
  return drizzle(pool, { schema: buildingsTable });
}
