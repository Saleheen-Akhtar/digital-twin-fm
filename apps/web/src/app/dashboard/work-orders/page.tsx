"use client";

import { useEffect, useState } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import type { WorkOrder } from "@/lib/api-client";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-blue-400",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = createBrowserApiClient();

    async function fetch() {
      try {
        const data = await api.get<WorkOrder[]>("/work-orders");
        if (!cancelled) {
          setOrders(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load work orders");
          setLoading(false);
        }
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex-1 px-3 pb-4 pt-5 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-4">
        <section className="flex items-center justify-between px-2 sm:px-1">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Work Orders</h1>
            <p className="mt-1 text-[15px] text-slate-500">
              {loading ? "Loading..." : `${orders.length} work orders`}
            </p>
          </div>
          <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50">
            + New Work Order
          </button>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[15px] text-slate-400">Loading work orders...</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-[15px] text-slate-500">
            <p>No work orders found</p>
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
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((wo) => (
                  <tr key={wo.id} className="border-b border-slate-50 text-[14px] last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${PRIORITY_COLORS[wo.priority] ?? "bg-slate-300"}`} />
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">{wo.title}</td>
                    <td className="px-5 py-3 text-slate-500">{wo.type}</td>
                    <td className="px-5 py-3 font-mono text-[13px] text-slate-500">{wo.assetId?.slice(0, 12)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                        STATUS_COLORS[wo.status] ?? "bg-slate-100 text-slate-600"
                      }`}>{wo.status.replace("_", " ")}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {wo.createdAt
                        ? new Date(wo.createdAt).toLocaleString("en-SG", {
                            hour: "2-digit", minute: "2-digit",
                            day: "numeric", month: "short",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
