"use client";

import { useState } from "react";
import Link from "next/link";
import { DigitalTwinPanel } from "@/features/digital-twin/panel";
import { AssetDetailPanel } from "@/features/digital-twin/asset-detail-panel";
import type { Asset } from "@/lib/api-client";

interface DigitalTwinClientProps {
  initialAssets: Asset[];
  initialError: string | null;
}

/**
 * Client-only wrapper that handles selection state. The server component
 * (page.tsx) is the one that calls the api-gateway with the verified access
 * token. This component just receives the data and manages the UI.
 */
export function DigitalTwinClient({ initialAssets, initialError }: DigitalTwinClientProps) {
  const [assets] = useState<Asset[]>(initialAssets);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedAsset = selectedId ? assets.find((a) => a.id === selectedId) ?? null : null;

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Digital Twin Viewer</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Live 3D facility model. Markers colored by status, sized by type.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded px-3 py-1.5"
        >
          ← Dashboard
        </Link>
      </header>

      {initialError ? (
        <div className="border border-red-800 bg-red-950/30 rounded-lg p-4 text-red-300" data-testid="twin-error">
          <strong>Could not load assets:</strong> {initialError}
        </div>
      ) : assets.length === 0 ? (
        <div className="border border-neutral-800 rounded-lg p-8 text-center text-neutral-500">
          No assets found. Run <code className="bg-neutral-800 px-1 rounded">pnpm --filter @digital-twin-fm/db seed</code> to populate the database.
        </div>
      ) : (
        <DigitalTwinPanel
          assets={assets}
          selectedId={selectedId}
          onSelectAsset={setSelectedId}
        />
      )}

      {selectedAsset && (
        <AssetDetailPanel asset={selectedAsset} onClose={() => setSelectedId(null)} />
      )}
    </main>
  );
}
