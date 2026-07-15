"use client";

/**
 * Digital Twin FM — R3F 3D Viewer
 *
 * Two display modes (the core UX fix for "it feels cluttered"):
 *
 *   mode="showcase" — for marketing surfaces (landing page hero, dashboard
 *     preview). Just the building. Auto-rotate on. No overlays. No chrome.
 *     The viewer is the product, the chrome is the noise.
 *
 *   mode="operator" — for /twin dashboard. Operators need KPIs, events,
 *     layers. All overlays are toggleable via a single icon
 *     rail (top-right). Default open: KPI strip. Other panels
 *     panels (Layers / Events / Building Health) are one click away.
 *
 * Either mode can have showMarkers={false} for an even more stripped-back
 * view (e.g. screenshot capture or a quiet floor-isolation mode).
 *
 * Exports DigitalTwinViewer3D.
 */

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  CameraControls,
  ContactShadows,
  Environment,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { BarChart3, Bell, Building2, Footprints, HeartPulse, Layers, Thermometer, Users, Zap } from "lucide-react";
import { useViewerStore } from "./viewer-store";
import {
  camera as CAM,
} from "@/design-system/tokens";
import {
  Building,
  BuildingModel,
  AssetMarker3D,
  BUILDING_FLOORS,
  floorFootprintBounds,
  buildingGlobalBounds,
  floorWalkableBounds,
  resolveFloorLayout,
  validateFloorPlan,
  type FloorFilter,
} from "./viewer-building";
import type {
  Asset,
  ApiAssetShape,
} from "./viewer-data";
import { SEED_ASSETS, apiAssetsToViewerAssets } from "./viewer-data";

// ─── Types ─────────────────────────────────────────────────────────

/**
 * Display mode — controls which overlays render by default.
 *
 *   "showcase": bare building, no overlays. For marketing surfaces.
 *   "operator": operator dashboard. Overlays toggleable via icon rail.
 */
export type ViewerMode = "showcase" | "operator";

/**
 * Toggles exposed via the icon rail. Each one corresponds to a panel
 * or a top-level control surface.
 */
export type OverlayKey =
  | "kpis"        // Top-centre mini KPI strip
  | "health"      // Top-left Building Health card
  | "floors"      // Top-left floor selector
  | "events"      // Bottom-left Live Event feed
  | "layers"      // Right Layers panel (facade/furniture/MEP/zones)
  | "walk";       // Top-right Walk toggle

export interface DigitalTwinViewer3DProps {
  /** Display mode — see ViewerMode. Default "operator". */
  mode?: ViewerMode;
  /** When false, hides all asset markers. Default true. */
  showMarkers?: boolean;
  /** When true, the camera slowly orbits the building. Default false. */
  autoRotate?: boolean;
  /**
   * Operator-mode only: which overlays render by default. Unspecified
   * overlays can be opened via the icon rail. The KPI strip and floor
   * selector are always-on in operator mode unless explicitly listed.
   * Showcase mode ignores this entirely.
   */
  defaultOpenOverlays?: OverlayKey[];
  /** Real assets from the API. When provided, replaces SEED_ASSETS. */
  assets?: ApiAssetShape[];
  /** Callback when an asset is selected (opens sidebar detail panel). */
  onSelectAsset?: (id: string) => void;
  /**
   * Optional URL to an uploaded GLB/GLTF model. When provided, the
   * procedural Building component is replaced by the loaded 3D model.
   */
  modelUrl?: string;
}

// ─── Camera animator (driven by useFrame) ──────────────────────────

/**
 * Tracks camera animation state for floor transitions.
 * Lives inside Canvas so it can use useFrame and useThree.
 */
function CameraAnimator({
  selectedFloor,
  walkMode: _walkMode,
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
    if (!controls) return;
    // Start animation
    animProgress.current = 0;
  }, [selectedFloor, controls]);

  // Drive animation via useFrame (runs every render frame)
  useFrame(() => {
    if (animProgress.current < 0 || !controls) return;

    let endTarget: THREE.Vector3;
    let endPos: THREE.Vector3;

    if (selectedFloor === "ALL") {
      endTarget = new THREE.Vector3(...CAM.defaultTarget);
      endPos = new THREE.Vector3(...CAM.defaultPosition);
    } else {
      const floor = BUILDING_FLOORS.find((f) => f.level === selectedFloor);
      if (!floor) {
        animProgress.current = -1;
        return;
      }
      const targetY = floor.yBase + floor.height / 2;
      const bounds = floorFootprintBounds(floor);
      if (bounds) {
        // Center target on the floor's actual footprint
        endTarget = new THREE.Vector3(bounds.cx, targetY, bounds.cz);
        // Derive camera distance from the footprint diagonal so the whole
        // floor frames correctly at the current FOV (45°).
        const diagonal = Math.sqrt(bounds.width * bounds.width + bounds.depth * bounds.depth);
        const dist = diagonal / (2 * Math.tan((CAM.fov * Math.PI) / 360)) * 1.3; // 1.3× padding
        const clampedDist = Math.max(dist, 15);
        endPos = new THREE.Vector3(bounds.cx + clampedDist * 0.6, targetY + clampedDist * 0.35, bounds.cz + clampedDist * 0.7);
      } else {
        // Fallback when no room data: center on floor origin
        endTarget = new THREE.Vector3(0, targetY, 0);
        endPos = new THREE.Vector3(20, targetY + 6, 25);
      }
    }

    animProgress.current = Math.min(animProgress.current + 0.03, 1);
    const t = animProgress.current;
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic

    (controls as unknown as OrbitControlsImpl).target.lerp(endTarget, ease);
    camera.position.lerp(endPos, ease);

    if (t >= 1) animProgress.current = -1;
  });

  return null;
}

/**
 * Clamps the orbit-controls target to the building footprint so the
 * user can never pan the view centre outside the building extents.
 * Only active in non-walk mode.
 */
function CameraBoundsGuard({ enabled }: { enabled: boolean }) {
  const { controls } = useThree();
  useFrame(() => {
    if (!enabled || !controls) return;
    const bounds = buildingGlobalBounds();
    const t = (controls as unknown as OrbitControlsImpl).target;
    t.x = THREE.MathUtils.clamp(t.x, bounds.minX, bounds.maxX);
    t.z = THREE.MathUtils.clamp(t.z, bounds.minZ, bounds.maxZ);
  });
  return null;
}

/**
 * Constrains walk-mode camera to the walkable area of the current floor.
 * Prevents walking through walls or off the building edge.
 * Uses floorWalkableBounds() which derives its bounding box from room
 * polygons on the selected floor.
 */
function WalkBoundsGuard({ selectedFloor, enabled }: {
  selectedFloor: FloorFilter;
  enabled: boolean;
}) {
  const { camera } = useThree();

  useFrame(() => {
    if (!enabled || selectedFloor === "ALL") return;

    const bounds = floorWalkableBounds(selectedFloor as number);
    if (!bounds) return;

    // Clamp to walkable area — keeps the user inside room polygons
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, bounds.min.x, bounds.max.x);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, bounds.min.z, bounds.max.z);
    // Keep camera between floor + 0.5m and ceiling
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, bounds.min.y + 0.5, bounds.max.y - 0.1);
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
  onAssetClick,
  walkMode,
  showFacade,
  showFurniture,
  showMEP,
  showZones,
  modelUrl,
  visibleObjects,
  onObjectsFound,
}: {
  showMarkers: boolean;
  autoRotate: boolean;
  allAssets: Asset[];
  selectedFloor: FloorFilter;
  selectedZone: string | null;
  onSelectZone: (zoneId: string) => void;
  onAssetClick: (asset: Asset) => void;
  walkMode: boolean;
  showFacade: boolean;
  showFurniture: boolean;
  showMEP: boolean;
  showZones: boolean;
  modelUrl?: string;
  visibleObjects: Set<string>;
  onObjectsFound: (names: string[]) => void;
}) {
  const orbitControlsRef = useRef<OrbitControlsImpl>(null!);
  const cameraControlsRef = useRef<CameraControls>(null!);
  const selectedAsset = useViewerStore((state) => state.selectedAsset);

  // A3 — min-distance resampling so markers never overlap/clump.
  // Computed once per asset set; the marker applies the {x,z} override
  // on top of its per-type anchor (y stays correct).
  const floorLayout = useMemo(
    () => resolveFloorLayout(allAssets, BUILDING_FLOORS, 0.6),
    [allAssets],
  );

  // Set walkable boundary on CameraControls when floor changes
  useEffect(() => {
    const cc = cameraControlsRef.current as unknown as { boundary: THREE.Box3; boundaryEnclosesCamera: boolean };
    if (!cc) return;
    if (selectedFloor === "ALL") {
      cc.boundary = floorWalkableBounds(0);
    } else {
      cc.boundary = floorWalkableBounds(selectedFloor as number);
    }
    cc.boundaryEnclosesCamera = true;
  }, [selectedFloor]);

  // ── Lighting / Environment ──
  return (
    <>
      <ambientLight intensity={0.45} />
      {/* Main directional (sun) light — high quality shadows */}
      <directionalLight
        position={[25, 40, 20]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-radius={4}
        shadow-camera-far={120}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      {/* Warm rim backlight for dramatic silhouette */}
      <directionalLight
        position={[-20, 15, -30]}
        intensity={0.6}
        color="#ffd4a0"
      />
      {/* Cool fill from the opposite side */}
      <directionalLight
        position={[-15, 10, 20]}
        intensity={0.3}
        color="#b4d4ff"
      />
      <hemisphereLight args={["#f0f4ff", "#c0cfe0", 0.55]} />

      {/* Soft clean environment — flat gradient for glass transmission */}
      <Environment resolution={128}>
        <mesh position={[0, 25, 0]}>
          <sphereGeometry args={[14, 16, 16]} />
          <meshBasicMaterial color="#dce4ed" toneMapped={false} />
        </mesh>
      </Environment>

      {/* Fog — push far so building details aren't washed out */}
      <fog attach="fog" args={[0xf0f4fb, 100, 220]} />

      {/* Soft contact shadow — tight under the building, not a full-site wash */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.25}
        scale={50}
        blur={2.5}
        far={5}
      />

      {/* Building — either loaded GLB model or procedural fallback */}
      {modelUrl ? (
        <BuildingModel modelUrl={modelUrl} visibleObjects={visibleObjects} onObjectsFound={onObjectsFound} />
      ) : (
        <Building
          selectedFloor={selectedFloor}
          selectedZone={selectedZone}
          onSelectZone={onSelectZone}
          walkMode={walkMode}
          showFacade={showFacade}
          showFurniture={showFurniture}
          showMEP={showMEP}
          showZones={showZones}
          showMarkers={showMarkers}
        />
      )}

      {/* Asset markers — hidden when an uploaded model is loaded (markers should be baked into the GLB) */}
      {showMarkers && !modelUrl &&
        allAssets
          .filter((asset) => {
            if (selectedFloor === "ALL") return true;
            return selectedFloor === (asset.floor as FloorFilter);
          })
          .map((asset) => (
            <AssetMarker3D
              key={asset.id}
              asset={asset}
              selected={selectedAsset?.id === asset.id}
              onClick={() => onAssetClick(asset)}
              layoutOverride={floorLayout.get(asset.id) ?? null}
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
          minPolarAngle={CAM.minPolarAngle}
          maxPolarAngle={CAM.maxPolarAngle}
          autoRotate={autoRotate}
          autoRotateSpeed={2.0}
          target={CAM.defaultTarget}
        />
      )}

      {/* Clamp orbit target to building footprint */}
      <CameraBoundsGuard enabled={!walkMode} />

      {/* Constrain walk-mode camera to room polygons */}
      <WalkBoundsGuard selectedFloor={selectedFloor} enabled={walkMode} />
    </>
  );
}

// ─── Live KPI Simulator ────────────────────────────────────────────

function useLiveKPIs(allAssets: Asset[]) {
  const [kpis, setKpis] = useState({
    temperature: "22.4",
    power: "847",
    alerts: 0,
    occupancy: "72",
    energy: "1,248",
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const critCount = allAssets.filter((a) => a.status === "critical").length;
      const warnCount = allAssets.filter((a) => a.status === "warning").length;
      setKpis({
        temperature: (20 + Math.random() * 4).toFixed(1),
        power: Math.floor(800 + Math.random() * 100).toString(),
        alerts: critCount + warnCount,
        occupancy: Math.floor(65 + Math.random() * 20).toString(),
        energy: (1200 + Math.floor(Math.random() * 100)).toLocaleString(),
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [allAssets]);

  return kpis;
}

// ─── Live Event Feed Simulator ─────────────────────────────────────

interface LiveEvent {
  id: number;
  time: string;
  asset: string;
  message: string;
  severity: "info" | "warning" | "critical";
}

function useLiveEvents(allAssets: Asset[]) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    // Seed initial events
    const initial: LiveEvent[] = allAssets
      .filter((a) => a.status !== "ok" && a.status !== "info")
      .slice(0, 3)
      .map((a, i) => ({
        id: i,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        asset: a.name,
        message: a.status === "critical" ? "Fault detected — check now" : "Threshold exceeded",
        severity: a.status as "warning" | "critical",
      }));
    counterRef.current = initial.length;
    setEvents(initial);

    const interval = setInterval(() => {
      const randomAsset = allAssets[Math.floor(Math.random() * allAssets.length)];
      if (!randomAsset) return;
      const messages = [
        "Temperature increased",
        "Vibration anomaly detected",
        "Power consumption spike",
        "Scheduled maintenance due",
        "Sensor calibration required",
        "Performance normal",
        "Load balanced successfully",
      ];
      const severity: "info" | "warning" | "critical" =
        randomAsset.status === "critical" ? "critical" :
        randomAsset.status === "warning" ? "warning" : "info";

      setEvents((prev) => [
        {
          id: ++counterRef.current,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          asset: randomAsset.name,
          message: messages[Math.floor(Math.random() * messages.length)],
          severity,
        },
        ...prev.slice(0, 4),
      ]);
    }, 5000);

    return () => clearInterval(interval);
  }, [allAssets]);

  return events;
}

// ─── Building Health Score ─────────────────────────────────────────

function BuildingHealthScore({ allAssets }: { allAssets: Asset[] }) {
  // Formula: true percentage of healthy (ok/info) assets.
  // No artificial cap — if most assets are critical, the score is genuinely low.
  const okCount = allAssets.filter((a) => a.status === "ok" || a.status === "info").length;
  const total = allAssets.length || 1;
  const score = Math.round((okCount / total) * 100);
  const statusColor = score >= 90 ? "#22c55e" : score >= 70 ? "#f59e0b" : "#ef4444";
  const statusLabel = score >= 90 ? "Healthy" : score >= 70 ? "Attention" : "Critical";
  const statusEmoji = score >= 90 ? "🟢" : score >= 70 ? "🟡" : "🔴";

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-lg px-4 py-3 min-w-[140px]">
      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Building Health</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight" style={{ color: statusColor }}>{score}%</span>
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className="text-sm">{statusEmoji}</span>
        <span className="text-[11px] font-semibold" style={{ color: statusColor }}>{statusLabel}</span>
      </div>
    </div>
  );
}

// ─── Mini KPI Bar ──────────────────────────────────────────────────

function MiniKPIBar({ kpis }: { kpis: ReturnType<typeof useLiveKPIs> }) {
  const items = [
    { label: "Temperature", value: `${kpis.temperature}°C`, icon: "🌡️", color: "#3b82f6" },
    { label: "Power", value: `${kpis.power} kW`, icon: "⚡", color: "#f59e0b" },
    { label: "Alerts", value: `${kpis.alerts}`, icon: "🔔", color: kpis.alerts > 0 ? "#ef4444" : "#22c55e" },
    { label: "Occupancy", value: `${kpis.occupancy}%`, icon: "👥", color: "#8b5cf6" },
    { label: "Energy", value: `${kpis.energy} kWh`, icon: "📊", color: "#06b6d4" },
  ];
  const icons = { Temperature: Thermometer, Power: Zap, Alerts: Bell, Occupancy: Users, Energy: BarChart3 };

  return (
    <div className="flex gap-1">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white/95 backdrop-blur-xl border border-slate-200/70 rounded-xl shadow-sm px-2.5 py-1.5 text-center min-w-[80px] transition-all hover:shadow-md hover:scale-[1.02]"
        >
          {(() => { const Icon = icons[item.label as keyof typeof icons]; return <Icon size={16} strokeWidth={2.25} className="mx-auto mb-0.5" style={{ color: item.color }} />; })()}
          <div className="text-[13px] font-bold tracking-tight" style={{ color: item.color }}>{item.value}</div>
          <div className="text-[8px] font-medium text-slate-400 uppercase tracking-wider">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Live Event Feed ───────────────────────────────────────────────

function LiveEventFeed({ events }: { events: LiveEvent[] }) {
  const sevColor = { info: "#3b82f6", warning: "#f59e0b", critical: "#ef4444" };
  const sevBg = { info: "bg-blue-50", warning: "bg-amber-50", critical: "bg-red-50" };

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-lg overflow-hidden w-[260px]">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Events</span>
      </div>
      <div className="max-h-[180px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11px] text-slate-400">No events yet</div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className={`px-3 py-2 border-b border-slate-50 last:border-0 flex gap-2 items-start ${sevBg[ev.severity]} transition-all`}
            >
              <div className="w-1 h-full min-h-[28px] rounded-full mt-0.5" style={{ background: sevColor[ev.severity] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold text-slate-800 truncate">{ev.asset}</span>
                  <span className="text-[9px] text-slate-400 whitespace-nowrap">{ev.time}</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">{ev.message}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Viewer Component ─────────────────────────────────────────

export function DigitalTwinViewer3D({
  mode = "operator",
  showMarkers = true,
  autoRotate = false,
  defaultOpenOverlays,
  assets,
  onSelectAsset,
  modelUrl,
}: DigitalTwinViewer3DProps) {
  const { selectedFloor, setSelectedFloor } = useViewerStore();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [walkMode, setWalkMode] = useState(false);

  // ── Overlay visibility (operator mode only) ──
  // Each overlay is independent so the icon rail can toggle them in any
  // combination. KPI strip defaults to open; everything else
  // default closed unless listed in defaultOpenOverlays.
  const [openOverlays, setOpenOverlays] = useState<Set<OverlayKey>>(() => {
    if (mode === "showcase") return new Set();
    const initial: OverlayKey[] = ["kpis"];
    if (defaultOpenOverlays) initial.push(...defaultOpenOverlays);
    return new Set(initial);
  });
  const toggleOverlay = useCallback((k: OverlayKey) => {
    setOpenOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  // Layer toggles state (operator mode, inside the Layers panel)
  const [showFacade, setShowFacade] = useState(true);
  const [showFurniture, setShowFurniture] = useState(true);
  const [showMEP, setShowMEP] = useState(true);
  const [showZones, setShowZones] = useState(true);

  // Uploaded GLB object layers — named child objects from the model
  // that can be individually toggled via the Layers panel.
  const [modelObjectNames, setModelObjectNames] = useState<string[]>([]);
  const [visibleObjects, setVisibleObjects] = useState<Set<string>>(new Set());

  // Reset object names when modelUrl changes
  useEffect(() => {
    setModelObjectNames([]);
    setVisibleObjects(new Set());
  }, [modelUrl]);

  // Resolve assets
  const allAssets = useMemo(
    () => (assets ? apiAssetsToViewerAssets(assets) : SEED_ASSETS),
    [assets],
  );

  // Dev-time floor-plan validator — fails loudly if any asset is outside its room
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      validateFloorPlan(BUILDING_FLOORS, allAssets);
    }
  }, [allAssets]);

  // Live KPI + Events
  const kpis = useLiveKPIs(allAssets);
  const events = useLiveEvents(allAssets);

  const handleSelectZone = useCallback((zoneId: string) => {
    setSelectedZone((prev) => (prev === zoneId ? null : zoneId));
  }, []);

  const handleAssetClick = useCallback((asset: Asset) => {
    const store = useViewerStore.getState();
    store.setSelectedAsset(asset);
    // Also notify parent (opens sidebar detail panel)
    onSelectAsset?.(asset.id);
  }, [onSelectAsset]);

  const isShowcase = mode === "showcase";
  const isOpen = (k: OverlayKey) => openOverlays.has(k);

  return (
    <div
      className="relative w-full h-[600px] md:h-[700px] overflow-hidden rounded-2xl"
      data-testid="digital-twin-viewer-3d"
      data-viewer-mode={mode}
      style={{
        background: "linear-gradient(180deg, #e8eef7 0%, #f7f9fd 40%, #f0f4fb 100%)",
      }}
    >
      <Canvas
        camera={{
          position: CAM.defaultPosition,
          fov: CAM.fov,
          near: CAM.near,
          far: CAM.far,
        }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <SceneContent
          showMarkers={showMarkers}
          autoRotate={autoRotate}
          allAssets={allAssets}
          selectedFloor={selectedFloor}
          selectedZone={selectedZone}
          onSelectZone={handleSelectZone}
          onAssetClick={handleAssetClick}
          walkMode={walkMode}
          showFacade={showFacade}
          showFurniture={showFurniture}
          showMEP={showMEP}
          showZones={showZones}
          modelUrl={modelUrl}
          visibleObjects={visibleObjects}
          onObjectsFound={setModelObjectNames}
        />
      </Canvas>

      {/* ──────────────────────────────────────────────────────────────
          SHOWCASE MODE: building only, no chrome. Auto-rotate handled
          inside the Canvas. Marketing surfaces stay clean.
          ────────────────────────────────────────────────────────────── */}
      {isShowcase ? null : (
        <>
          {/* ── Mini KPI Bar (top center) — toggleable ── */}
          {isOpen("kpis") && (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 z-10"
              data-overlay="kpis"
            >
              <MiniKPIBar kpis={kpis} />
            </div>
          )}

          {/* ── Top-left stack: Building Health card + floor selector ── */}
          {(isOpen("health") || isOpen("floors")) && (
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
              {isOpen("health") && (
                <div data-overlay="health">
                  <BuildingHealthScore allAssets={allAssets} />
                </div>
              )}

              {/* Floor selector */}
              {isOpen("floors") && (
                <div className="flex flex-col gap-1" data-overlay="floors">
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
                    All Floors
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
                      {/* DYNAMIC: derive the label from the floor's own name
                          (e.g. "L1", "L2", "B1", "M", "Roof"). Falls back to
                          "L{level+1}" so the UI is correct for buildings with
                          any number of floors. */}
                      {floor.shortLabel ?? (floor.level === 0 ? "L1" : `L${floor.level + 1}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Layers Panel (right side) ── */}
          {isOpen("layers") && !walkMode && (
            <div
              className="absolute top-16 right-3 z-10 bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-md p-2 flex flex-col gap-1 w-[140px] transition-all"
              data-overlay="layers"
            >
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1.5 py-0.5">
                Layers
              </div>

              {/* When an uploaded GLB has named objects, show dynamic toggles */}
              {modelUrl && modelObjectNames.length > 0
                ? modelObjectNames.map((name) => {
                    const active = visibleObjects.size === 0 || visibleObjects.has(name);
                    return (
                      <button
                        key={name}
                        onClick={() => {
                          const next = new Set(visibleObjects);
                          if (next.has(name)) next.delete(name);
                          else next.add(name);
                          setVisibleObjects(next);
                        }}
                        className={`flex items-center justify-between px-2 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                          active
                            ? "bg-slate-100 text-slate-800 border-slate-200 font-semibold"
                            : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                        }`}
                      >
                        <span>{name}</span>
                      </button>
                    );
                  })
                : /* Fallback: hardcoded procedural-building layers */
                  <>
                    <button
                      onClick={() => setShowFacade((f) => !f)}
                      className={`flex items-center justify-between px-2 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                        showFacade
                          ? "bg-slate-100 text-slate-800 border-slate-200 font-semibold"
                          : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <span>🏢 Facade</span>
                    </button>

                    <button
                      onClick={() => setShowFurniture((f) => !f)}
                      className={`flex items-center justify-between px-2 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                        showFurniture
                          ? "bg-slate-100 text-slate-800 border-slate-200 font-semibold"
                          : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <span>🛋️ Furniture</span>
                    </button>

                    <button
                      onClick={() => setShowMEP((m) => !m)}
                      className={`flex items-center justify-between px-2 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                        showMEP
                          ? "bg-slate-100 text-slate-800 border-slate-200 font-semibold"
                          : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <span>⚙️ Systems</span>
                    </button>

                    <button
                      onClick={() => setShowZones((z) => !z)}
                      className={`flex items-center justify-between px-2 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                        showZones
                          ? "bg-slate-100 text-slate-800 border-slate-200 font-semibold"
                          : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <span>🗺️ Zones</span>
                    </button>
                  </>
              }
            </div>
          )}

          {/* ── Live Event Feed (bottom-left) ── */}
          {isOpen("events") && (
            <div
              className="absolute bottom-3 left-3 z-10"
              data-overlay="events"
            >
              <LiveEventFeed events={events} />
            </div>
          )}

          {/* ── Icon Rail (top-right): single toggle bar for ALL overlays ── */}
          <IconRail
            openOverlays={openOverlays}
            onToggle={toggleOverlay}
            walkMode={walkMode}
            onToggleWalk={() => setWalkMode((w) => !w)}
          />

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
              Drag rotate · Scroll zoom · Click asset to inspect
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Icon Rail ─────────────────────────────────────────────────────
//
// Single bar of icon buttons in the top-right that toggles each overlay.
// Replaces the always-on clusters of separate panels. One click →
// panel appears. One click again → panel disappears. Each icon shows
// an active state when its panel is open.

interface IconRailProps {
  openOverlays: Set<OverlayKey>;
  onToggle: (k: OverlayKey) => void;
  walkMode: boolean;
  onToggleWalk: () => void;
}

function IconRail({ openOverlays, onToggle, walkMode, onToggleWalk }: IconRailProps) {
  const buttons: { key: OverlayKey; label: string; title: string }[] = [
    { key: "kpis", label: "KPIs", title: "Live KPIs" },
    { key: "health", label: "Health", title: "Building Health" },
    { key: "floors", label: "Floors", title: "Floor selector" },
    { key: "events", label: "Events", title: "Live Event Feed" },
    { key: "layers", label: "Layers", title: "Layers panel" },
  ];
  const icons = { KPIs: BarChart3, Health: HeartPulse, Floors: Building2, Events: Bell, Layers } as const;

  return (
    <div
      className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-md p-1"
      data-testid="viewer-icon-rail"
    >
      {buttons.map((b) => {
        const active = openOverlays.has(b.key);
        const Icon = icons[b.label as keyof typeof icons];
        return (
          <button
            key={b.key}
            onClick={() => onToggle(b.key)}
            title={b.title}
            aria-pressed={active}
            data-rail-button={b.key}
            className={`h-9 w-9 rounded-xl text-base flex items-center justify-center transition-all ${
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon size={18} strokeWidth={2.2} />
          </button>
        );
      })}
      {/* Walk toggle sits at the end of the rail as a separator group */}
      <div className="w-px h-6 bg-slate-200 mx-0.5" />
      <button
        onClick={onToggleWalk}
        title={walkMode ? "Exit walkthrough" : "Walk inside the building"}
        aria-pressed={walkMode}
        data-rail-button="walk"
        className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
          walkMode
            ? "bg-green-600 text-white shadow-sm"
            : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        <Footprints size={16} strokeWidth={2.2} /> <span className="hidden sm:inline">{walkMode ? "Exit" : "Walk"}</span>
      </button>
    </div>
  );
}
