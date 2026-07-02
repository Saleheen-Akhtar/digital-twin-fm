"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import type { WorkOrder } from "@/lib/api-client";

interface Asset {
  id: string;
  name: string;
  type?: string;
}

interface MaintenanceLog {
  id: string;
  workOrderId: string;
  action: string;
  notes?: string;
  createdAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-blue-400",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critical", high: "High", medium: "Medium", low: "Low",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  assigned: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
  blocked: "bg-rose-100 text-rose-700",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open", assigned: "Assigned", in_progress: "In Progress",
  completed: "Completed", cancelled: "Cancelled", blocked: "Blocked",
};

type NewWOForm = {
  title: string; assetId: string; priority: "low" | "medium" | "high" | "critical"; description: string;
};

type StatusTab = "all" | "open" | "in_progress" | "completed";

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState<NewWOForm>({ title: "", assetId: "", priority: "medium", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Detail drawer
  const [detailWo, setDetailWo] = useState<WorkOrder | null>(null);
  const [detailLogs, setDetailLogs] = useState<MaintenanceLog[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const api = createBrowserApiClient();

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 2500);
  }, []);

  // ── Fetch ──
  const _fetchOrders = useCallback(async () => {
    try {
      const data = await api.get<WorkOrder[]>("/work-orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load work orders");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [woData, assetData] = await Promise.all([
          api.get<WorkOrder[]>("/work-orders"),
          api.get<Asset[]>("/assets"),
        ]);
        if (!cancelled) {
          setOrders(Array.isArray(woData) ? woData : []);
          setAssets(Array.isArray(assetData) ? assetData : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load work orders");
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assetNameMap = new Map(assets.map((a) => [a.id, a.name]));

  function friendlyAsset(id: string | undefined): string {
    if (!id) return "—";
    const name = assetNameMap.get(id);
    if (name) return name;
    if (id.includes("-") && id.length > 12) return `#${id.slice(-6).toUpperCase()}`;
    return id.slice(0, 12);
  }

  // ── Detail drawer ──
  const openDetail = useCallback(async (wo: WorkOrder) => {
    setDetailWo(wo);
    setDetailLoading(true);
    try {
      const logs = await api.get<MaintenanceLog[]>(`/work-orders/${wo.id}/logs`);
      setDetailLogs(Array.isArray(logs) ? logs : []);
    } catch {
      setDetailLogs([]);
    } finally {
      setDetailLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeDetail = useCallback(() => {
    setDetailWo(null);
    setDetailLogs([]);
  }, []);

  const handleDetailUpdate = useCallback(async (wo: WorkOrder, updates: Record<string, unknown>) => {
    try {
      const updated = await api.patch<WorkOrder>(`/work-orders/${wo.id}`, updates);
      setOrders((prev) => prev.map((o) => (o.id === wo.id ? updated : o)));
      setDetailWo(updated);
      // Refresh logs
      const logs = await api.get<MaintenanceLog[]>(`/work-orders/${wo.id}/logs`);
      setDetailLogs(Array.isArray(logs) ? logs : []);
      showToast("Updated");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Status update ──
  const handleUpdateStatus = useCallback(async (id: string, newStatus: WorkOrder["status"]) => {
    setUpdatingId(id);
    try {
      const updated = await api.patch<WorkOrder>(`/work-orders/${id}`, { status: newStatus });
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)));
      if (detailWo?.id === id) setDetailWo((prev) => prev ? { ...prev, status: updated.status } : null);
      showToast(`Status → ${STATUS_LABELS[newStatus] ?? newStatus}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailWo]);

  const handleCreate = useCallback(async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { title: form.title, priority: form.priority, assetId: form.assetId || undefined, description: form.description || undefined };
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      await api.post<WorkOrder>("/work-orders", body);
      setShowNewForm(false);
      setForm({ title: "", assetId: "", priority: "medium", description: "" });
      showToast("Work order created!");
      const data = await api.get<WorkOrder[]>("/work-orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create work order");
    } finally {
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const filteredOrders = statusFilter === "all"
    ? orders
    : orders.filter((o) => o.status === statusFilter);

  const openCount = orders.filter((o) => o.status === "open").length;
  const inProgressCount = orders.filter((o) => o.status === "in_progress").length;
  const completedCount = orders.filter((o) => o.status === "completed").length;

  const statusTabs: { key: StatusTab; label: string; count: number; color: string }[] = [
    { key: "all", label: "All", count: orders.length, color: "text-slate-700" },
    { key: "open", label: "Open", count: openCount, color: "text-red-600" },
    { key: "in_progress", label: "In Progress", count: inProgressCount, color: "text-amber-600" },
    { key: "completed", label: "Completed", count: completedCount, color: "text-emerald-600" },
  ];

  return (
    <div className="flex-1 px-3 pb-4 pt-5 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-4">
        {/* Header */}
        <section className="flex items-center justify-between px-2 sm:px-1">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Work Orders</h1>
            <p className="mt-1 text-[15px] text-slate-500">
              {loading ? "Loading..." : `${orders.length} total work orders`}
            </p>
          </div>
          <button onClick={() => setShowNewForm(true)}
            className="rounded-2xl bg-[#355fe5] px-5 py-2.5 text-[13px] font-medium text-white shadow-[0_4px_12px_rgba(53,95,229,0.3)] hover:bg-[#2a4fc7] transition-colors">
            + New Work Order
          </button>
        </section>

        {/* Toast */}
        {toast && (
          <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-slate-800 shadow-lg">
            {toast}
          </div>
        )}

        {/* Status tabs */}
        {!loading && orders.length > 0 && (
          <section className="flex flex-wrap gap-3 px-2 sm:px-1">
            {statusTabs.map((tab) => (
              <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[13px] font-medium transition-colors ${
                  statusFilter === tab.key
                    ? "border-[#355fe5] bg-blue-50 text-[#355fe5]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}>
                <span>{tab.label}</span>
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                  statusFilter === tab.key ? "bg-[#355fe5] text-white" : "bg-slate-100 text-slate-500"
                }`}>{tab.count}</span>
              </button>
            ))}
          </section>
        )}

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[15px] text-slate-400">Loading work orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-[15px] text-slate-500">
            <p>{statusFilter === "all" ? "No work orders found" : `No ${statusFilter.replace("_", " ")} work orders`}</p>
            {statusFilter !== "all" && (
              <button onClick={() => setStatusFilter("all")} className="text-[13px] text-blue-600 underline hover:text-blue-700">View all</button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[13px] text-slate-500">
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Asset</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((wo) => (
                  <tr key={wo.id}
                    onClick={() => openDetail(wo)}
                    className="border-b border-slate-50 text-[14px] last:border-0 hover:bg-slate-50/50 cursor-pointer">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${PRIORITY_COLORS[wo.priority] ?? "bg-slate-300"}`} />
                        <span className="text-[12px] text-slate-500">{PRIORITY_LABELS[wo.priority] ?? wo.priority}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">{wo.title}</td>
                    <td className="px-5 py-3 text-slate-500">{wo.type}</td>
                    <td className="px-5 py-3 text-[13px] text-slate-500">{friendlyAsset(wo.assetId)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                        STATUS_COLORS[wo.status] ?? "bg-slate-100 text-slate-600"
                      }`}>{wo.status.replace("_", " ")}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {wo.status === "open" && (
                          <button onClick={() => handleUpdateStatus(wo.id, "in_progress")}
                            disabled={updatingId === wo.id}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50">Start</button>
                        )}
                        {(wo.status === "open" || wo.status === "in_progress" || wo.status === "assigned") && (
                          <button onClick={() => handleUpdateStatus(wo.id, "completed")}
                            disabled={updatingId === wo.id}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">Complete</button>
                        )}
                        {wo.status === "open" && (
                          <button onClick={() => handleUpdateStatus(wo.id, "cancelled")}
                            disabled={updatingId === wo.id}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {wo.createdAt
                        ? new Date(wo.createdAt).toLocaleString("en-SG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {detailWo && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={closeDetail} />
          <div className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${STATUS_COLORS[detailWo.status] ?? ""}`}>
                      {STATUS_LABELS[detailWo.status] ?? detailWo.status}
                    </span>
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${PRIORITY_COLORS[detailWo.priority] ?? "bg-slate-300"}`} />
                    <span className="text-[12px] text-slate-500">{PRIORITY_LABELS[detailWo.priority]}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">{detailWo.title}</h2>
                </div>
                <button onClick={closeDetail} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Asset */}
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-1">Asset</label>
                <p className="text-[14px] text-slate-800">{friendlyAsset(detailWo.assetId)}</p>
              </div>

              {/* Type */}
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-1">Type</label>
                <p className="text-[14px] text-slate-800 capitalize">{detailWo.type}</p>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-1">Description</label>
                {detailWo.description ? (
                  <p className="text-[14px] text-slate-700 leading-relaxed">{detailWo.description}</p>
                ) : (
                  <p className="text-[14px] text-slate-400 italic">No description</p>
                )}
              </div>

              {/* Assignment */}
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-1">Assigned To</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={detailWo.assignedTo ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (detailWo.assignedTo ?? "")) {
                        handleDetailUpdate(detailWo, { assignedTo: v || undefined });
                      }
                    }}
                    placeholder="Unassigned — type a name"
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Status actions */}
              <div className="mb-6 flex gap-2">
                {(detailWo.status === "open" || detailWo.status === "assigned") && (
                  <button onClick={() => handleUpdateStatus(detailWo.id, "in_progress")}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-[13px] font-medium text-amber-700 hover:bg-amber-100">Start Work</button>
                )}
                {(detailWo.status === "open" || detailWo.status === "in_progress" || detailWo.status === "assigned") && (
                  <button onClick={() => handleUpdateStatus(detailWo.id, "completed")}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] font-medium text-emerald-700 hover:bg-emerald-100">Mark Complete</button>
                )}
                <button onClick={() => handleUpdateStatus(detailWo.id, "blocked")}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-medium text-rose-700 hover:bg-rose-100">Blocked</button>
              </div>

              {/* Metadata */}
              <div className="mb-6">
                <label className="block text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-2">Details</label>
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div><span className="text-slate-400">Created:</span> <span className="text-slate-700">{new Date(detailWo.createdAt).toLocaleString()}</span></div>
                  <div><span className="text-slate-400">Type:</span> <span className="text-slate-700">{detailWo.type}</span></div>
                  {detailWo.startedAt && <div><span className="text-slate-400">Started:</span> <span className="text-slate-700">{new Date(detailWo.startedAt).toLocaleString()}</span></div>}
                  {detailWo.completedAt && <div><span className="text-slate-400">Completed:</span> <span className="text-slate-700">{new Date(detailWo.completedAt).toLocaleString()}</span></div>}
                  {detailWo.createdBy && <div><span className="text-slate-400">Created by:</span> <span className="text-slate-700">{detailWo.createdBy}</span></div>}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-3">Activity Log</label>
                {detailLoading ? (
                  <p className="text-[13px] text-slate-400">Loading...</p>
                ) : detailLogs.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic">No activity recorded</p>
                ) : (
                  <div className="space-y-3">
                    {detailLogs.map((log) => (
                      <div key={log.id} className="flex gap-3 text-[13px]">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-700 capitalize">{log.action.replace("_", " ")}</p>
                          {log.notes && <p className="text-slate-500 mt-0.5">{log.notes}</p>}
                          <p className="text-slate-400 text-[12px] mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Work Order Modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[18px] font-semibold text-slate-900">New Work Order</h3>
              <button onClick={() => setShowNewForm(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[13px] font-medium text-slate-700">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g. Replace AHU filter" />
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-700">Asset</label>
                <select value={form.assetId} onChange={(e) => setForm((p) => ({ ...p, assetId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                  <option value="">— Select asset —</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-700">Priority</label>
                <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as NewWOForm["priority"] }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-700">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
                  placeholder="Optional description" />
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setShowNewForm(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleCreate} disabled={submitting || !form.title.trim()}
                  className="rounded-xl bg-[#355fe5] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#2a4fc7] disabled:opacity-50">
                  {submitting ? "Creating..." : "Create Work Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
