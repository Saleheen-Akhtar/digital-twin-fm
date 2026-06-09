"use client";

import { useEffect, useState } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import type { Alert } from "@/lib/api-client";

const SEVERITY_STYLES: Record<string, { dot: string; label: string; bg: string }> = {
  critical: { dot: "bg-red-500", label: "Critical", bg: "bg-red-50 border-red-200" },
  high: { dot: "bg-orange-500", label: "High", bg: "bg-orange-50 border-orange-200" },
  medium: { dot: "bg-amber-400", label: "Medium", bg: "bg-amber-50 border-amber-200" },
  low: { dot: "bg-slate-300", label: "Low", bg: "bg-slate-50 border-slate-200" },
};

function friendlyAlertMessage(raw: string): string {
  // Raw format: "{uuid} value {value} {unit} below/above low/high threshold {threshold}"
  const match = raw.match(
    /value\s+([\d.]+)\s+(\S+)\s+(below|above)\s+(low|high)\s+threshold\s+([\d.]+)/
  );
  if (!match) return raw; // fallback

  const value = match[1];
  const unit = match[2];
  const direction = match[3]; // below | above
  const thresholdType = match[4]; // low | high
  const threshold = match[5];

  // Map units to friendly names
  const sensorLabels: Record<string, string> = {
    C: "Temperature",
    "°C": "Temperature",
    F: "Temperature",
    "°F": "Temperature",
    ppm: "CO₂ Level",
    "%": "Humidity",
    kW: "Power",
    W: "Power",
    K: "Temperature",
    hPa: "Pressure",
    Pa: "Pressure",
    mm: "Rainfall",
    "mm/h": "Rainfall",
    "°": "Angle",
  };

  const label = sensorLabels[unit] ?? `Sensor (${unit})`;

  const minMax = thresholdType === "low" ? "minimum" : "maximum";
  const prefix = direction === "below" ? "dropped below" : "exceeded";

  return `${label} ${prefix} ${minMax} — ${value}${unit} (target ${direction === "below" ? "≥" : "≤"} ${threshold}${unit})`;
}

function smartShortId(id: string | undefined | null): string {
  if (!id) return "—";
  // If looks like a full UUID, show last 6 chars with prefix
  if (id.includes("-") && id.length > 12) {
    const short = id.slice(-6).toUpperCase();
    return `#${short}`;
  }
  return id;
}

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: "Open", bg: "bg-red-100", text: "text-red-700" },
  acknowledged: { label: "Acknowledged", bg: "bg-amber-100", text: "text-amber-700" },
  resolved: { label: "Resolved", bg: "bg-emerald-100", text: "text-emerald-700" },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "table">("cards");

  useEffect(() => {
    let cancelled = false;
    const api = createBrowserApiClient();

    async function fetchAlerts() {
      try {
        const data = await api.get<Alert[]>("/alerts?status=open");
        if (!cancelled) {
          setAlerts(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load alerts");
          setLoading(false);
        }
      }
    }

    fetchAlerts();
    return () => { cancelled = true; };
  }, []);

  const criticalCount = alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;
  const mediumCount = alerts.filter((a) => a.severity === "medium").length;
  const lowCount = alerts.filter((a) => a.severity === "low").length;

  return (
    <div className="flex-1 px-3 pb-4 pt-5 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-4">
        {/* Header */}
        <section className="flex items-center justify-between px-2 sm:px-1">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Alerts</h1>
            <p className="mt-1 text-[15px] text-slate-500">
              {loading ? "Loading..." : `${alerts.length} open alerts`}
            </p>
          </div>
        </section>

        {/* Summary Cards */}
        {!loading && alerts.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-3 px-2 sm:px-1">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <span className="text-[28px] font-bold text-red-600">{criticalCount}</span>
              <p className="mt-1 text-[13px] text-red-700 font-medium">Critical / High</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <span className="text-[28px] font-bold text-amber-600">{mediumCount}</span>
              <p className="mt-1 text-[13px] text-amber-700 font-medium">Medium</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-[28px] font-bold text-slate-600">{lowCount}</span>
              <p className="mt-1 text-[13px] text-slate-600 font-medium">Low</p>
            </div>
          </section>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[15px] text-slate-400">
            Loading alerts...
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <svg className="h-12 w-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="text-[15px] text-slate-500">No open alerts</p>
            <p className="text-[13px] text-slate-400">Everything is running smoothly</p>
          </div>
        ) : (
          <>
            {/* Alert Cards */}
            <div className="grid gap-3 px-2 sm:px-1">
              {alerts.map((alert) => {
                const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low;
                const badge = STATUS_BADGE[alert.status] ?? STATUS_BADGE.open;
                return (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)]`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${style.dot}`} />
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-slate-900 leading-snug">
                            {friendlyAlertMessage(alert.message)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="2" width="20" height="20" rx="2.18" />
                                <path d="M7 2v4M17 2v4M2 7h20" />
                              </svg>
                              {alert.createdAt
                                ? new Date(alert.createdAt).toLocaleString("en-SG", {
                                    hour: "2-digit", minute: "2-digit",
                                    day: "numeric", month: "short",
                                  })
                                : "—"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                              Asset {smartShortId(alert.assetId)}
                            </span>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.bg} ${badge.text}`}>
                              {badge.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                              {style.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
                        Acknowledge
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
