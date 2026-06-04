import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { loadInfisicalOrEnvSync } from './infisical.loader';

/**
 * Throws if a required secret is missing in non-development environments.
 * Development/test get dev defaults for ergonomic local setup; staging/prod
 * MUST have all secrets set via Infisical or a real .env.
 */
function requireSecret(value: string | undefined, key: string, env: string): string {
  if (value && value.length > 0) return value;
  if (env === 'development' || env === 'test') {
    return `dev-${key.toLowerCase()}`;
  }
  throw new Error(
    `Required secret ${key} is missing in ${env} environment. ` +
      `Set it via Infisical, a real .env file, or your orchestrator's secret store.`,
  );
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => {
          const env = process.env.NODE_ENV || 'development';
          const fileSecrets = loadInfisicalOrEnvSync();

          return {
            env,
            ...fileSecrets,
            database: {
              host: process.env.POSTGRES_HOST || 'localhost',
              port: Number(process.env.POSTGRES_PORT) || 5432,
              user: process.env.POSTGRES_USER || 'dtfm_user',
              password: requireSecret(process.env.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD', env),
              database: process.env.POSTGRES_DB || 'dtfm_db',
            },
            redis: {
              host: process.env.REDIS_HOST || 'localhost',
              port: Number(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD || undefined,
            },
            jwt: {
              accessSecret: requireSecret(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', env),
              refreshSecret: requireSecret(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', env),
              accessTtl: process.env.JWT_ACCESS_TTL || '15m',
              refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
            },
            mvp: {
              adminEmail: process.env.MVP_ADMIN_EMAIL || 'admin@dtfm.local',
              adminPassword: process.env.MVP_ADMIN_PASSWORD,
            },
            cors: {
              origin: process.env.CORS_ORIGIN,
            },
          };
        },
      ],
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
