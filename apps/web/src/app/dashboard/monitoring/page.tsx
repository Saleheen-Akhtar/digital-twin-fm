"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import { useSensorRealtime } from "@/hooks/useSensorRealtime";
import type { Sensor, Building } from "@/lib/api-client";

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

const SENSOR_MAP: Record<string, string[]> = {
  temperature: ["temperature"],
  power: ["power"],
  humidity: ["humidity"],
  occupancy: ["occupancy", "co2"],
};

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

export default function MonitoringPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [chartPoints, setChartPoints] = useState<Record<string, number[]>>({});
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [copilotInsight, setCopilotInsight] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotQuestion, setCopilotQuestion] = useState("");

  // WebSocket live sensor readings
  const { readings: liveReadings, connected: wsConnected, error: wsError } = useSensorRealtime();
  const sensorsRef = useRef<Sensor[]>([]);

  // Keep sensorsRef in sync with state for use in the WS callback
  sensorsRef.current = sensors;

  // Update chart points when a live reading arrives
  const readingTs = useRef<Record<string, number>>({});

  const addChartPoint = useCallback((chartKey: string, value: number) => {
    setChartPoints((prev) => {
      const existing = prev[chartKey] ?? [];
      const updated = [...existing.slice(-19), value]; // keep last 20 points
      return { ...prev, [chartKey]: updated };
    });
  }, []);

  const askCopilot = useCallback(async (question: string) => {
    if (!question.trim() || !buildingId) return;
    setCopilotLoading(true);
    setCopilotInsight(null);
    try {
      const api = createBrowserApiClient();
      const res = await api.post<{ answer: string }>("/ai/copilot/query", {
        question: question.trim(),
        building_id: buildingId,
      });
      setCopilotInsight(res.answer);
    } catch {
      setCopilotInsight("Failed to get AI response. The copilot service may be offline.");
    } finally {
      setCopilotLoading(false);
    }
  }, [buildingId]);

  // Merge live WS readings into sensor state
  useEffect(() => {
    if (liveReadings.size === 0) return;

    let changed = false;
    const updated = sensorsRef.current.map((s) => {
      const live = liveReadings.get(s.id);
      if (live && live.value !== s.lastValue) {
        changed = true;
        // Map sensor type to chart key and add point
        for (const [chartKey, types] of Object.entries(SENSOR_MAP)) {
          if (types.includes(s.type)) {
            // Throttle to ~1 update per sensor per second to avoid chart spam
            const now = Date.now();
            const last = readingTs.current[`${chartKey}-${s.id}`] ?? 0;
            if (now - last > 900) {
              readingTs.current[`${chartKey}-${s.id}`] = now;
            }
            addChartPoint(chartKey, live.value);
          }
        }
        return { ...s, lastValue: live.value };
      }
      return s;
    });

    if (changed) {
      setSensors(updated as Sensor[]);
    }
  }, [liveReadings, addChartPoint]);

  // Initial HTTP load + set up fallback stale timer
  useEffect(() => {
    let cancelled = false;
    const api = createBrowserApiClient();

    async function fetchSensors() {
      try {
        const [sensorsData, buildingsData] = await Promise.all([
          api.get<Sensor[]>("/sensors"),
          api.get<Building[]>("/buildings"),
        ]);
        if (!cancelled) {
          const list = Array.isArray(sensorsData) ? sensorsData : [];
          setSensors(list);

          // Set building ID
          const buildings = Array.isArray(buildingsData) ? buildingsData : [];
          if (buildings[0]?.id) {
            setBuildingId(buildings[0].id);
          }

          // Initialise chart points with current sensor values
          const points: Record<string, number[]> = {};
          for (const def of CHARTS) {
            const allowedTypes = SENSOR_MAP[def.key] ?? [def.key];
            const matched = list.filter(
              (s) => allowedTypes.includes(s.type) && s.lastValue != null
            );
            // Seed 2 points from current values for mini-chart shape
            const vals = matched.map((s) => Math.max(0, s.lastValue ?? 0));
            if (vals.length > 0) {
              points[def.key] = [vals[0], vals[0]];
            }
          }
          setChartPoints(points);
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

    // Fallback HTTP refresh every 60s when WS is down (otherwise WS handles live)
    const timer = window.setInterval(fetchSensors, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const onlineSensors = sensors.filter((s) => s.lastValue != null).length;

  function getChartData(def: ChartDef) {
    const allowedTypes = SENSOR_MAP[def.key] ?? [def.key];
    const matched = sensors.filter((s) => allowedTypes.includes(s.type) && s.lastValue != null);
    if (matched.length === 0) return null;
    const sensor = matched[0];
    const points = chartPoints[def.key] ?? [Math.max(0, sensor.lastValue ?? 0)];
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
            <div className="flex items-center gap-2 text-[13px]">
              <span className={`h-2 w-2 rounded-full ${wsConnected ? "bg-emerald-500" : "bg-amber-400"}`} />
              <span className={wsConnected ? "text-emerald-600" : "text-amber-600"}>
                {wsConnected ? "Live" : "Buffered"}
              </span>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
            {error}
          </div>
        )}
        {wsError && !error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-800">
            WS: {wsError}
          </div>
        )}

        {wsError && !error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-800">
            ⚡ Live updates unavailable: {wsError}
            <span className="ml-2 text-amber-600">Falling back to 60s refresh</span>
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

            {/* ── Copilot Insight ── */}
            <section className="px-2 sm:px-1">
              <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a10 10 0 1 0 10 10h-10V2z" /><path d="M12 12 2 2" /><path d="M12 12 22 2" />
                    </svg>
                    <span className="text-[14px] font-medium text-slate-800">AI Insight</span>
                  </div>
                  {!buildingId && (
                    <span className="text-[12px] text-slate-400">No building loaded</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask about building health…"
                    value={copilotQuestion}
                    onChange={(e) => setCopilotQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !copilotLoading) {
                        askCopilot(copilotQuestion);
                        setCopilotQuestion("");
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                  />
                  <button
                    onClick={() => { askCopilot(copilotQuestion); setCopilotQuestion(""); }}
                    disabled={copilotLoading || !copilotQuestion.trim() || !buildingId}
                    className="rounded-xl bg-indigo-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo-600 disabled:opacity-40"
                  >
                    {copilotLoading ? "…" : "Ask"}
                  </button>
                </div>

                {copilotInsight && (
                  <div className="mt-3 rounded-xl border border-indigo-100 bg-white px-4 py-3 text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {copilotInsight}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
