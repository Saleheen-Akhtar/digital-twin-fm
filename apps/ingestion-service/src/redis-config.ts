/**
 * Shared Redis/Valkey connection options for ingestion-service.
 *
 * Primary config: discrete REDIS_HOST / REDIS_PORT / REDIS_PASSWORD env vars.
 * Fallback: REDIS_URL (parsed for host/port/password).
 * We prefer discrete vars because ioredis URL parsing can cause WRONGPASS with
 * Valkey, but REDIS_URL fallback prevents breakage for anyone who set it per
 * the old .env.example.
 */
import type { RedisOptions } from "ioredis";
import { URL } from "url";

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
    lazyConnect: false,
    ...overrides,
  };
}

export function describeRedisTarget(): string {
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = Number(process.env.REDIS_PORT) || 6379;
  return `${host}:${port}`;
}
