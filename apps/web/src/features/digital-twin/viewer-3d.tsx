"use client";

/**
 * Digital Twin FM — R3F 3D Viewer
 *
 * Complete rewrite using @react-three/fiber. Provides:
 *   - Procedural convention centre with 3 navigable floors
 *   - Floor-level isolation (show/hide individual floors)
 *   - Clickable zones within each floor
 *   - Orbit mode (default) / Walk mode (first-person fly-through)
 *   - Type-specific asset markers with status colours
 *
 * Exports DigitalTwinViewer3D — same interface as the old raw Three.js
 * component so panel.tsx and landing-hero.tsx work without changes.
 */

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type FC,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  CameraControls,
  Html,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { useViewerStore } from "./viewer-store";
import {
  colors,
  building as B,
  camera as CAM,
  light as LIGHT,
  fog as FOG,
} from "@/design-system/tokens";
import {
  Building,
  AssetMarker3D,
  BUILDING_FLOORS,
  type FloorFilter,
} from "./viewer-building";
import type {
  Asset,
  AssetStatus,
  AssetType,
  ApiAssetShape,
} from "./viewer-data";
import { SEED_ASSETS, apiAssetsToViewerAssets } from "./viewer-data";

// ─── Types ─────────────────────────────────────────────────────────

export interface DigitalTwinViewer3DProps {
  /** When false, hides all asset markers (used on homepage). */
  showMarkers?: boolean;
  /** When true, the camera slowly orbits the building. */
  autoRotate?: boolean;
  /** Real assets from the API. When provided, replaces SEED_ASSETS. */
  assets?: ApiAssetShape[];
}

// ─── Camera animator (driven by useFrame) ──────────────────────────

/**
 * Tracks camera animation state for floor transitions.
 * Lives inside Canvas so it can use useFrame and useThree.
 */
function CameraAnimator({
  selectedFloor,
  walkMode,
}: {
  selectedFloor: FloorFilter;
  walkMode: boolean;
}) {
  const { camera, controls } = useThree();
  const prevFloor = useRef<FloorFilter>(selectedFloor);
  const animProgress = useRef(-1); // -1 = not animating

  // Detect floor change
  useEffect(() => {
    if (selectedFloor === prevFloor.current) return;
    prevFloor.current = selectedFloor;
    if (selectedFloor === "ALL") return;
    if (!controls) return;
    // Start animation
    animProgress.current = 0;
  }, [selectedFloor, controls]);

  // Drive animation via useFrame (runs every render frame)
  useFrame(() => {
    if (animProgress.current < 0 || !controls) return;

    const floor = BUILDING_FLOORS.find((f) => f.level === selectedFloor);
    if (!floor) {
      animProgress.current = -1;
      return;
    }

    const targetY = floor.yBase + floor.height / 2;
    const endTarget = new THREE.Vector3(0, targetY, 0);
    const endPos = new THREE.Vector3(20, targetY + 6, 25);

    animProgress.current = Math.min(animProgress.current + 0.03, 1);
    const t = animProgress.current;
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic

    (controls as unknown as OrbitControlsImpl).target.lerp(endTarget, ease);
    camera.position.lerp(endPos, ease);

    if (t >= 1) animProgress.current = -1;
  });

  return null;
}

// ─── Scene content (inside Canvas) ─────────────────────────────────

function SceneContent({
  showMarkers,
  autoRotate,
  allAssets,
  selectedFloor,
  selectedZone,
  onSelectZone,
  walkMode,
}: {
  showMarkers: boolean;
  autoRotate: boolean;
  allAssets: Asset[];
  selectedFloor: FloorFilter;
  selectedZone: string | null;
  onSelectZone: (zoneId: string) => void;
  walkMode: boolean;
}) {
  const orbitControlsRef = useRef<OrbitControlsImpl>(null!);
  const cameraControlsRef = useRef<CameraControls>(null!);

  // ── Lighting / Environment ──
  return (
    <>
      <ambientLight intensity={LIGHT.ambient.intensity} />
      <directionalLight
        position={LIGHT.sun.position}
        intensity={LIGHT.sun.intensity}
        castShadow
        shadow-mapSize-width={LIGHT.shadow.mapSize}
        shadow-mapSize-height={LIGHT.shadow.mapSize}
      />
      <hemisphereLight args={["#e8eef7", "#94a3b8", 0.6]} />

      {/* Fog */}
      <fog attach="fog" args={[FOG.color, FOG.near, FOG.far]} />

      {/* Building */}
      <Building
        selectedFloor={selectedFloor}
        selectedZone={selectedZone}
        onSelectZone={onSelectZone}
        walkMode={walkMode}
      />

      {/* Asset markers (only on visible floors) */}
      {showMarkers &&
        allAssets
          .filter((asset) => {
            if (selectedFloor === "ALL") return true;
            return selectedFloor === (asset.floor as FloorFilter);
          })
          .map((asset) => (
            <AssetMarker3D
              key={asset.id}
              asset={asset}
              selected={false}
              onClick={() => {
                const store = useViewerStore.getState();
                store.setSelectedAsset(asset);
              }}
            />
          ))}

      {/* Camera animation driver */}
      <CameraAnimator
        selectedFloor={selectedFloor}
        walkMode={walkMode}
      />

      {/* Controls */}
      {walkMode ? (
        <CameraControls
          ref={cameraControlsRef}
          minDistance={0.5}
          maxDistance={30}
          dollySpeed={0.3}
          truckSpeed={0.5}
        />
      ) : (
        <OrbitControls
          ref={orbitControlsRef}
          makeDefault
          enableDamping
          dampingFactor={CAM.dampingFactor}
          minDistance={CAM.minDistance}
          maxDistance={CAM.maxDistance}
          minPolarAngle={0}
          maxPolarAngle={Math.PI * 0.85}
          autoRotate={autoRotate}
          autoRotateSpeed={0.5}
        />
      )}
    </>
  );
}

// ─── Main Viewer Component ─────────────────────────────────────────

export function DigitalTwinViewer3D({
  showMarkers = true,
  autoRotate = false,
  assets,
}: DigitalTwinViewer3DProps) {
  const { selectedFloor, setSelectedFloor } = useViewerStore();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [walkMode, setWalkMode] = useState(false);

  // Resolve assets
  const allAssets = useMemo(
    () => (assets ? apiAssetsToViewerAssets(assets) : SEED_ASSETS),
    [assets],
  );

  const handleSelectZone = useCallback((zoneId: string) => {
    setSelectedZone((prev) => (prev === zoneId ? null : zoneId));
  }, []);

  // Find the selected zone's full data
  const selectedZoneData = useMemo(() => {
    if (!selectedZone) return null;
    for (const floor of BUILDING_FLOORS) {
      const zone = floor.zones.find((z) => z.id === selectedZone);
      if (zone) return { zone, floor: floor.name };
    }
    return null;
  }, [selectedZone]);

  return (
    <div
      className="relative w-full h-full min-h-[400px] overflow-hidden rounded-lg"
      data-testid="digital-twin-viewer-3d"
      style={{ background: colors.bg.canvas }}
    >
      <Canvas
        camera={{
          position: CAM.defaultPosition,
          fov: CAM.fov,
          near: CAM.near,
          far: CAM.far,
        }}
        shadows
        gl={{ antialias: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <SceneContent
          showMarkers={showMarkers}
          autoRotate={autoRotate}
          allAssets={allAssets}
          selectedFloor={selectedFloor}
          selectedZone={selectedZone}
          onSelectZone={handleSelectZone}
          walkMode={walkMode}
        />
      </Canvas>

      {/* ── Zone info tooltip ── */}
      {selectedZoneData && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 max-w-xs">
          <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg px-4 py-3">
            <div className="text-xs text-slate-500">
              {selectedZoneData.floor}
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {selectedZoneData.zone.name}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Area:{" "}
              {(
                selectedZoneData.zone.w * selectedZoneData.zone.d
              ).toFixed(0)}{" "}
              m²
            </div>
          </div>
        </div>
      )}

      {/* ── Floor selector ── */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => {
            setSelectedFloor("ALL");
            setWalkMode(false);
          }}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
            selectedFloor === "ALL" && !walkMode
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white/80 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-200"
          }`}
          title="Show all floors"
        >
          All
        </button>
        {BUILDING_FLOORS.map((floor) => (
          <button
            key={floor.level}
            onClick={() => {
              setSelectedFloor(floor.level as FloorFilter);
              setWalkMode(false);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              selectedFloor === floor.level && !walkMode
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white/80 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-200"
            }`}
            title={`View ${floor.name}`}
          >
            {floor.level === 0 ? "B1" : `L${floor.level}`}
          </button>
        ))}
      </div>

      {/* ── Walk-mode toggle ── */}
      <button
        onClick={() => setWalkMode((w) => !w)}
        className={`absolute top-3 right-3 z-10 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
          walkMode
            ? "bg-green-600 text-white border-green-600 shadow-sm"
            : "bg-white/80 text-slate-700 border-slate-200 hover:bg-green-50 hover:border-green-200"
        }`}
        title={
          walkMode ? "Exit walkthrough mode" : "Walk inside the building"
        }
      >
        {walkMode ? "🚶 Exit Walk" : "🚶 Walk"}
      </button>

      {/* ── Walk-mode hint ── */}
      {walkMode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-black/75 backdrop-blur text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap">
            Drag to look · Scroll to dolly · Right-drag to pan
          </div>
        </div>
      )}

      {/* ── Controls hint ── */}
      {!walkMode && (
        <div className="absolute bottom-3 right-3 z-10 bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-sm px-3 py-1.5 pointer-events-none text-xs text-slate-500">
          Drag rotate · Scroll zoom · Click zone to inspect
        </div>
      )}
    </div>
  );
}
