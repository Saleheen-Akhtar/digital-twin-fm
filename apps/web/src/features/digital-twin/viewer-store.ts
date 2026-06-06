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
 */
import { create } from "zustand";
import type { Asset, AssetStatus, AssetType } from "./viewer-data";

export type FloorFilter = "ALL" | 0 | 1 | 2 | 3;
export type TypeFilter = "ALL" | AssetType;

export interface ViewerStore {
  selectedFloor: FloorFilter;
  selectedType: TypeFilter;
  selectedAsset: Asset | null;
  setSelectedFloor: (f: FloorFilter) => void;
  setSelectedType: (t: TypeFilter) => void;
  setSelectedAsset: (a: Asset | null) => void;
  resetAssetSelection: () => void;
}

export const useViewerStore = create<ViewerStore>((set) => ({
  selectedFloor: "ALL",
  selectedType: "ALL",
  selectedAsset: null,
  setSelectedFloor: (f) => set({ selectedFloor: f }),
  setSelectedType: (t) => set({ selectedType: t }),
  setSelectedAsset: (a) => set({ selectedAsset: a }),
  resetAssetSelection: () => set({ selectedAsset: null }),
}));

export { type AssetStatus, type AssetType };
