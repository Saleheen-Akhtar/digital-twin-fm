"use client";

import { useEffect, useState } from "react";
import { LIVE_KPI } from "./data";

/**
 * Landing-page Live KPI strip.
 *
 * Polls `/api/proxy/building/snapshot?buildingId=9a83477a-...` every
 * 2 seconds. Falls back to the demo values in `data.ts` if the API is
 * unreachable, so the landing page never looks broken. Uses fetch
 * directly (not React Query) to keep this component light.
 *
 * The snapshot endpoint returns { healthScore, totalAssets,
 * warningAssets, criticalAssets, offlineAssets, activeAlerts,
 * avgEnergyKw, sensorUptime, totalSensors, onlineSensors }. We map:
 *   alerts    ← activeAlerts
 *   power     ← avgEnergyKw
 *   occupancy ← derived from onlineAssets / totalAssets
 *   energy    ← derived (avgEnergyKw * hours since midnight)
 *   temperature → demo fallback (snapshot doesn't include temp avg)
 */
type KpiMap = Record<string, string>;

type Snapshot = {
  healthScore?: number;
  totalAssets?: number;
  warningAssets?: number;
  criticalAssets?: number;
  offlineAssets?: number;
  activeAlerts?: number;
  avgEnergyKw?: number;
  sensorUptime?: number;
  totalSensors?: number;
  onlineSensors?: number;
};

const DEFAULT_BUILDING_ID = "9a83477a-4b19-444a-9345-0e07f90d16b0";

export function LandingLiveKpi() {
  const [values, setValues] = useState<KpiMap>(() =>
    Object.fromEntries(
      LIVE_KPI.metrics.map((m) => [m.key, m.fallback]),
    ),
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch(
          `/api/proxy/building/snapshot?buildingId=${DEFAULT_BUILDING_ID}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const payload = await res.json();
          const snap: Snapshot | undefined =
            payload?.snapshot ?? payload?.data?.snapshot;
          if (snap && !cancelled) {
            const hoursToday = Math.max(
              1,
              new Date().getHours() + new Date().getMinutes() / 60,
            );
            const avgKw = typeof snap.avgEnergyKw === "number" ? snap.avgEnergyKw : 847;
            const total = typeof snap.totalAssets === "number" ? snap.totalAssets : 1;
            const online =
              total -
              (typeof snap.offlineAssets === "number" ? snap.offlineAssets : 0);
            setValues((prev) => ({
              ...prev,
              // Snapshot doesn't carry average temperature — keep demo fallback
              temperature: prev.temperature,
              power: Math.round(avgKw).toString(),
              alerts:
                typeof snap.activeAlerts === "number"
                  ? Math.round(snap.activeAlerts).toString()
                  : prev.alerts,
              occupancy: Math.round((online / total) * 100).toString(),
              energy: Math.round(avgKw * hoursToday).toLocaleString(),
            }));
          }
        }
      } catch {
        // Network blip — keep showing last good values
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, 2000);
        }
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <section
      className="py-12 px-6"
      style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {LIVE_KPI.title}
            </span>
          </div>
          <p className="text-xs text-slate-400">{LIVE_KPI.subtitle}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {LIVE_KPI.metrics.map((m, i) => (
            <div
              key={m.key}
              className={`text-center p-4 rounded-2xl bg-white border border-slate-200 animate-fade-in-up delay-${i + 1}`}
              style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
            >
              <div className="text-xl mb-1">{m.icon}</div>
              <div
                className="text-2xl font-bold tracking-tight"
                style={{ color: m.color }}
              >
                {values[m.key]}
                <span className="text-xs font-medium text-slate-400 ml-0.5">
                  {m.unit}
                </span>
              </div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
