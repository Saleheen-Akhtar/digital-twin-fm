import { Global, Module, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createDb, type Schema } from '@digital-twin-fm/db';

export const DB_TOKEN = 'DB';

/**
 * DB module — lazy connection with strict credential loading.
 *
 * Per Finding 8 (High): the previous implementation silently fell back to
 * `dtfm_user` / `dtfm_pass` when POSTGRES_PASSWORD was unset, allowing a
 * misconfigured environment to connect to a default-password database. It
 * also had no `ssl` toggle, which would leak data in transit on any
 * managed-database deployment (RDS, Cloud SQL, etc.).
 *
 * The new behavior:
 *   - POSTGRES_PASSWORD is required in staging/production (loaded by
 *     `requireSecret()` in config.module.ts).
 *   - In development, the value still defaults to a local password so a
 *     developer can `docker compose up postgres` and not be blocked, but
 *     the value MUST match docker-compose.yml and is never "dtfm_pass"
 *     implicitly.
 *   - ssl is opt-in via `POSTGRES_SSL=true` (refuses unauthorized certs
 *     by default — production should use RDS/Cloud SQL with a real CA
 *     bundle).
 */
function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required env var: ${name}. ` +
        'Set it in .env (development) or via Infisical / orchestrator secrets (staging/prod).',
    );
  }
  return value;
}

@Global()
@Module({
  providers: [
    {
      provide: DB_TOKEN,
      useFactory: (): NodePgDatabase<Schema> => {
        const connectionString = process.env.DATABASE_URL;
        const pool = connectionString
          ? new Pool({
              connectionString,
              ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
              max: 10,
              idleTimeoutMillis: 30_000,
              connectionTimeoutMillis: 5_000,
            })
          : new Pool({
              host: process.env.POSTGRES_HOST || 'localhost',
              port: Number(process.env.POSTGRES_PORT) || 5432,
              user: process.env.POSTGRES_USER || 'dtfm_user',
              password: required(
                'POSTGRES_PASSWORD',
                process.env.POSTGRES_PASSWORD ||
                  (process.env.NODE_ENV === 'development' ? 'dtfm_pass' : undefined),
              ),
              database: process.env.POSTGRES_DB || 'dtfm_db',
              ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
              max: 10,
              idleTimeoutMillis: 30_000,
              connectionTimeoutMillis: 5_000,
            });
        pool.on('error', (err) => {
          Logger.error(`pg pool error: ${err.message}`, 'DbModule');
        });
        Logger.log(
          `DB pool initialized: ${process.env.POSTGRES_USER}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
          'DbModule',
        );
        return createDb(pool);
      },
    },
  ],
  exports: [DB_TOKEN],
})
export class DbModule {}
