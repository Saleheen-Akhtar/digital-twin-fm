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
    <main
      className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto"
      style={{ background: "#0a0e1a" }}
    >
      <header
        className="mb-6 flex items-start justify-between p-4"
        style={{
          background: "rgba(10,14,26,0.92)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "1rem",
          backdropFilter: "blur(8px)",
        }}
      >
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ color: "#f1f5f9" }}
          >
            Digital Twin Viewer
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "#94a3b8" }}
          >
            Live 3D facility model. Markers colored by status, sized by type.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-semibold px-3 py-1.5 transition-colors"
          style={{
            color: "#f1f5f9",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "0.75rem",
          }}
        >
          ← Dashboard
        </Link>
      </header>

      {initialError ? (
        <div
          className="p-4"
          style={{
            background: "rgba(10,14,26,0.92)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "1rem",
            color: "#fca5a5",
          }}
          data-testid="twin-error"
        >
          <strong>Could not load assets:</strong> {initialError}
        </div>
      ) : assets.length === 0 ? (
        <div
          className="p-8 text-center"
          style={{
            background: "rgba(10,14,26,0.92)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "1rem",
            color: "#94a3b8",
          }}
        >
          No assets found. Run{" "}
          <code
            className="px-1"
            style={{
              background: "rgba(255,255,255,0.08)",
              borderRadius: "0.25rem",
              color: "#f1f5f9",
            }}
          >
            pnpm --filter @digital-twin-fm/db seed
          </code>{" "}
          to populate the database.
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
