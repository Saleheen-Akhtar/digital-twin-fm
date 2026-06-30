"use client";

import { useState } from "react";
import { DigitalTwinPanel } from "@/features/digital-twin/panel";
import { AssetDetailPanel } from "@/features/digital-twin/asset-detail-panel";
import type { Asset } from "@/lib/api-client";

interface DigitalTwinClientProps {
  initialAssets: Asset[];
  initialError: string | null;
  modelUrl?: string;
}

export function DigitalTwinClient({ initialAssets, initialError, modelUrl }: DigitalTwinClientProps) {
  const [assets] = useState<Asset[]>(initialAssets);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  const selectedAsset = selectedId ? assets.find((a) => a.id === selectedId) ?? null : null;

  return (
    <div className="flex-1 px-3 pb-4 pt-5 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-4">
        <section className="flex items-center justify-between px-2 sm:px-1">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
              Digital Twin
            </h1>
            <p className="mt-1 text-[15px] text-slate-500">
              Live 3D facility model. Markers colored by status, sized by type.
            </p>
          </div>
          <button
            onClick={() => setShowSidebar((s) => !s)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50"
          >
            {showSidebar ? "Hide Panel" : "Show Panel"}
          </button>
        </section>

        {initialError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
            <strong>Could not load assets:</strong> {initialError}
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-[15px] text-slate-500">
            No assets found. Run <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-700">pnpm --filter @digital-twin-fm/db seed</code> to populate the database.
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#0a0e1a] shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
            <DigitalTwinPanel
              assets={assets}
              selectedId={selectedId}
              onSelectAsset={setSelectedId}
              showHeader={false}
              modelUrl={modelUrl}
            />
          </div>
        )}

        {selectedAsset && (
          <AssetDetailPanel asset={selectedAsset} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  );
}
