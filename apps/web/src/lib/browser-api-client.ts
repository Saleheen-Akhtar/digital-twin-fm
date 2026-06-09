/**
 * Browser-side API client.
 *
 * Thin fetch wrapper for the Next.js Route Handler at `/api/proxy/...`,
 * which forwards the request to the api-gateway with the Bearer token
 * read from the httpOnly `dtfm_token` cookie server-side. The browser
 * NEVER sees the token; it just talks same-origin to `/api/proxy/...`
 * and lets the cookie ride along automatically.
 *
 * This is the client-side counterpart to `@/lib/api-client` (which is
 * used by Server Components / Server Actions and accepts a token
 * directly). The two share the same `ApiError` shape and the same
 * method names so callers can be moved between server and client
 * contexts with minimal changes.
 *
 * Why a proxy instead of direct browser → api-gateway:
 *   - The api-gateway's JwtAuthGuard only reads the JWT from the
 *     `Authorization: Bearer` header. The browser can't read the
 *     httpOnly cookie to set that header.
 *   - Direct browser → api-gateway would also need CORS with
 *     `credentials: true`, which is a wider attack surface.
 *   - The proxy keeps the api-gateway's auth boundary unchanged.
 */
import { ApiError, type ApiErrorCode } from './api-client';

const PROXY_PREFIX = '/api/proxy';

function codeForStatus(status: number): { code: ApiErrorCode; message: string } {
  if (status === 0 || status === 502 || status === 503 || status === 504) {
    return { code: 'network_unavailable', message: 'The service is temporarily unreachable.' };
  }
  if (status === 401) return { code: 'unauthorized', message: 'Your session has expired. Please sign in again.' };
  if (status === 403) return { code: 'forbidden', message: 'You do not have permission to perform this action.' };
  if (status === 404) return { code: 'not_found', message: 'The requested resource was not found.' };
  if (status === 429) return { code: 'rate_limited', message: 'Too many requests. Please try again shortly.' };
  if (status >= 400 && status < 500) return { code: 'validation_error', message: 'The request was invalid.' };
  return { code: 'upstream_error', message: 'The service returned an error. Please try again.' };
}

export interface BrowserApiClientOptions {
  /** Optional `credentials` policy. Defaults to `'same-origin'`, which
   *  is the right value for our same-origin `/api/proxy` calls. The
   *  cookie rides along automatically. */
  credentials?: RequestCredentials;
  /** Optional AbortSignal forwarded to fetch. */
  signal?: AbortSignal;
}

export function createBrowserApiClient(opts: BrowserApiClientOptions = {}) {
  const credentials = opts.credentials ?? 'same-origin';
  const cache = new Map<string, { ts: number; data: unknown }>();
  const CACHE_TTL = 30_000; // 30 seconds

  async function call<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const cacheKey = `${method}:${path}`;
    
    // Only cache GET requests
    if (method === 'GET') {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data as T;
      }
    }

    const url = `${PROXY_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
    const init: RequestInit = {
      method,
      credentials,
      headers: { 'content-type': 'application/json' },
    };
    if (opts.signal) init.signal = opts.signal;
    if (body !== undefined) init.body = JSON.stringify(body);

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      throw new ApiError('network_unavailable', 0, 'The service is temporarily unreachable.', e);
    }

    if (!res.ok) {
      let upstreamBody: unknown = undefined;
      try {
        upstreamBody = await res.text();
      } catch {
        /* ignore */
      }
      const { code, message } = codeForStatus(res.status);
      // eslint-disable-next-line no-console
      console.error(`[browser-api] ${res.status} ${code} on ${method} ${path}:`, upstreamBody);
      throw new ApiError(code, res.status, message, upstreamBody);
    }

    // Some proxied endpoints may return 204; guard the JSON parse.
    const text = await res.text();
    if (!text) return undefined as T;
    const parsed = JSON.parse(text) as T;
    if (method === 'GET') {
      cache.set(cacheKey, { ts: Date.now(), data: parsed });
    }
    return parsed;
  }

  return {
    get: <T>(path: string) => call<T>('GET', path),
    post: <T>(path: string, body?: unknown) => call<T>('POST', path, body),
    put: <T>(path: string, body?: unknown) => call<T>('PUT', path, body),
    patch: <T>(path: string, body?: unknown) => call<T>('PATCH', path, body),
    delete: <T>(path: string) => call<T>('DELETE', path),
  };
}

export type BrowserApiClient = ReturnType<typeof createBrowserApiClient>;
