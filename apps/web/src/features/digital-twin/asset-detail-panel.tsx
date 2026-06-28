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

const STATUS_BG: Record<string, string> = {
  ok: "bg-green-50",
  warning: "bg-amber-50",
  critical: "bg-red-50",
  offline: "bg-neutral-50",
  info: "bg-blue-50",
};

const STATUS_TEXT: Record<string, string> = {
  ok: "text-green-700",
  warning: "text-amber-700",
  critical: "text-red-700",
  offline: "text-neutral-600",
  info: "text-blue-700",
};

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

  const cacheRef = useRef<Map<string, AssetDetailCacheEntry>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!asset) {
      setSensors([]);
      setReadingsBySensor({});
      setAlerts([]);
      return;
    }

    const cached = cacheRef.current.get(asset.id);
    if (cached && Date.now() - cached.fetchedAt < STALE_MS) {
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
        const api = createBrowserApiClient();
        const [allSensors, allAlerts] = await Promise.all([
          api.get<Sensor[]>("/sensors"),
          api.get<Alert[]>(`/alerts?assetId=${encodeURIComponent(asset.id)}&limit=5`),
        ]);
        const assetSensors = allSensors.filter((s) => s.assetId === asset.id);
        if (cancelled) return;

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

  // Close on Escape / click outside
  useEffect(() => {
    if (!asset) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [asset, onClose]);

  if (!asset) return null;

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const latestReading =
    sensors.length > 0 && readingsBySensor[sensors[0]?.id]?.[0]
      ? `${readingsBySensor[sensors[0].id][0].value.toFixed(2)} ${sensors[0].unit}`
      : null;

  return (
    <div
      ref={panelRef}
      className="fixed right-4 top-20 z-50 w-[340px] max-h-[calc(100vh-160px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in zoom-in-95 pointer-events-auto"
      data-testid="asset-detail-panel"
      style={{ animationDuration: "150ms" }}
    >
        {/* Header */}
        <div className={`px-4 py-3 border-b border-slate-100 ${STATUS_BG[asset.status] ?? ""}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[asset.status]}`} />
              <div className="min-w-0">
                <h2
                  className="text-sm font-semibold text-slate-900 truncate"
                  data-testid="asset-detail-name"
                >
                  {friendlyName(asset)}
                </h2>
                <p className="text-[11px] text-slate-500 truncate">
                  {TYPE_LABEL[asset.type] ?? asset.type} · {asset.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {latestReading && (
                <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                  {latestReading}
                </span>
              )}
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${STATUS_TEXT[asset.status] ?? "text-slate-600"}`}>
              {asset.status}
            </span>
            {asset.manufacturer && (
              <span className="text-[10px] text-slate-400">· {asset.manufacturer}</span>
            )}
            {asset.model && (
              <span className="text-[10px] text-slate-400">· {asset.model}</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-3">
          {/* Sensors summary row */}
          {sensors.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sensors.slice(0, 4).map((s) => {
                const latest = readingsBySensor[s.id]?.[0];
                return (
                  <div
                    key={s.id}
                    className="flex-1 min-w-[70px] bg-slate-50 rounded-lg px-2.5 py-1.5 text-center"
                  >
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 truncate">{s.type}</div>
                    <div className="text-xs font-semibold text-slate-800 mt-0.5">
                      {loading ? "—" : latest ? latest.value.toFixed(1) : "—"}
                      <span className="text-[9px] text-slate-400 ml-0.5">{s.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sparkline for first sensor */}
          {sensors.length > 0 && readingsBySensor[sensors[0].id]?.length > 1 && !loading && (
            <div className="bg-slate-50 rounded-lg p-2">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1">
                {sensors[0].type} trend
              </div>
              <Sparkline values={readingsBySensor[sensors[0].id].map((r) => r.value).reverse()} />
            </div>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Alerts {criticalCount > 0 ? `(${criticalCount} critical)` : ""}
                </span>
              </div>
              <div className="space-y-1">
                {alerts.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="text-[11px] border-l-2 pl-2 py-0.5"
                    style={{
                      borderColor:
                        a.severity === "critical" ? "#ef4444" :
                        a.severity === "high" ? "#fb923c" :
                        a.severity === "medium" ? "#f59e0b" : "#d4d4d4",
                    }}
                  >
                    <div className="text-slate-700 truncate">{a.message}</div>
                    <div className="text-[9px] text-slate-400">{a.severity}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
              Loading details…
            </div>
          )}

          {/* Empty sensor state */}
          {!loading && sensors.length === 0 && (
            <p className="text-[11px] text-slate-400">No sensors attached.</p>
          )}
        </div>
      </div>
    );
  }

// ──── Mini sparkline (inline SVG, no deps) ────
function Sparkline({ values, width = 320, height = 28 }: { values: number[]; width?: number; height?: number }) {
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
