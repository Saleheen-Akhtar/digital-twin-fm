/**
 * Redis/Valkey connection options for api-gateway.
 *
 * Mirrors the same pattern as ingestion-service's redis-config.ts:
 * discrete REDIS_HOST / REDIS_PORT / REDIS_PASSWORD env vars with
 * REDIS_URL fallback.
 */
import type { RedisOptions } from "ioredis";

function parseRedisUrl(url: string): Partial<RedisOptions> {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || undefined,
      port: parsed.port ? Number(parsed.port) : undefined,
      password: parsed.password || undefined,
    };
  } catch {
    return {};
  }
}

export function createRedisOptions(overrides: Partial<RedisOptions> = {}): RedisOptions {
  const fromUrl = process.env.REDIS_URL ? parseRedisUrl(process.env.REDIS_URL) : {};

  return {
    host: process.env.REDIS_HOST || fromUrl.host || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || fromUrl.port || 6379,
    password: process.env.REDIS_PASSWORD || fromUrl.password || undefined,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    ...overrides,
  };
}
