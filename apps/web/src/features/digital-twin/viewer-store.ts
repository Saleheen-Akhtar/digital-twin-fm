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
import type { Alert } from "@digital-twin-fm/types";

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
  /** Asset IDs that currently have active alerts (for alert overlays) */
  activeAlertAssets: Set<string>;
  /** Live alerts pushed by the realtime WebSocket (not yet in the paginated /alerts fetch) */
  liveAlerts: Alert[];
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
  /** Mark an asset as having an active alert */
  addAlertAsset: (assetId: string) => void;
  /** Remove an asset from the alert set (when alert is resolved) */
  removeAlertAsset: (assetId: string) => void;
  /** Add a live alert received over the WebSocket */
  addLiveAlert: (alert: Alert) => void;
  /** Remove a live alert (e.g. when resolved/closed) */
  removeLiveAlert: (id: string) => void;
}

export const useViewerStore = create<ViewerStore>((set) => ({
  selectedFloor: "ALL",
  selectedType: "ALL",
  selectedAsset: null,
  assetStatuses: {},
  wsConnected: false,
  activeAlertAssets: new Set<string>(),
  liveAlerts: [],
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
  addAlertAsset: (assetId) =>
    set((s) => {
      const next = new Set(s.activeAlertAssets);
      next.add(assetId);
      return { activeAlertAssets: next };
    }),
  removeAlertAsset: (assetId) =>
    set((s) => {
      const next = new Set(s.activeAlertAssets);
      next.delete(assetId);
      return { activeAlertAssets: next };
    }),
  addLiveAlert: (alert) =>
    set((s) => {
      if (s.liveAlerts.some((a) => a.id === alert.id)) return s;
      return { liveAlerts: [alert, ...s.liveAlerts] };
    }),
  removeLiveAlert: (id) =>
    set((s) => ({ liveAlerts: s.liveAlerts.filter((a) => a.id !== id) })),
}));

export { type AssetStatus, type AssetType };
