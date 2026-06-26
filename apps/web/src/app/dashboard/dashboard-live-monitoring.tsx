"use client";

import { useEffect, useState, useTransition } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import { useSensorRealtime } from "@/hooks/useSensorRealtime";
import type { Sensor } from "@/lib/api-client";

type SensorsErrorState = {
  status: "error";
  code: string;
  message: string;
};

export type LiveMetric = "temperature" | "energy" | "humidity" | "occupancy";
export type LiveChartTone = "red" | "green" | "blue" | "violet";
export type LiveToneClass =
  | "text-red-500"
  | "text-emerald-500"
  | "text-blue-500"
  | "text-violet-500"
  | "text-orange-500";

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
  if (sensor.unit === "%" || sensor.unit.startsWith("\u00B0")) {
    return `${value.toFixed(0)}${sensor.unit}`;
  }
  return `${value.toFixed(0)} ${sensor.unit}`.trim();
}

function chartFromSensor(chart: LiveChartData, sensors: Sensor[]): LiveChartData {
  const allowedTypes = SENSOR_BY_METRIC[chart.metric];
  const sensor = sensors.find((item) => allowedTypes.includes(item.type));
  if (!sensor || sensor.lastValue == null) return chart;
  const newPoint = Math.max(0, Number(sensor.lastValue.toFixed(1)));
  const updated = [...chart.points.slice(-19), newPoint];
  return {
    ...chart,
    value: valueForSensor(sensor, chart.metric) ?? chart.value,
    points: updated.length >= 2 ? updated : [newPoint, newPoint],
  };
}

function chartFromLiveReading(
  chart: LiveChartData,
  sensors: Sensor[],
  liveValue: number,
  liveUnit: string,
): LiveChartData {
  const allowedTypes = SENSOR_BY_METRIC[chart.metric];
  const sensor = sensors.find((item) => allowedTypes.includes(item.type));
  if (!sensor) return chart;

  const newPoint = Math.max(0, Number(liveValue.toFixed(1)));
  const updated = [...chart.points.slice(-19), newPoint];
  let value = chart.value;
  if (chart.metric === "temperature") value = `${liveValue.toFixed(1)}${liveUnit}`;
  else if (liveUnit === "%" || liveUnit.startsWith("\u00B0")) {
    value = `${liveValue.toFixed(0)}${liveUnit}`;
  } else {
    value = `${liveValue.toFixed(0)} ${liveUnit}`.trim();
  }

  return {
    ...chart,
    value,
    points: updated.length >= 2 ? updated : [newPoint, newPoint],
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
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { readings: liveReadings, connected: wsConnected, error: wsError } = useSensorRealtime();

  useEffect(() => {
    setCharts(initialCharts);
  }, [initialCharts]);

  useEffect(() => {
    let cancelled = false;

    async function refreshSensors() {
      try {
        const api = createBrowserApiClient();
        const nextSensors = await api.get<Sensor[]>("/sensors");
        if (cancelled) return;
        setSensors(Array.isArray(nextSensors) ? nextSensors : []);
        startTransition(() => {
          setCharts((current) =>
            current.map((chart) => chartFromSensor(chart, nextSensors)),
          );
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
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (liveReadings.size === 0 || sensors.length === 0) return;
    setCharts((current) =>
      current.map((chart) => {
        const allowedTypes = SENSOR_BY_METRIC[chart.metric];
        const sensor = sensors.find((item) => allowedTypes.includes(item.type));
        if (!sensor) return chart;
        const live = liveReadings.get(sensor.id);
        if (!live) return chart;
        return chartFromLiveReading(chart, sensors, live.value, live.unit);
      }),
    );
    setLastUpdated(new Date());
  }, [liveReadings, sensors]);

  const statusLabel = sensorsError
    ? "Sensors unavailable"
    : error
    ? error
    : wsConnected
    ? `Live · updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : `Polling · updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <section className="w-full rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
            Live Monitoring
          </h2>
          <p className="mt-1 flex items-center gap-2 text-[12px] text-slate-500">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                wsConnected ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
            {statusLabel}
          </p>
        </div>
        <span className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-500">
          {isPending ? "Refreshing…" : wsConnected ? "Realtime" : "Polling"}
        </span>
      </div>

      {sensorsError ? (
        <div
          role="alert"
          data-testid="panel-error-sensors-monitoring"
          className="mb-4 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50/70 px-3 py-2 text-[12px] text-red-800"
        >
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
          <div>
            <div className="font-medium">Could not load sensors</div>
            <div className="opacity-80">{sensorsError.message}</div>
          </div>
        </div>
      ) : null}

      {wsError && !sensorsError ? (
        <p className="mb-4 text-[12px] text-amber-700">
          WebSocket unavailable — showing polled sensor data.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {charts.map((chart) => (
          <div
            key={chart.metric}
            className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.01)] transition duration-200 hover:shadow-[0_12px_24px_rgba(15,23,42,0.05)] hover:border-slate-300"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                <MetricDot tone={chart.line} />
                {chart.title}
              </div>
              <div className={`text-[17px] font-semibold tracking-tight ${chart.toneClass}`}>
                {chart.value}
              </div>
            </div>
            <div className="h-[126px] w-full">
              <MiniChart points={chart.points} line={chart.line} />
            </div>
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
  const [hovered, setHovered] = useState<{ x: number; y: number; val: number } | null>(null);

  const width = 340;
  const height = 126;

  if (points.length === 0) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const gap = width / (points.length - 1 || 1);

  const pts = points.map((value, index) => {
    const x = index * gap;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return { x, y, val: value };
  });

  const coords = pts.map((p) => `${p.x},${p.y}`).join(" ");

  const stroke = {
    red: "#ff4b4b",
    green: "#22c55e",
    blue: "#3b82f6",
    violet: "#8b5cf6",
  }[line];

  const unit = {
    red: "°C",
    green: " kW",
    blue: "%",
    violet: " ppm",
  }[line];

  return (
    <div className="relative h-[126px] w-full">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible block"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
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
        <polyline
          points={coords}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: "all 0.8s ease-in-out" }}
        />
        <path d={`M 0 ${height} ${coords} L ${width} ${height} Z`} fill={`${stroke}10`} />

        {/* Active hover dot indicator */}
        {hovered && (
          <circle
            cx={hovered.x}
            cy={hovered.y}
            r="4.5"
            fill={stroke}
            stroke="white"
            strokeWidth="1.5"
            className="transition-all duration-75"
          />
        )}

        {/* Transparent hover interactive zones */}
        {pts.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r="8"
            fill="transparent"
            className="cursor-pointer outline-none"
            tabIndex={0}
            onMouseEnter={() => setHovered({ x: pt.x, y: pt.y, val: pt.val })}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered({ x: pt.x, y: pt.y, val: pt.val })}
            onBlur={() => setHovered(null)}
          />
        ))}
      </svg>

      {/* HTML-based Tooltip Overlay to prevent horizontal stretching distortion */}
      {hovered && (
        <div
          className="absolute z-10 rounded-lg bg-[#0f172a]/95 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg pointer-events-none transition-all duration-75 whitespace-nowrap"
          style={{
            left: `${(hovered.x / width) * 100}%`,
            top: `${hovered.y - 28}px`,
            transform: "translateX(-50%)",
          }}
        >
          {hovered.val.toFixed(1)}{unit}
        </div>
      )}
    </div>
  );
}
