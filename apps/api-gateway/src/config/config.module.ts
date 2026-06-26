import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { loadInfisicalOrEnvSync } from './infisical.loader';

const log = new Logger('Config');

/**
 * Per Finding 5 (Critical): the previous implementation always returned a
 * deterministic `dev-<key>` string in development, which means a missing
 * JWT_ACCESS_SECRET produced a known-constant value that anyone with access
 * to the codebase could use to mint admin tokens against a developer's
 * local gateway. The fixed behavior:
 *
 *   - test          → fixed string (unit tests only)
 *   - development   → random secret generated at boot, OR deterministic
 *                     dev value only if ALLOW_INSECURE_DEV=1 is explicitly set
 *   - staging/prod  → throws (caller must inject the secret via Infisical,
 *                     a real .env, or the orchestrator's secret store)
 */
function randomSecret(): string {
  return randomBytes(48).toString('base64url');
}

function requireSecret(value: string | undefined, key: string, env: string): string {
  if (value && value.length > 0) return value;
  if (env === 'test') {
    return 'test-secret-only-used-in-unit-tests';
  }
  if (env === 'development') {
    if (process.env.ALLOW_INSECURE_DEV === '1') {
      log.warn(
        `ALLOW_INSECURE_DEV=1: ${key} falling back to a deterministic dev value. ` +
          'NEVER use this in any deployed environment.',
      );
      return `dev-${key.toLowerCase()}`;
    }
    const generated = randomSecret();
    log.warn(
      `${key} not set. Generated a random one for this process: ${generated}. ` +
        'Set it in .env or your orchestrator to persist across restarts.',
    );
    return generated;
  }
  throw new Error(
    `Required secret ${key} is missing in ${env} environment. ` +
      `Set it via Infisical, a real .env file, or your orchestrator's secret store.`,
  );
}

// Side-effect: load .env into process.env (or no-op in production).
loadInfisicalOrEnvSync();

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => {
          const env = process.env.NODE_ENV || 'development';

          return {
            env,
            database: {
              host: process.env.POSTGRES_HOST || 'localhost',
              port: Number(process.env.POSTGRES_PORT) || 5432,
              user: process.env.POSTGRES_USER || 'dtfm_user',
              password: requireSecret(process.env.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD', env),
              database: process.env.POSTGRES_DB || 'dtfm_db',
            },
            redis: {
              host: process.env.REDIS_HOST || '127.0.0.1',
              port: Number(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD || undefined,
            },
            jwt: {
              accessSecret: requireSecret(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', env),
              refreshSecret: requireSecret(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', env),
              accessTtl: process.env.JWT_ACCESS_TTL || '24h',
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
