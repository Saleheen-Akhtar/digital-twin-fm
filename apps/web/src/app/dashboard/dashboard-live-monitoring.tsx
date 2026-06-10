"use client";

import { useEffect, useState, useTransition } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import type { Sensor } from "@/lib/api-client";

// Mirrors the `SourceState` discriminated union from `./page`. Declared
// locally so the client component does not have to pull server-only
// types from `page.tsx`.
type SensorsErrorState = {
  status: "error";
  code: string;
  message: string;
};

export type LiveMetric = "temperature" | "energy" | "humidity" | "occupancy";
export type LiveChartTone = "red" | "green" | "blue" | "violet";
export type LiveToneClass = "text-red-500" | "text-emerald-500" | "text-blue-500" | "text-violet-500" | "text-orange-500";

export type LiveChartData = {
  metric: LiveMetric;
  title: string;
  value: string;
  toneClass: LiveToneClass;
  line: LiveChartTone;
  points: number[];
};

const SENSOR_BY_METRIC: Record<LiveMetric, string[]> = {
  temperature: ["temperature"],
  energy: ["power"],
  humidity: ["humidity"],
  occupancy: ["occupancy", "co2"],
};

function valueForSensor(sensor: Sensor, metric: LiveMetric) {
  const value = sensor.lastValue;
  if (value == null || !Number.isFinite(value)) return null;
  if (metric === "temperature") return `${value.toFixed(1)}${sensor.unit}`;
  if (sensor.unit === "%" || sensor.unit.startsWith("\u00B0")) return `${value.toFixed(0)}${sensor.unit}`;
  return `${value.toFixed(0)} ${sensor.unit}`.trim();
}

function chartFromSensor(chart: LiveChartData, sensors: Sensor[]): LiveChartData {
  const allowedTypes = SENSOR_BY_METRIC[chart.metric];
  const sensor = sensors.find((item) => allowedTypes.includes(item.type));
  if (!sensor || sensor.lastValue == null) return chart;
  const newPoint = Math.max(0, Number(sensor.lastValue.toFixed(1)));
  const updated = [...chart.points.slice(-11), newPoint];
  return {
    ...chart,
    value: valueForSensor(sensor, chart.metric) ?? chart.value,
    points: updated,
  };
}

export function DashboardLiveMonitoring({
  initialCharts,
  sensorsError,
}: {
  initialCharts: LiveChartData[];
  sensorsError?: SensorsErrorState | null;
}) {
  const [charts, setCharts] = useState(initialCharts);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    let cancelled = false;

    async function refreshSensors() {
      try {
        const api = createBrowserApiClient();
        const sensors = await api.get<Sensor[]>("/sensors");
        if (cancelled) return;
        startTransition(() => {
          setCharts((current) => current.map((chart) => chartFromSensor(chart, sensors)));
          setLastUpdated(new Date());
          setError(null);
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Live monitoring unavailable");
      }
    }

    void refreshSensors();
    const timer = window.setInterval(refreshSensors, 10_000);
    const countdownTimer = window.setInterval(() => {
      setCountdown((c) => (c <= 1 ? 10 : c - 1));
    }, 1_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(countdownTimer);
    };
  }, []);

  return (
    <section className="xl:col-span-2 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-medium tracking-[-0.03em] text-slate-950">Live Monitoring</h2>
          <p className="mt-1 text-[12px] text-slate-500">
            {sensorsError
              ? "Sensors unavailable"
              : error
              ? error
              : `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Live ${countdown}s`}
          </p>
        </div>
        <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-500">
          {isPending ? "Refreshing" : "Last 1 Hour"}
        </button>
      </div>

      {/*
        Per Finding 14: if the parent server-rendered fetch of /sensors
        failed, the SSR sensor list is empty and every chart would show
        "--" without explanation. Surface the SSR failure here too so the
        panel honestly reports its state.
      */}
      {sensorsError ? (
        <div
          role="alert"
          data-testid="panel-error-sensors-monitoring"
          className="mb-3 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50/70 px-3 py-2 text-[12px] text-red-800"
        >
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
          <div>
            <div className="font-medium">Could not load sensors</div>
            <div className="opacity-80">{sensorsError.message}</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {charts.map((chart) => (
          <div key={chart.title} className="rounded-[18px] border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] text-slate-900">
                <MetricDot tone={chart.line} />
                {chart.title}
              </div>
              <div className={`text-[14px] font-medium ${chart.toneClass}`}>{chart.value}</div>
            </div>
            <MiniChart points={chart.points} line={chart.line} />
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricDot({ tone }: { tone: LiveChartTone }) {
  const color = {
    red: "bg-red-500",
    green: "bg-emerald-500",
    blue: "bg-blue-500",
    violet: "bg-violet-500",
  }[tone];
  return <span className={`size-2.5 rounded-full ${color}`} />;
}

function MiniChart({ points, line }: { points: number[]; line: LiveChartTone }) {
  const width = 340;
  const height = 126;
  const coords = valuesToPoints(points, width, height);
  const stroke = {
    red: "#ff4b4b",
    green: "#22c55e",
    blue: "#3b82f6",
    violet: "#8b5cf6",
  }[line];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[126px] w-full" aria-hidden="true">
      {[0, 1, 2, 3].map((row) => (
        <line
          key={row}
          x1="0"
          x2={width}
          y1={(height / 3) * row}
          y2={(height / 3) * row}
          stroke="#eef2f7"
          strokeWidth="1"
        />
      ))}
      <polyline points={coords} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "all 0.8s ease-in-out" }} />
      <path d={`M 0 ${height} ${coords} L ${width} ${height} Z`} fill={`${stroke}10`} />
    </svg>
  );
}

function valuesToPoints(values: number[], width: number, height: number) {
  if (values.length <= 1) return `0,${height} ${width},${height}`;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const gap = width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * gap;
      const y = height - ((value - min) / (max - min || 1)) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");
}
