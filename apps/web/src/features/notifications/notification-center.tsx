"use client";

/**
 * Digital Twin FM — Notification Center & Top Header
 *
 * Provides RealtimeNotificationToast and DashboardTopHeader components
 * for real-time alert popups, system connection status, and bell notifications.
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, CheckCircle2, ShieldAlert, X, Search } from "lucide-react";
import { useViewerStore } from "@/features/digital-twin/viewer-store";
import { useRealtime } from "@/hooks/useRealtime";

// ─── Realtime Notification Toast Component ──────────────────────────

export function RealtimeNotificationToast() {
  const [toast, setToast] = useState<{ id: string; title: string; message: string; type: "critical" | "warning" | "info" } | null>(null);
  const selectedAsset = useViewerStore((state) => state.selectedAsset);

  useEffect(() => {
    if (!selectedAsset) return;
    if (selectedAsset.status === "critical" || selectedAsset.status === "warning") {
      setToast({
        id: selectedAsset.id,
        title: `${selectedAsset.name} Alert`,
        message: `Asset status changed to ${selectedAsset.status.toUpperCase()}. Action recommended.`,
        type: selectedAsset.status === "critical" ? "critical" : "warning",
      });
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [selectedAsset]);

  if (!toast) return null;

  const bgColor = toast.type === "critical" ? "bg-red-950/90 border-red-500/40 text-red-200" : "bg-amber-950/90 border-amber-500/40 text-amber-200";

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-lg shadow-2xl transition-all animate-bounce ${bgColor}`}>
      {toast.type === "critical" ? (
        <ShieldAlert size={20} className="text-red-400 flex-shrink-0 animate-pulse" />
      ) : (
        <AlertTriangle size={20} className="text-amber-400 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-[200px]">
        <div className="text-xs font-bold">{toast.title}</div>
        <div className="text-[11px] opacity-90">{toast.message}</div>
      </div>
      <button onClick={() => setToast(null)} className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Dashboard Top Header Component ─────────────────────────────────

export function DashboardTopHeader() {
  const [bellOpen, setBellOpen] = useState(false);
  const { connected } = useRealtime();

  const notifications = [
    { id: "1", title: "AHU-001 High Temp", time: "2m ago", read: false, type: "warning" },
    { id: "2", title: "Chiller 1 Pressure Anomaly", time: "12m ago", read: false, type: "critical" },
    { id: "3", title: "Scheduled Maintenance Completed", time: "1h ago", read: true, type: "info" },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="hidden lg:flex items-center justify-between h-14 px-6 bg-white border-b border-slate-200">
      {/* Search & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search assets, zones, equipment..."
            className="pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 transition-all"
          />
        </div>
      </div>

      {/* Right controls: System status + Bell */}
      <div className="flex items-center gap-4">
        {/* Real-time Connection Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 border border-slate-200">
          {connected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-slate-700">Live IoT Sync</span>
            </>
          ) : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
              <span className="text-slate-500">Telemetry Offline</span>
            </>
          )}
        </div>

        {/* Bell Button + Dropdown */}
        <div className="relative">
          <button
            onClick={() => setBellOpen((b) => !b)}
            className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all"
            aria-label="Open notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Notifications</span>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{unreadCount} new</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {notifications.map((n) => (
                  <div key={n.id} className="px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${n.type === "critical" ? "text-red-600" : n.type === "warning" ? "text-amber-600" : "text-slate-800"}`}>
                        {n.title}
                      </span>
                      <span className="text-[10px] text-slate-400">{n.time}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/dashboard/alerts"
                onClick={() => setBellOpen(false)}
                className="block text-center py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-t border-slate-100 transition-colors"
              >
                View all alerts
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
