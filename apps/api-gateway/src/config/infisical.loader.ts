import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Loads secrets from .env file locally, or from Infisical in higher environments.
 * In production / staging, the Infisical CLI is expected to have already
 * injected secrets into the process environment (e.g. via a sidecar / init container).
 * This loader provides a local-dev fallback.
 */
export function loadInfisicalOrEnvSync(): Record<string, string> {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'development' || env === 'test') {
    const envPath = resolve(process.cwd(), '.env');
    if (!existsSync(envPath)) {
      return {};
    }
    const content = readFileSync(envPath, 'utf-8');
    const parsed: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      parsed[key] = value;
    }
    return parsed;
  }

  return {};
}
