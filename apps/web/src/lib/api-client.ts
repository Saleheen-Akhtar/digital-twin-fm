/**
 * Thin fetch wrapper for the api-gateway. Server-side only.
 */

/**
 * Public-facing error codes the api-client may surface. Kept as a
 * closed set so callers can branch on them without parsing free-form
 * strings.
 *
 * Per Finding 9 (High): the previous implementation passed the raw
 * upstream error message to the browser (`e.message = body.message`).
 * That could leak backend internals (DB error text, JWT secret path,
 * internal stack fragments, etc.) to the user. The new implementation
 * returns a stable, user-safe code + a sanitized generic message; the
 * raw upstream body is logged server-side but never sent to the client.
 */
export type ApiErrorCode =
  | 'network_unavailable'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'validation_error'
  | 'upstream_error'
  | 'unknown';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly cause?: unknown;
  constructor(code: ApiErrorCode, status: number, message: string, cause?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /**
   * Optional bearer token. When set, every request includes
   * `Authorization: Bearer <token>`. Required for non-public endpoints
   * (Finding 4: every business endpoint is now JWT-protected).
   */
  token?: string;
}

export interface ApiClientDeps {
  /** Injectable for tests. Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ────────────────────────── Domain types ──────────────────────────
import type {
  Building,
  AssetStatus,
  AssetType,
  Asset,
  SensorType,
  Sensor,
  SensorReading,
  AlertSeverity,
  AlertStatus,
  Alert,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrder
} from '@digital-twin-fm/types';

export type {
  Building,
  AssetStatus,
  AssetType,
  Asset,
  SensorType,
  Sensor,
  SensorReading,
  AlertSeverity,
  AlertStatus,
  Alert,
  WorkOrder
};

// ────────────────────────── Client ──────────────────────────
export function createApiClient(opts: ApiClientOptions, deps: ApiClientDeps = {}) {
  const base = opts.baseUrl.replace(/\/$/, '');

  /**
   * Map an HTTP status to a stable, user-facing ApiErrorCode.
   *
   * The upstream `body.message` is NEVER copied into the thrown
   * `Error.message`. The browser only ever sees the sanitized text
   * associated with the code below. The full upstream body is logged
   * server-side (`console.error`) for operators.
   */
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

  /**
   * If `opts.token` is set, every request gets an `Authorization: Bearer …`
   * header. This is required for all non-public endpoints (Finding 4).
   * Public callers (login, health) can pass an empty string.
   *
   * Per Finding 9 (High): the returned promise rejects with `ApiError`,
   * whose `message` is a sanitized string and `code` is a stable enum.
   * The raw upstream response body is logged via `console.error` for
   * operators but never surfaces to the user.
   */
  async function call<T>(
    path: string,
    init: RequestInit = {},
    callDeps: ApiClientDeps = {},
  ): Promise<T> {
    const f = callDeps.fetch ?? deps.fetch ?? globalThis.fetch;
    if (!f) throw new ApiError('unknown', 0, 'No fetch implementation available');
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined ?? {}),
    };
    if (opts.token) {
      headers['authorization'] = `Bearer ${opts.token}`;
    }

    let res: Response;
    try {
      res = await f(`${base}${path}`, { ...init, headers });
    } catch (e) {
      // Network-level failure (DNS, refused, offline). Log the cause
      // server-side; throw a sanitized ApiError.
      // eslint-disable-next-line no-console
      console.error(`[api-client] network error on ${path}:`, e);
      throw new ApiError('network_unavailable', 0, 'The service is temporarily unreachable.', e);
    }

    if (!res.ok) {
      const { code, message } = codeForStatus(res.status);
      // Read the body for logging only — do NOT include it in the
      // thrown error message.
      let upstreamBody: unknown = undefined;
      try {
        upstreamBody = await res.text();
      } catch {
        // ignore
      }
      if (res.status !== 429) {
        // eslint-disable-next-line no-console
        console.error(`[api-client] ${res.status} ${code} on ${path}:`, upstreamBody);
      }
      throw new ApiError(code, res.status, message, upstreamBody);
    }

    return (await res.json()) as T;
  }

  // Helper to build a query string from an object, dropping undefined/null
  function qs(params: Record<string, string | number | undefined | null>): string {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (!entries.length) return '';
    return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  }

  return {
    // ───── Health & auth ─────
    health: (callDeps: ApiClientDeps = {}) =>
      call<{ status: string }>('/health', { method: 'GET' }, callDeps),

    login: async (input: LoginInput, callDeps: ApiClientDeps = {}) => {
      const body = await call<{ accessToken: string }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(input) },
        callDeps,
      );
      return body.accessToken;
    },

    // ───── Buildings ─────
    findBuildings: (callDeps: ApiClientDeps = {}) =>
      call<Building[]>('/buildings', { method: 'GET' }, callDeps),
    findBuilding: (id: string, callDeps: ApiClientDeps = {}) =>
      call<Building>(`/buildings/${id}`, { method: 'GET' }, callDeps),

    // ───── Assets ─────
    findAssets: (
      filter: { buildingId?: string; status?: AssetStatus; type?: AssetType } = {},
      callDeps: ApiClientDeps = {},
    ) => call<Asset[]>(`/assets${qs(filter as Record<string, string | undefined>)}`, { method: 'GET' }, callDeps),
    findAsset: (id: string, callDeps: ApiClientDeps = {}) =>
      call<Asset>(`/assets/${id}`, { method: 'GET' }, callDeps),

    // ───── Sensors ─────
    findSensors: (callDeps: ApiClientDeps = {}) =>
      call<Sensor[]>('/sensors', { method: 'GET' }, callDeps),
    findSensor: (id: string, callDeps: ApiClientDeps = {}) =>
      call<Sensor>(`/sensors/${id}`, { method: 'GET' }, callDeps),
    findReadings: (
      sensorId: string,
      filter: { from?: string; to?: string; limit?: number } = {},
      callDeps: ApiClientDeps = {},
    ) => call<SensorReading[]>(`/sensors/${sensorId}/readings${qs(filter as Record<string, string | number | undefined>)}`, { method: 'GET' }, callDeps),

    // ───── Alerts ─────
    findAlerts: (
      filter: { status?: AlertStatus; severity?: AlertSeverity; assetId?: string; limit?: number } = {},
      callDeps: ApiClientDeps = {},
    ) => call<Alert[]>(`/alerts${qs(filter as Record<string, string | number | undefined>)}`, { method: 'GET' }, callDeps),
    findAlert: (id: string, callDeps: ApiClientDeps = {}) =>
      call<Alert>(`/alerts/${id}`, { method: 'GET' }, callDeps),
    acknowledgeAlert: (id: string, callDeps: ApiClientDeps = {}) =>
      call<Alert>(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'acknowledged' as AlertStatus }) }, callDeps),
    resolveAlert: (id: string, callDeps: ApiClientDeps = {}) =>
      call<Alert>(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' as AlertStatus }) }, callDeps),

    // ───── Work Orders ─────
    findWorkOrders: (
      filter: { status?: string; priority?: string; limit?: number } = {},
      callDeps: ApiClientDeps = {},
    ) => call<WorkOrder[]>(`/work-orders${qs(filter as Record<string, string | number | undefined>)}`, { method: 'GET' }, callDeps),
    createWorkOrder: (
      input: { assetId: string; alertId?: string; title: string; description?: string; priority?: WorkOrderPriority },
      callDeps: ApiClientDeps = {},
    ) => call<WorkOrder>('/work-orders', { method: 'POST', body: JSON.stringify(input) }, callDeps),
    updateWorkOrder: (
      id: string,
      input: { status?: WorkOrderStatus },
      callDeps: ApiClientDeps = {},
    ) => call<WorkOrder>(`/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify(input) }, callDeps),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
