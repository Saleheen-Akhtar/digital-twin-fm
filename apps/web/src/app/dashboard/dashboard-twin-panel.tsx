"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DigitalTwinPanel } from "@/features/digital-twin/panel";
import type { Asset } from "@/lib/api-client";

type LevelRow = { name: string; status: "ok" | "critical" };

type FocusAlert = {
  title: string;
  asset: string;
  severity: string;
  value: string;
  tone: "text-emerald-500" | "text-orange-500" | "text-blue-500" | "text-violet-500" | "text-red-500";
} | null;

export interface DashboardTwinPanelProps {
  buildingName: string;
  levels: LevelRow[];
  assets: Asset[];
  alert: FocusAlert;
  assetReadingsById?: Record<string, string>;
  assetsError?: { status: 'error'; code: string; message: string } | null;
}

function assetFloor(asset: Asset, fallback = 1) {
  return asset.floorLevel ?? fallback;
}

function floorLabel(level: LevelRow, index: number) {
  return level.name || `Level ${index + 1}`;
}

export function DashboardTwinPanel({
  buildingName,
  levels,
  assets,
  alert,
  assetReadingsById,
  assetsError,
}: DashboardTwinPanelProps) {
  const floorLevels = levels.length > 0 ? levels : [];

  const [selectedFloor, setSelectedFloor] = useState<number>(() => {
    const criticalIndex = floorLevels.findIndex((level) => level.status === "critical");
    const firstAssetFloor = assets.length ? assetFloor(assets[0]) : 1;
    return criticalIndex >= 0 ? criticalIndex + 1 : firstAssetFloor;
  });
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(() => {
    const floorAsset = assets.find((asset) => assetFloor(asset) === selectedFloor);
    return floorAsset?.id ?? assets[0]?.id ?? null;
  });

  const selectedAsset = selectedAssetId ? assets.find((asset) => asset.id === selectedAssetId) ?? null : null;
  const selectedFloorAssets = assets.filter((asset) => assetFloor(asset) === selectedFloor);

  useEffect(() => {
    if (!assets.length) return;
    const assetOnFloor = assets.find((asset) => assetFloor(asset) === selectedFloor);
    if (selectedAssetId && selectedFloorAssets.some((asset) => asset.id === selectedAssetId)) {
      return;
    }
    setSelectedAssetId(assetOnFloor?.id ?? assets[0]?.id ?? null);
  }, [assets, selectedAssetId, selectedFloor, selectedFloorAssets]);

  useEffect(() => {
    if (!selectedAsset) return;
    const nextFloor = assetFloor(selectedAsset);
    if (nextFloor !== selectedFloor) {
      setSelectedFloor(nextFloor);
    }
  }, [selectedAsset, selectedFloor]);

  return (
    <section className="xl:col-span-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-medium tracking-[-0.03em] text-slate-950">Digital Twin & Levels</h2>
          <p className="text-[13px] text-slate-500">
            {buildingName} · {assets.length} assets · click a floor or a marker
          </p>
        </div>
        <Link
          href="/twin"
          className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-[#1d4ed8] shadow-sm transition hover:bg-slate-50"
        >
          3D View
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[150px_minmax(0,1fr)]">
        <div className="rounded-[20px] border border-slate-200 bg-[#fafbff] p-2">
          <div className="rounded-[16px] bg-white px-3 py-3 text-[13px] text-slate-600 shadow-sm">
            {buildingName}
          </div>
          <div className="mt-2 space-y-1">
            {floorLevels.map((level, index) => {
              const floor = Number(level.name.replace(/\D/g, '')) || index + 1;
              const isSelected = selectedFloor === floor;
              const count = assets.filter((asset) => assetFloor(asset) === floor).length;
              const hasCritical = assets.some((asset) => assetFloor(asset) === floor && asset.status === "critical");

              return (
                <button
                  key={level.name}
                  type="button"
                  onClick={() => setSelectedFloor(floor)}
                  className={[
                    "flex w-full items-center justify-between rounded-2xl px-3 py-3 text-[13px] transition",
                    isSelected ? "bg-[#edf3ff] text-[#1d4ed8]" : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <span>{floorLabel(level, index)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">{count}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${hasCritical ? "bg-rose-500" : "bg-emerald-500"}`} />
                  </span>
                </button>
              );
            })}
            <div className="rounded-2xl px-3 py-3 text-[13px] text-slate-400">
              Roof
              <span className="ml-2 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 align-middle" />
            </div>
          </div>

          <div className="mt-3 rounded-[16px] border border-slate-200 bg-white px-3 py-3 text-[12px] text-slate-500 shadow-sm">
            <div className="flex items-center justify-between">
              <span>Selected floor</span>
              <span className="font-medium text-slate-900">Level {selectedFloor}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Assets on floor</span>
              <span className="font-medium text-slate-900">{selectedFloorAssets.length}</span>
            </div>
            {alert ? (
              <div className="mt-3 rounded-2xl bg-[#fff7f7] px-3 py-2 text-[12px] text-slate-700">
                <div className="font-medium text-slate-900">{alert.title}</div>
                <div className="mt-1 text-slate-500">
                  {alert.asset} · {alert.value}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          {assetsError ? (
            <div
              role="alert"
              data-testid="panel-error-assets-twin"
              className="rounded-[18px] border border-red-100 bg-red-50/70 px-4 py-3 text-[13px] text-red-800"
            >
              Could not load assets: {assetsError.message}
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-8 text-center text-[14px] text-slate-500">
              No assets found. Run the simulator after seeding the database.
            </div>
          ) : (
            <DigitalTwinPanel
            assets={assets}
            selectedId={selectedAssetId}
            onSelectAsset={(id) => {
              setSelectedAssetId(id);
              const nextAsset = assets.find((asset) => asset.id === id);
              if (nextAsset) {
                setSelectedFloor(assetFloor(nextAsset));
              }
            }}
            showHeader={false}
            assetReadingsById={assetReadingsById}
          />
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[18px] border border-slate-200 bg-[#fbfcff] p-3">
              <div className="text-[12px] uppercase tracking-[0.2em] text-slate-400">Floor status</div>
              <div className="mt-2 text-[18px] font-medium tracking-[-0.03em] text-slate-950">
                {floorLevels[selectedFloor - 1]?.name ?? `Level ${selectedFloor}`}
              </div>
              <div className="mt-1 text-[13px] text-slate-500">
                {selectedFloorAssets.length} assets on the active floor, click markers to inspect.
              </div>
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-[#fbfcff] p-3">
              <div className="text-[12px] uppercase tracking-[0.2em] text-slate-400">Selected asset</div>
              {selectedAsset ? (
                <>
                  <div className="mt-2 text-[18px] font-medium tracking-[-0.03em] text-slate-950">
                    {selectedAsset.name}
                  </div>
                  <div className="mt-1 text-[13px] text-slate-500">
                    {selectedAsset.type.replace(/_/g, " ")} · {selectedAsset.status} · Level{" "}
                    {assetFloor(selectedAsset)}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-[13px] text-slate-500">No asset selected yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
