/**
 * Thin fetch wrapper for the api-gateway. Server-side only.
 */

export interface ApiClientOptions {
  baseUrl: string;
}

export interface ApiClientDeps {
  /** Injectable for tests. Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function createApiClient(opts: ApiClientOptions, deps: ApiClientDeps = {}) {
  const base = opts.baseUrl.replace(/\/$/, '');

  async function call<T>(
    path: string,
    init: RequestInit = {},
    callDeps: ApiClientDeps = {},
  ): Promise<T> {
    // Defer fetch resolution so test-injected fetches are always used when
    // present (the global `fetch` is undefined under jsdom).
    const f = callDeps.fetch ?? deps.fetch ?? globalThis.fetch;
    if (!f) {
      throw new Error('No fetch implementation available');
    }
    const res = await f(`${base}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message) msg = String(body.message);
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    return (await res.json()) as T;
  }

  return {
    health: (callDeps: ApiClientDeps = {}) =>
      call<{ status: string }>('/health', { method: 'GET' }, callDeps),
    login: async (input: LoginInput, callDeps: ApiClientDeps = {}) => {
      const body = await call<{ accessToken: string }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
        callDeps,
      );
      return body.accessToken;
    },
  };
}
