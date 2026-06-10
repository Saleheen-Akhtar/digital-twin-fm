"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import type { Alert, WorkOrder } from "@/lib/api-client";

const SEVERITY_STYLES: Record<string, { dot: string; label: string; bg: string }> = {
  critical: { dot: "bg-red-500", label: "Critical", bg: "bg-red-50 border-red-200" },
  high: { dot: "bg-orange-500", label: "High", bg: "bg-orange-50 border-orange-200" },
  medium: { dot: "bg-amber-400", label: "Medium", bg: "bg-amber-50 border-amber-200" },
  low: { dot: "bg-slate-300", label: "Low", bg: "bg-slate-50 border-slate-200" },
};

function friendlyAlertMessage(raw: string): string {
  const match = raw.match(
    /value\s+([\d.]+)\s+(\S+)\s+(below|above)\s+(low|high)\s+threshold\s+([\d.]+)/
  );
  if (!match) return raw;

  const value = match[1];
  const unit = match[2];
  const direction = match[3];
  const thresholdType = match[4];
  const threshold = match[5];

  const sensorLabels: Record<string, string> = {
    C: "Temperature", "°C": "Temperature", F: "Temperature", "°F": "Temperature",
    ppm: "CO\u2082 Level", "%": "Humidity", kW: "Power", W: "Power",
    K: "Temperature", hPa: "Pressure", Pa: "Pressure",
    mm: "Rainfall", "mm/h": "Rainfall", "°": "Angle",
  };

  const label = sensorLabels[unit] ?? `Sensor (${unit})`;
  const minMax = thresholdType === "low" ? "minimum" : "maximum";
  const prefix = direction === "below" ? "dropped below" : "exceeded";

  return `${label} ${prefix} ${minMax} — ${value}${unit} (target ${direction === "below" ? "≥" : "≤"} ${threshold}${unit})`;
}

function smartShortId(id: string | undefined | null): string {
  if (!id) return "—";
  if (id.includes("-") && id.length > 12) {
    return `#${id.slice(-6).toUpperCase()}`;
  }
  return id;
}

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: "Open", bg: "bg-red-100", text: "text-red-700" },
  acknowledged: { label: "Acknowledged", bg: "bg-amber-100", text: "text-amber-700" },
  in_progress: { label: "In Progress", bg: "bg-blue-100", text: "text-blue-700" },
  resolved: { label: "Resolved", bg: "bg-emerald-100", text: "text-emerald-700" },
};

type WOFormState = {
  open: boolean;
  alertId: string;
  assetId: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  submitting: boolean;
  success: boolean;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ackMsg, setAckMsg] = useState<string | null>(null);
  const [woForm, setWoForm] = useState<WOFormState>({
    open: false, alertId: "", assetId: "", title: "",
    priority: "medium", submitting: false, success: false,
  });

  const api = createBrowserApiClient();

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.get<Alert[]>("/alerts");
      setAlerts(Array.isArray(data) ? data.filter((a) => a.status !== "cancelled" && a.status !== "resolved" && a.status !== "closed") : []);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.get<Alert[]>("/alerts");
        if (!cancelled) {
          setAlerts(Array.isArray(data) ? data.filter((a) => a.status !== "cancelled" && a.status !== "resolved" && a.status !== "closed") : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load alerts");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAcknowledge = useCallback(async (alert: Alert) => {
    try {
      await api.patch(`/alerts/${alert.id}`, { status: "acknowledged" });
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, status: "acknowledged" as Alert["status"] } : a))
      );
      setAckMsg(`Acknowledged: ${friendlyAlertMessage(alert.message).slice(0, 60)}…`);
      setTimeout(() => setAckMsg(null), 3000);
    } catch (err) {
      setAckMsg(err instanceof Error ? err.message : "Failed to acknowledge");
      setTimeout(() => setAckMsg(null), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openWoForm = useCallback((alert: Alert) => {
    setWoForm({
      open: true,
      alertId: alert.id,
      assetId: alert.assetId ?? "",
      title: `Work order: ${friendlyAlertMessage(alert.message).slice(0, 80)}`,
      priority: alert.severity === "critical" || alert.severity === "high" ? "critical" : "medium",
      submitting: false,
      success: false,
    });
  }, []);

  const closeWoForm = useCallback(() => {
    setWoForm((prev) => ({ ...prev, open: false, success: false }));
  }, []);

  const submitWorkOrder = useCallback(async () => {
    if (!woForm.title.trim()) return;
    setWoForm((prev) => ({ ...prev, submitting: true }));
    try {
      const body: Record<string, unknown> = {
        assetId: woForm.assetId,
        alertId: woForm.alertId || undefined,
        title: woForm.title,
        priority: woForm.priority,
      };
      // Remove undefined keys
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      await api.post<WorkOrder>('/work-orders', body);
      setWoForm((prev) => ({ ...prev, submitting: false, success: true }));
      setAckMsg("Work order created successfully!");
      setTimeout(() => {
        setAckMsg(null);
        setWoForm((prev) => ({ ...prev, open: false, success: false }));
      }, 1500);
    } catch (err) {
      setAckMsg(err instanceof Error ? err.message : "Failed to create work order");
      setWoForm((prev) => ({ ...prev, submitting: false }));
      setTimeout(() => setAckMsg(null), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [woForm.assetId, woForm.alertId, woForm.title, woForm.priority]);

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
              {loading ? "Loading..." : `${alerts.length} unresolved alerts`}
            </p>
          </div>
        </section>

        {/* Toast message */}
        {ackMsg && (
          <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-slate-800 shadow-lg">
            {ackMsg}
          </div>
        )}

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
            <p className="text-[15px] text-slate-500">No unresolved alerts</p>
            <p className="text-[13px] text-slate-400">Everything is running smoothly</p>
          </div>
        ) : (
          <>
            {/* Alert Cards */}
            <div className="grid gap-3 px-2 sm:px-1">
              {alerts.map((alert) => {
                const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low;
                const badge = STATUS_BADGE[alert.status] ?? STATUS_BADGE.open;
                const isOpen = alert.status === "open";
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
                      <div className="flex shrink-0 items-start gap-2">
                        {isOpen && (
                          <>
                            <button
                              onClick={() => handleAcknowledge(alert)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 hover:border-amber-300 hover:text-amber-700 transition-colors"
                            >
                              Acknowledge
                            </button>
                            <button
                              onClick={() => openWoForm(alert)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                              + Work Order
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Create Work Order Modal */}
      {woForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-semibold text-slate-900">Create Work Order</h3>
            <p className="mt-1 text-[13px] text-slate-500">From alert {smartShortId(woForm.alertId)}</p>

            {woForm.success ? (
              <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-[14px] font-medium text-emerald-700">
                ✓ Work order created!
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="text-[13px] font-medium text-slate-700">Title</label>
                  <input
                    type="text"
                    value={woForm.title}
                    onChange={(e) => setWoForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Work order title"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-slate-700">Priority</label>
                  <select
                    value={woForm.priority}
                    onChange={(e) => setWoForm((prev) => ({ ...prev, priority: e.target.value as WOFormState["priority"] }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={closeWoForm}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitWorkOrder}
                    disabled={woForm.submitting || !woForm.title.trim()}
                    className="rounded-xl bg-[#355fe5] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a4fc7] disabled:opacity-50"
                  >
                    {woForm.submitting ? "Creating..." : "Create Work Order"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
