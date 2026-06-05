"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DigitalTwinPanel } from "@/features/digital-twin/panel";
import { AssetDetailPanel } from "@/features/digital-twin/asset-detail-panel";
import { createApiClient, type Asset } from "@/lib/api-client";

export default function DigitalTwinPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Browser-side: gateway is on the same host but different port
        const apiUrl = window.location.origin.replace(/:3000$/, ":4000");
        const api = createApiClient({ baseUrl: apiUrl });
        const data = await api.findAssets();
        setAssets(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load assets");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

      {loading ? (
        <div className="border border-neutral-800 rounded-lg p-8 text-center text-neutral-500">
          Loading assets from API…
        </div>
      ) : error ? (
        <div className="border border-red-800 bg-red-950/30 rounded-lg p-4 text-red-300">
          <strong>Could not load assets:</strong> {error}
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
