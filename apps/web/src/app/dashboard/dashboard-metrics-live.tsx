'use client';

import { useEffect, useState } from 'react';
import { createBrowserApiClient } from '@/lib/browser-api-client';
import {
  buildMetrics,
  type BuildingSnapshot,
  type MetricCardData,
  type SnapshotHistoryEntry,
} from './dashboard-model';
import type { Alert, Asset, WorkOrder } from '@/lib/api-client';

function MiniSparkline({ data }: { data: number[] }) {
  const w = 60;
  const h = 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2)}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke="#355fe5"
        strokeWidth="2"
        className="transition-all duration-800 ease-in-out"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  tone,
  sub,
  spark,
}: MetricCardData & { icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-slate-500">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className={`text-[28px] font-semibold tracking-[-0.03em] ${tone}`} style={{ lineHeight: 1 }}>
          {value}
        </span>
        <MiniSparkline data={spark} />
      </div>
      <span className="text-[13px] text-slate-500">{sub}</span>
    </div>
  );
}

export function DashboardMetricsLive({
  buildingId,
  initialMetrics,
  initialSnapshot,
  initialHistory,
  assets,
  alerts,
  workOrders,
}: {
  buildingId: string;
  initialMetrics: MetricCardData[];
  initialSnapshot: BuildingSnapshot | null;
  initialHistory: SnapshotHistoryEntry[];
  assets: Asset[];
  alerts: Alert[];
  workOrders: WorkOrder[];
}) {
  const [metrics, setMetrics] = useState(initialMetrics);

  useEffect(() => {
    setMetrics(initialMetrics);
  }, [initialMetrics]);

  useEffect(() => {
    let cancelled = false;
    const api = createBrowserApiClient();

    async function refresh() {
      try {
        const [snapRes, histRes, alertsRes, woRes] = await Promise.all([
          api.get<{ found: boolean; snapshot?: BuildingSnapshot }>(
            `/building/snapshot?buildingId=${encodeURIComponent(buildingId)}`,
          ),
          api.get<{ history: SnapshotHistoryEntry[] }>(
            `/building/snapshot/history?buildingId=${encodeURIComponent(buildingId)}&hours=24`,
          ),
          api.get<Alert[]>('/alerts'),
          api.get<WorkOrder[]>('/work-orders'),
        ]);
        if (cancelled) return;
        const snapshot = snapRes.found ? snapRes.snapshot ?? null : initialSnapshot;
        const history = histRes.history ?? initialHistory;
        setMetrics(
          buildMetrics({
            snapshot,
            history,
            assets,
            alerts: Array.isArray(alertsRes) ? alertsRes : alerts,
            workOrders: Array.isArray(woRes) ? woRes : workOrders,
          }),
        );
      } catch {
        // Keep last good metrics on transient failures
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [buildingId, assets, alerts, workOrders, initialSnapshot, initialHistory]);

  return (
    <>
      {metrics.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </>
  );
}
