import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { loadInfisicalOrEnvSync } from './infisical.loader';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => {
          const fileSecrets = loadInfisicalOrEnvSync();
          return {
            ...fileSecrets,
            database: {
              host: process.env.POSTGRES_HOST || 'localhost',
              port: Number(process.env.POSTGRES_PORT) || 5432,
              user: process.env.POSTGRES_USER || 'dtfm_user',
              password: process.env.POSTGRES_PASSWORD || 'dtfm_pass',
              database: process.env.POSTGRES_DB || 'dtfm_db',
            },
            redis: {
              host: process.env.REDIS_HOST || 'localhost',
              port: Number(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD || undefined,
            },
            jwt: {
              accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
              refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
              accessTtl: process.env.JWT_ACCESS_TTL || '15m',
              refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
            },
          };
        },
      ],
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
