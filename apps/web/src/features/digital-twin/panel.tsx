"use client";

import dynamic from "next/dynamic";
import type { Asset } from "@digital-twin-fm/types";

// R3F can't SSR (uses WebGL). Load only on client.
const Viewer = dynamic(
  () => import("./viewer").then((m) => m.DigitalTwinViewer),
  {
    ssr: false,
    loading: () => (
      <div
        data-testid="digital-twin-loading"
        className="w-full h-[640px] bg-neutral-900 rounded-lg flex items-center justify-center text-neutral-500"
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
}

export function DigitalTwinPanel({
  assets,
  selectedId,
  onSelectAsset,
}: DigitalTwinPanelProps) {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Digital Twin</h2>
          <p className="text-sm text-neutral-500">
            {assets.length} {assets.length === 1 ? "asset" : "assets"} ·{" "}
            click a marker to inspect
          </p>
        </div>
      </header>
      <Viewer assets={assets} selectedId={selectedId} onSelectAsset={onSelectAsset} />
    </section>
  );
}
