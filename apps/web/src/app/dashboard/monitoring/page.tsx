"use client";

import { useEffect, useState } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import type { Sensor } from "@/lib/api-client";

type ChartDef = {
  key: string;
  label: string;
  unit: string;
  color: string;
  bgGrad: string;
  icon: string;
};

const CHARTS: ChartDef[] = [
  { key: "temperature", label: "Temperature", unit: "°C", color: "#ef4444", bgGrad: "from-red-500/5 to-red-500/[0.02]", icon: "M12 2v20M2 12h20" },
  { key: "power", label: "Power", unit: "kW", color: "#22c55e", bgGrad: "from-emerald-500/5 to-emerald-500/[0.02]", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { key: "humidity", label: "Humidity", unit: "%", color: "#3b82f6", bgGrad: "from-blue-500/5 to-blue-500/[0.02]", icon: "M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" },
  { key: "occupancy", label: "CO₂", unit: "ppm", color: "#8b5cf6", bgGrad: "from-violet-500/5 to-violet-500/[0.02]", icon: "M12 2a10 10 0 1 0 10 10h-10V2z" },
];

function MiniChart({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return <div className="h-20 w-full rounded-lg bg-slate-50" />;
  const width = 400;
  const height = 80;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const gap = width / (points.length - 1);
  const coords = points
    .map((v, i) => `${i * gap},${height - ((v - min) / range) * (height - 6)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M 0 ${height} ${coords} L ${width} ${height} Z`} fill={`url(#grad-${color.replace("#", "")})`} />
      <polyline points={coords} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "all 0.8s ease-in-out" }} />
    </svg>
  );
}

const SENSOR_MAP: Record<string, string[]> = {
  temperature: ["temperature"],
  power: ["power"],
  humidity: ["humidity"],
  occupancy: ["occupancy", "co2"],
};

export default function MonitoringPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = createBrowserApiClient();

    async function fetchSensors() {
      try {
        const data = await api.get<Sensor[]>("/sensors");
        if (!cancelled) {
          setSensors(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load sensor data");
          setLoading(false);
        }
      }
    }

    fetchSensors();
    const timer = window.setInterval(fetchSensors, 10_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const onlineSensors = sensors.filter((s) => s.lastValue != null).length;

  function getChartData(def: ChartDef) {
    const allowedTypes = SENSOR_MAP[def.key] ?? [def.key];
    const matched = sensors.filter((s) => allowedTypes.includes(s.type) && s.lastValue != null);
    if (matched.length === 0) return null;
    const sensor = matched[0];
    const points = [...matched.map((s) => Math.max(0, s.lastValue ?? 0))];
    const value = def.key === "temperature"
      ? `${sensor.lastValue!.toFixed(1)}${def.unit}`
      : def.key === "power"
      ? `${sensor.lastValue!.toFixed(0)} ${def.unit}`.trim()
      : `${sensor.lastValue!.toFixed(0)}${def.unit}`;
    return { value, points, sensorCount: matched.length };
  }

  return (
    <div className="flex-1 px-3 pb-4 pt-5 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-4">
        {/* Header */}
        <section className="flex items-center justify-between px-2 sm:px-1">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Monitoring</h1>
            <p className="mt-1 text-[15px] text-slate-500">
              {loading
                ? "Loading sensor data..."
                : `${sensors.length} sensors · ${onlineSensors} online`}
            </p>
          </div>
          {!loading && !error && (
            <div className="flex items-center gap-2 text-[13px] text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live · 10s refresh
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[15px] text-slate-400">
            Loading sensors...
          </div>
        ) : sensors.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <svg className="h-12 w-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            <p className="text-[15px] text-slate-500">No sensors found</p>
            <p className="text-[13px] text-slate-400">Run the simulator to start collecting data</p>
          </div>
        ) : (
          <>
            {/* Summary Bar */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-2 sm:px-1">
              {CHARTS.map((def) => {
                const data = getChartData(def);
                return (
                  <button
                    key={def.key}
                    onClick={() => setSelectedChart(selectedChart === def.key ? null : def.key)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      selectedChart === def.key
                        ? "border-slate-300 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
                        : "border-slate-100 bg-white/70 hover:border-slate-200 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-slate-500">{def.label}</span>
                      {data ? (
                        <span className="text-[12px] text-slate-400">{data.sensorCount} sensors</span>
                      ) : (
                        <span className="text-[12px] text-slate-300">No data</span>
                      )}
                    </div>
                    <span className="text-[24px] font-bold tracking-tight" style={{ color: def.color }}>
                      {data?.value ?? "—"}
                    </span>
                  </button>
                );
              })}
            </section>

            {/* Chart Cards - 2x2 Grid when viewing all, or expanded */}
            <section className="px-2 sm:px-1">
              {selectedChart ? (
                /* Expanded single chart */
                (() => {
                  const def = CHARTS.find((c) => c.key === selectedChart)!;
                  const data = getChartData(def);
                  if (!data) return null;
                  return (
                    <div className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${def.bgGrad} p-5`}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-[18px] font-medium text-slate-900">{def.label}</h3>
                          <p className="text-[13px] text-slate-500">{data.sensorCount} sensor(s) reporting</p>
                        </div>
                        <span className="text-[32px] font-bold" style={{ color: def.color }}>{data.value}</span>
                      </div>
                      <MiniChart points={data.points} color={def.color} />
                    </div>
                  );
                })()
              ) : (
                /* 2x2 grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {CHARTS.map((def) => {
                    const data = getChartData(def);
                    if (!data) return null;
                    return (
                      <div key={def.key} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)]`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: def.color }} />
                            <span className="text-[14px] font-medium text-slate-800">{def.label}</span>
                          </div>
                          <span className="text-[16px] font-semibold" style={{ color: def.color }}>{data.value}</span>
                        </div>
                        <MiniChart points={data.points} color={def.color} />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Close expanded chart */}
            {selectedChart && (
              <div className="flex justify-center px-2">
                <button
                  onClick={() => setSelectedChart(null)}
                  className="rounded-2xl border border-slate-200 bg-white px-6 py-2 text-[13px] text-slate-600 hover:bg-slate-50"
                >
                  Show All Charts
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
