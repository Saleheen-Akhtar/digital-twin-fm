"use client";

import { useEffect, useRef, useState } from "react";
import {
  type Asset,
  type Sensor,
  type SensorReading,
  type Alert,
} from "@/lib/api-client";
import { createBrowserApiClient } from "@/lib/browser-api-client";

const TYPE_LABEL: Record<string, string> = {
  ahu: "Air Handler",
  chiller: "Chiller",
  boiler: "Boiler",
  pump: "Pump",
  fan: "Fan",
  elevator: "Elevator",
  lighting: "Lighting",
  sensor_only: "Sensor",
  other: "Equipment",
};

const STATUS_COLOR: Record<string, string> = {
  ok: "bg-green-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  offline: "bg-neutral-500",
  info: "bg-blue-500",
};

/**
 * 30-second local staleTime, in the spirit of TanStack Query's
 * `staleTime` option. The previous version of this panel re-issued
 * the full /sensors + /alerts + /sensors/:id/readings waterfall
 * every time the user opened the panel — even if they had just
 * closed it 5 seconds ago and re-clicked the same marker. With 4
 * sensors, that is 1 + 1 + 4 = 6 API calls per open. At 300
 * requests/min for sustained polling, this is well under the
 * throttler ceiling, but it is still wasteful and produces visible
 * "Loading…" flash.
 *
 * The cache stores the in-memory snapshot of `{ sensors, readings,
 * alerts }` keyed by `assetId` with a 30-second TTL. Re-opening the
 * same asset within that window renders the cached data
 * synchronously and skips the network entirely.
 */
const STALE_MS = 30_000;

interface AssetDetailCacheEntry {
  sensors: Sensor[];
  readingsBySensor: Record<string, SensorReading[]>;
  alerts: Alert[];
  fetchedAt: number;
}

function friendlyName(a: Asset): string {
  const match = a.name.match(/^[A-Z_]+-?(\d+)$/);
  if (match) {
    const typeLabel = TYPE_LABEL[a.type] ?? "Equipment";
    return `${typeLabel} ${match[1]}`;
  }
  return a.name;
}

export interface AssetDetailPanelProps {
  asset: Asset | null;
  onClose: () => void;
}

export function AssetDetailPanel({ asset, onClose }: AssetDetailPanelProps) {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [readingsBySensor, setReadingsBySensor] = useState<Record<string, SensorReading[]>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  // Module-scoped cache: persists across mount/unmount within the same
  // browser session. useRef is used (not useState) so a cache write
  // does not trigger a re-render.
  const cacheRef = useRef<Map<string, AssetDetailCacheEntry>>(new Map());

  // Fetch sensors + recent alerts when an asset is selected. Gated on
  // a fresh `asset` reference — if the user re-selects the same asset
  // within STALE_MS, the cached snapshot is hydrated synchronously and
  // the network is skipped. There is only ONE useEffect here (per
  // Finding 14 the dashboard previously had a stale `dashboardSnapshot`
  // module-level variable; this is the smaller, panel-scoped version
  // of the same idea, with an explicit TTL).
  useEffect(() => {
    if (!asset) {
      setSensors([]);
      setReadingsBySensor({});
      setAlerts([]);
      return;
    }

    const cached = cacheRef.current.get(asset.id);
    if (cached && Date.now() - cached.fetchedAt < STALE_MS) {
      // Hydrate from cache — no spinner, no network.
      setSensors(cached.sensors);
      setReadingsBySensor(cached.readingsBySensor);
      setAlerts(cached.alerts);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // The browser cannot read the httpOnly `dtfm_token` cookie, so we
        // cannot attach `Authorization: Bearer` from here. Instead we hit
        // the same-origin proxy at `/api/proxy/...`, which reads the
        // cookie server-side and forwards the request to the api-gateway
        // with the Bearer token. The browser never sees the JWT.
        const api = createBrowserApiClient();
        const [allSensors, allAlerts] = await Promise.all([
          api.get<Sensor[]>("/sensors"),
          api.get<Alert[]>(`/alerts?assetId=${encodeURIComponent(asset.id)}&limit=5`),
        ]);
        const assetSensors = allSensors.filter((s) => s.assetId === asset.id);
        if (cancelled) return;

        // Fetch latest readings for each sensor (max 4)
        const readings: Record<string, SensorReading[]> = {};
        await Promise.all(
          assetSensors.slice(0, 4).map(async (s) => {
            const r = await api.get<SensorReading[]>(
              `/sensors/${encodeURIComponent(s.id)}/readings?limit=10`,
            );
            readings[s.id] = r;
          }),
        );
        if (cancelled) return;

        setSensors(assetSensors);
        setAlerts(allAlerts);
        setReadingsBySensor(readings);

        cacheRef.current.set(asset.id, {
          sensors: assetSensors,
          readingsBySensor: readings,
          alerts: allAlerts,
          fetchedAt: Date.now(),
        });
      } catch (err) {
        console.error('Failed to load asset details:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset]);

  if (!asset) return null;

  return (
    <aside
      data-testid="asset-detail-panel"
      className="fixed top-0 right-0 h-full w-96 bg-neutral-900 border-l border-neutral-800 shadow-2xl z-50 overflow-y-auto"
    >
      {/* Header */}
      <header className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-4 flex items-start justify-between z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[asset.status]}`} />
            <span className="text-xs uppercase tracking-wider text-neutral-400">
              {asset.status}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white" data-testid="asset-detail-name">
            {friendlyName(asset)}
          </h2>
          <p className="text-xs text-neutral-500">
            {TYPE_LABEL[asset.type] ?? asset.type} · {asset.name}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white p-1"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Details */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-neutral-400 mb-2">Details</h3>
          <dl className="space-y-1 text-sm">
            {asset.manufacturer && (
              <div className="flex justify-between">
                <dt className="text-neutral-400">Manufacturer</dt>
                <dd className="text-neutral-200">{asset.manufacturer}</dd>
              </div>
            )}
            {asset.model && (
              <div className="flex justify-between">
                <dt className="text-neutral-400">Model</dt>
                <dd className="text-neutral-200 font-mono text-xs">{asset.model}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-neutral-400">Position</dt>
              <dd className="text-neutral-200 font-mono text-xs">
                {(asset.positionX ?? 0).toFixed(1)}, {(asset.positionY ?? 0).toFixed(1)},{" "}
                {(asset.positionZ ?? 0).toFixed(1)}
              </dd>
            </div>
          </dl>
        </section>

        {/* Sensors */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-neutral-400 mb-2">
            Sensors ({sensors.length})
          </h3>
          {loading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : sensors.length === 0 ? (
            <p className="text-sm text-neutral-500">No sensors attached.</p>
          ) : (
            <ul className="space-y-2">
              {sensors.map((s) => {
                const readings = readingsBySensor[s.id] ?? [];
                const latest = readings[0];
                return (
                  <li
                    key={s.id}
                    className="border border-neutral-800 rounded p-2 bg-neutral-950"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-neutral-200 capitalize">{s.type}</span>
                      <span className="text-base font-mono font-semibold text-white">
                        {latest ? latest.value.toFixed(2) : "—"}
                        <span className="text-xs text-neutral-500 ml-1">{s.unit}</span>
                      </span>
                    </div>
                    {s.thresholdLow != null && s.thresholdHigh != null && (
                      <div className="text-xs text-neutral-500">
                        Normal range: {s.thresholdLow}–{s.thresholdHigh} {s.unit}
                      </div>
                    )}
                    {readings.length > 1 && (
                      <div className="mt-2">
                        <Sparkline values={readings.map((r) => r.value).reverse()} />
                        <div className="text-[10px] text-neutral-500 mt-1">
                          Last {readings.length} readings
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent alerts */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-neutral-400 mb-2">
            Recent Alerts ({alerts.length})
          </h3>
          {loading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-neutral-500">No alerts in history. ✓</p>
          ) : (
            <ul className="space-y-1.5">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="text-sm border-l-2 pl-2"
                  style={{
                    borderColor:
                      a.severity === "critical" ? "#ef4444" :
                      a.severity === "high" ? "#fb923c" :
                      a.severity === "medium" ? "#f59e0b" : "#737373",
                  }}
                >
                  <div className="text-neutral-200">{a.message}</div>
                  <div className="text-xs text-neutral-500">
                    {a.severity} · {a.status}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}

// ──── Mini sparkline (inline SVG, no deps) ────
function Sparkline({ values, width = 320, height = 36 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`)
    .join(" ");
  return (
    <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
