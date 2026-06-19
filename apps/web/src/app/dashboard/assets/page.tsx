"use client";

import { useEffect, useState } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import type { Asset } from "@/lib/api-client";

const STATUS_COLORS: Record<string, string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-400",
  offline: "bg-slate-300",
  info: "bg-blue-400",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = createBrowserApiClient();

    async function fetch() {
      try {
        const data = await api.get<Asset[]>("/assets");
        if (!cancelled) {
          setAssets(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load assets");
          setLoading(false);
        }
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  const counts = {
    total: assets.length,
    ok: assets.filter((a) => a.status === "ok").length,
    warning: assets.filter((a) => a.status === "warning").length,
    offline: assets.filter((a) => a.status === "offline").length,
    info: assets.filter((a) => a.status === "info").length,
  };

  return (
    <div className="flex-1 px-3 pb-4 pt-5 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-4">
        <section className="px-2 sm:px-1">
          <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-slate-950">Assets</h1>
          <p className="mt-1 text-[15px] text-slate-500">
            {loading ? "Loading..." : `${assets.length} registered assets`}
          </p>
        </section>

        {/* Summary Cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Online", value: counts.ok, color: "text-emerald-600" },
              { label: "Warning", value: counts.warning, color: "text-amber-600" },
              { label: "Offline", value: counts.offline, color: "text-slate-500" },
              { label: "Info", value: counts.info, color: "text-blue-600" },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                <div className={`text-[24px] font-semibold ${card.color}`}>{card.value}</div>
                <div className="mt-1 text-[13px] text-slate-500">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[15px] text-slate-400">Loading assets...</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[13px] text-slate-500">
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Asset</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Zone</th>
                  <th className="px-5 py-3 font-medium">Sensors</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b border-slate-50 text-[14px] last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLORS[asset.status] ?? "bg-slate-300"}`} />
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">{asset.name}</td>
                    <td className="px-5 py-3 text-slate-500">{asset.type}</td>
                    <td className="px-5 py-3 text-slate-500">{asset.floorId ?? asset.roomId ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-500">—</td>
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
