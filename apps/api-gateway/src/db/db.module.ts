import { Global, Module, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createDb, type Schema } from '@digital-twin-fm/db';

export const DB_TOKEN = 'DB';

/**
 * DB module — lazy connection.
 *
 * The pg.Pool and drizzle instance are created inside a factory so they
 * are only initialized when Nest first injects the DB token. This avoids
 * hanging on module import if Postgres is briefly unreachable.
 */
@Global()
@Module({
  providers: [
    {
      provide: DB_TOKEN,
      useFactory: (): NodePgDatabase<Schema> => {
        const pool = new Pool({
          host: process.env.POSTGRES_HOST || 'localhost',
          port: Number(process.env.POSTGRES_PORT) || 5432,
          user: process.env.POSTGRES_USER || 'dtfm_user',
          password: process.env.POSTGRES_PASSWORD || 'dtfm_pass',
          database: process.env.POSTGRES_DB || 'dtfm_db',
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
