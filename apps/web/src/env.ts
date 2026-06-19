/**
 * Web app environment configuration.
 *
 * - `getServerEnv()`: only available in Server Components, Route Handlers,
 *   and Server Actions. Reads `API_GATEWAY_URL` (server-to-server).
 * - `getClientEnv()`: available everywhere. Reads `NEXT_PUBLIC_*` vars
 *   that Next.js inlines into the client bundle at build time.
 */

function requireEnv(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV !== 'production') return devFallback;
  throw new Error(`Required env var ${name} is missing in production.`);
}

export function getServerEnv() {
  return {
    apiGatewayUrl: requireEnv('API_GATEWAY_URL', 'http://localhost:4000'),
  };
}

export function getClientEnv() {
  return {
    apiBaseUrl: requireEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000'),
  };
}
