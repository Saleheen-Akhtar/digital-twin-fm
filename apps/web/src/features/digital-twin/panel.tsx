"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Asset, Sensor } from "@digital-twin-fm/types";
import { createBrowserApiClient } from "@/lib/browser-api-client";

// Raw Three.js (WebGL) — must be client-only. No SSR.
const Viewer = dynamic(
  () => import("./viewer-3d").then((m) => m.DigitalTwinViewer3D),
  {
    ssr: false,
    loading: () => (
      <div
        data-testid="digital-twin-loading"
        className="w-full h-[640px] rounded-lg flex items-center justify-center text-white/50"
        style={{ background: "#0a0e1a" }}
      >
        Loading 3D viewer…
      </div>
    ),
  },
);

export interface DigitalTwinPanelProps {
  assets: Asset[];
  selectedId?: string | null;
  onSelectAsset?: (id: string) => void;
  showHeader?: boolean;
  assetReadingsById?: Record<string, string>;
}

export function DigitalTwinPanel({
  assets,
  selectedId: _selectedId,
  onSelectAsset: _onSelectAsset,
  showHeader = true,
  assetReadingsById: _assetReadingsById,
}: DigitalTwinPanelProps) {
  // The new viewer manages its own state and seed data internally.
  // The props above are kept for API compatibility with the dashboard
  // and the asset-detail panel, but the viewer reads from its own
  // SEED_ASSETS / Zustand store.
  const [_liveReadings, setLiveReadings] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function refreshReadings() {
      try {
        const api = createBrowserApiClient();
        const sensors = await api.get<Sensor[]>("/sensors");
        if (cancelled) return;
        setLiveReadings((current) => ({
          ...current,
          ...readingsByAssetId(sensors),
        }));
      } catch {
        // Keep server-rendered readings when browser refresh is unavailable.
      }
    }

    void refreshReadings();
    const timer = window.setInterval(refreshReadings, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="space-y-3">
      {showHeader ? (
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Digital Twin</h2>
            <p className="text-sm text-slate-500">
              {assets.length} {assets.length === 1 ? "asset" : "assets"} ·{" "}
              click a marker to inspect
            </p>
          </div>
        </header>
      ) : null}
      <Viewer />
    </section>
  );
}

function readingsByAssetId(sensors: Sensor[]) {
  return sensors.reduce<Record<string, string>>((acc, sensor) => {
    if (sensor.lastValue == null) return acc;
    if (acc[sensor.assetId]) return acc;
    acc[sensor.assetId] = formatSensorValue(sensor);
    return acc;
  }, {});
}

function formatSensorValue(sensor: Sensor) {
  const value = sensor.lastValue ?? 0;
  if (sensor.type === "temperature") return `${value.toFixed(1)}${sensor.unit}`;
  if (sensor.unit === "%" || sensor.unit.startsWith("\u00B0")) return `${value.toFixed(0)}${sensor.unit}`;
  return `${value.toFixed(0)} ${sensor.unit}`.trim();
}
