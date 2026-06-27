/**
 * Digital Twin FM — viewer state store (Zustand)
 *
 * Holds the UI state shared between the Three.js scene and the overlay
 * panels (FloorSelector, StatusPanel, InspectPanel, TypeLegend).
 *
 * The scene reads `selectedFloor` and `selectedType` to toggle group
 * visibility and re-center the camera. The inspect panel reads/writes
 * `selectedAsset`. The status panel derives counts from the seed data
 * filtered by the current floor + type selection.
 *
 * `assetStatuses` holds live status overrides pushed by the realtime
 * WebSocket hook. When non-empty, the viewer reads from this map
 * instead of the static SEED_ASSETS status.
 */
import { create } from "zustand";
import type { Asset, AssetStatus, AssetType } from "./viewer-data";

/**
 * Floor filter — 0-indexed viewer floors.
 *
 * DYNAMIC: the type is `number` (not a 0|1|2|3 union) so a customer
 * building with 5, 10, or 20 floors renders without code changes.
 * The floor selector buttons are generated from the API / BUILDING_FLOORS
 * at runtime, not from this type. The viewer-store only constrains the
 * special "ALL" sentinel; valid floor indices are validated against
 * `tokens.building.floorCount` at the UI boundary.
 *
 * Drift between the API/seed floor count and the design-token floor count
 * surfaces as a console warning via the runtime invariant in
 * viewer-data.ts / viewer-building.tsx.
 */
export type FloorFilter = "ALL" | number;
export type TypeFilter = "ALL" | AssetType;

export interface ViewerStore {
  selectedFloor: FloorFilter;
  selectedType: TypeFilter;
  selectedAsset: Asset | null;
  /** Live asset status overrides keyed by asset.id */
  assetStatuses: Record<string, AssetStatus>;
  /** Connection state for the WebSocket */
  wsConnected: boolean;
  setSelectedFloor: (f: FloorFilter) => void;
  setSelectedType: (t: TypeFilter) => void;
  setSelectedAsset: (a: Asset | null) => void;
  resetAssetSelection: () => void;
  /** Update a single asset's live status */
  setAssetStatus: (assetId: string, status: AssetStatus) => void;
  /** Bulk replace live statuses (from realtime batch) */
  bulkSetAssetStatuses: (updates: Record<string, AssetStatus>) => void;
  /** Set WebSocket connection state */
  setWsConnected: (connected: boolean) => void;
}

export const useViewerStore = create<ViewerStore>((set) => ({
  selectedFloor: "ALL",
  selectedType: "ALL",
  selectedAsset: null,
  assetStatuses: {},
  wsConnected: false,
  setSelectedFloor: (f) => set({ selectedFloor: f }),
  setSelectedType: (t) => set({ selectedType: t }),
  setSelectedAsset: (a) => set({ selectedAsset: a }),
  resetAssetSelection: () => set({ selectedAsset: null }),
  setAssetStatus: (assetId, status) =>
    set((s) => ({
      assetStatuses: { ...s.assetStatuses, [assetId]: status },
    })),
  bulkSetAssetStatuses: (updates) =>
    set((s) => ({
      assetStatuses: { ...s.assetStatuses, ...updates },
    })),
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));

export { type AssetStatus, type AssetType };
