/**
 * Thin fetch wrapper for the api-gateway. Server-side only.
 */

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
export interface Building {
  id: string;
  name: string;
  address?: string | null;
  totalFloors: number;
  createdAt: string;
  updatedAt: string;
}

export type AssetStatus = 'ok' | 'warning' | 'critical' | 'offline' | 'info';
export type AssetType =
  | 'ahu' | 'chiller' | 'boiler' | 'pump' | 'fan' | 'elevator' | 'lighting' | 'sensor_only' | 'other';

export interface Asset {
  id: string;
  buildingId: string;
  floorId?: string | null;
  roomId?: string | null;
  name: string;
  type: AssetType;
  status: AssetStatus;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  installedAt?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  positionZ?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type SensorType =
  | 'temperature' | 'humidity' | 'power' | 'vibration' | 'co2' | 'occupancy' | 'pressure' | 'flow';

export interface Sensor {
  id: string;
  assetId: string;
  type: SensorType;
  unit: string;
  status: AssetStatus;
  thresholdLow?: number | null;
  thresholdHigh?: number | null;
  lastValue?: number | null;
  lastReadingAt?: string | null;
  createdAt: string;
}

export interface SensorReading {
  id?: string;
  sensorId: string;
  assetId: string;
  timestamp: string;
  value: number;
  quality?: string;
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'cancelled';

export interface Alert {
  id: string;
  sensorId?: string | null;
  assetId?: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

// ────────────────────────── Client ──────────────────────────
export function createApiClient(opts: ApiClientOptions, deps: ApiClientDeps = {}) {
  const base = opts.baseUrl.replace(/\/$/, '');

  /**
   * If `opts.token` is set, every request gets an `Authorization: Bearer …`
   * header. This is required for all non-public endpoints (Finding 4).
   * Public callers (login, health) can pass an empty string.
   */
  async function call<T>(
    path: string,
    init: RequestInit = {},
    callDeps: ApiClientDeps = {},
  ): Promise<T> {
    const f = callDeps.fetch ?? deps.fetch ?? globalThis.fetch;
    if (!f) throw new Error('No fetch implementation available');
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined ?? {}),
    };
    if (opts.token) {
      headers['authorization'] = `Bearer ${opts.token}`;
    }
    const res = await f(`${base}${path}`, { ...init, headers });
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
      filter: { buildingId?: string; status?: string; type?: string } = {},
      callDeps: ApiClientDeps = {},
    ) => call<Asset[]>(`/assets${qs(filter as any)}`, { method: 'GET' }, callDeps),
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
    ) => call<SensorReading[]>(`/sensors/${sensorId}/readings${qs(filter as any)}`, { method: 'GET' }, callDeps),

    // ───── Alerts ─────
    findAlerts: (
      filter: { status?: string; severity?: string; assetId?: string; limit?: number } = {},
      callDeps: ApiClientDeps = {},
    ) => call<Alert[]>(`/alerts${qs(filter as any)}`, { method: 'GET' }, callDeps),
    findAlert: (id: string, callDeps: ApiClientDeps = {}) =>
      call<Alert>(`/alerts/${id}`, { method: 'GET' }, callDeps),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
