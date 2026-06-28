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
 *     layers, AI Copilot. All overlays are toggleable via a single icon
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
import { useViewerStore } from "./viewer-store";
import {
  camera as CAM,
} from "@/design-system/tokens";
import {
  Building,
  AssetMarker3D,
  BUILDING_FLOORS,
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
  | "ai"          // Bottom-right AI Copilot button
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
      endTarget = new THREE.Vector3(0, targetY, 0);
      endPos = new THREE.Vector3(20, targetY + 6, 25);
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
}) {
  const orbitControlsRef = useRef<OrbitControlsImpl>(null!);
  const cameraControlsRef = useRef<CameraControls>(null!);
  const selectedAsset = useViewerStore((state) => state.selectedAsset);

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
      
      {/* Studio lighting environment map reflections (procedural virtual lights, no network requests) */}
      <Environment>
        {/* Soft overhead light dome */}
        <mesh position={[0, 18, 0]}>
          <sphereGeometry args={[10, 16, 16]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        {/* Warm key light */}
        <mesh position={[20, 10, 20]}>
          <sphereGeometry args={[5, 12, 12]} />
          <meshBasicMaterial color="#ffe3c2" toneMapped={false} />
        </mesh>
        {/* Cool fill light */}
        <mesh position={[-20, 10, -20]}>
          <sphereGeometry args={[5, 12, 12]} />
          <meshBasicMaterial color="#c2e3ff" toneMapped={false} />
        </mesh>
        {/* Ground reflection fill */}
        <mesh position={[0, -5, 0]}>
          <sphereGeometry args={[8, 12, 12]} />
          <meshBasicMaterial color="#e8eef7" toneMapped={false} />
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

      {/* Building */}
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
              selected={selectedAsset?.id === asset.id}
              onClick={() => onAssetClick(asset)}
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
          autoRotateSpeed={2.0}
          target={CAM.defaultTarget}
        />
      )}
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

  return (
    <div className="flex gap-1">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white/95 backdrop-blur-xl border border-slate-200/70 rounded-xl shadow-sm px-2.5 py-1.5 text-center min-w-[80px] transition-all hover:shadow-md hover:scale-[1.02]"
        >
          <div className="text-sm mb-0.5">{item.icon}</div>
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

// ─── AI Copilot Button ─────────────────────────────────────────────

function AICopilotButton() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string>("");
  const [thinking, setThinking] = useState(false);

  const suggestions = [
    "Why is the upper level hot?",
    "Which assets need maintenance?",
    "Show energy consumption trend",
    "Predict failures this week",
  ];

  const handleAsk = async (q: string) => {
    setThinking(true);
    setResponse("");
    setReasoning("");
    try {
      const body = JSON.stringify({
        question: q,
        building_id: "9a83477a-4b19-444a-9345-0e07f90d16b0",
      });
      const res = await fetch("/api/proxy/ai/copilot/query/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        credentials: "same-origin",
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream unavailable");
      }

      setThinking(false);

      let accumulated = "";
      let accumulatedReasoning = "";
      let lastUpdate = Date.now();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        // SSE stream loops until the server sends [DONE] or closes the
        // response. The reader returns { done: true } at EOF; we break on
        // that or on the explicit [DONE] sentinel inside the loop body.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                setResponse(accumulated);
                setReasoning(accumulatedReasoning);
                return;
              }
              try {
                const parsed = JSON.parse(data);
                let updatedState = false;
                if (parsed.reasoning) {
                  accumulatedReasoning += parsed.reasoning;
                  updatedState = true;
                }
                if (parsed.token) {
                  accumulated += parsed.token;
                  updatedState = true;
                }

                if (updatedState) {
                  const now = Date.now();
                  if (now - lastUpdate > 60) {
                    setResponse(accumulated);
                    setReasoning(accumulatedReasoning);
                    lastUpdate = now;
                  }
                }
              } catch {
                // Skip malformed lines
              }
            }
          }
        }
        setResponse(accumulated);
        setReasoning(accumulatedReasoning);
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      console.warn("AI service streaming failed, falling back to simulation:", err);
      const responses: Record<string, string> = {
        "Why is the upper level hot?": "AHU-001 on the Upper Mezzanine is running at reduced capacity (warning status). The supply air temperature sensor reads 26.2°C, which is 3.8°C above setpoint. Recommend checking the cooling coil valve actuator on the mezzanine AHU.",
        "Which assets need maintenance?": "3 assets require attention: Chiller 1 (critical — compressor vibration 4.2mm/s), Pump 2 (warning — seal leak detected), Fan 4 (warning — bearing temperature elevated at 78°C).",
        "Show energy consumption trend": "Current building energy: 1,248 kWh. Trending 12% higher than last week due to increased cooling load on the Exhibition Level. Peak hours: 2PM–5PM. Recommend scheduling non-critical loads to off-peak.",
        "Predict failures this week": "Based on vibration and temperature trends: Chiller 1 has 87% probability of compressor failure within 72 hours. Boiler 2 shows gradual efficiency decline — recommend inspection within 5 days.",
      };
      setResponse(responses[q] || "I can analyze building systems, predict maintenance needs, optimize energy usage, and answer questions about facility operations. Try asking about specific assets or systems.");
      setThinking(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 transition-all duration-200"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-1l-3 4-3-4H8a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z" />
        </svg>
        <span className="text-[12px] font-semibold">Ask AI</span>
      </button>
    );
  }

  return (
    <div className="bg-white/98 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl w-[340px] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-1l-3 4-3-4H8a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z" />
          </svg>
          <span className="text-[13px] font-semibold text-white">AI Copilot</span>
        </div>
        <button onClick={() => { setOpen(false); setResponse(null); setReasoning(""); setQuery(""); }} className="text-white/70 hover:text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Suggestions */}
      {response === null && !thinking && (
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Suggestions</div>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); handleAsk(s); }}
                className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Response */}
      {thinking && (
        <div className="px-4 py-6 flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      )}
      {(reasoning || response) && (
        <div className="px-4 py-3 max-h-[200px] overflow-y-auto space-y-2">
          {reasoning && (
            <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-2.5 font-mono">
              <details open className="group">
                <summary className="flex cursor-pointer select-none items-center gap-1 font-semibold text-slate-600 hover:text-slate-800">
                  <svg className="w-3 h-3 animate-spin text-slate-400 group-open:animate-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeDasharray="30 10"/>
                  </svg>
                  <span>Thinking Process</span>
                </summary>
                <div className="mt-1 whitespace-pre-wrap leading-relaxed border-t border-slate-200/60 pt-1 text-slate-500/80">{reasoning}</div>
              </details>
            </div>
          )}
          {response && (
            <div className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">
              {response}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2 border-t border-slate-100">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) handleAsk(query); }}
            placeholder="Ask about your building..."
            className="flex-1 text-[11px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 text-slate-700"
          />
          <button
            onClick={() => { if (query.trim()) handleAsk(query); }}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[11px] font-medium hover:bg-blue-700 transition-colors"
          >
            Ask
          </button>
        </div>
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

  // Resolve assets
  const allAssets = useMemo(
    () => (assets ? apiAssetsToViewerAssets(assets) : SEED_ASSETS),
    [assets],
  );

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
              className="absolute top-16 right-3 z-10 bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-md p-2 flex flex-col gap-1 w-[120px] transition-all"
              data-overlay="layers"
            >
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1.5 py-0.5">
                Layers
              </div>

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

          {/* ── AI Copilot (when its overlay is on) ── */}
          {isOpen("ai") && (
            <div className="absolute bottom-3 right-3 z-20" data-overlay="ai">
              <AICopilotButton />
            </div>
          )}

          {/* ── Controls hint (only when neither AI nor walk is active) ── */}
          {!walkMode && !isOpen("ai") && (
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
  const buttons: { key: OverlayKey; icon: string; label: string; title: string }[] = [
    { key: "kpis", icon: "📊", label: "KPIs", title: "Live KPIs" },
    { key: "health", icon: "💚", label: "Health", title: "Building Health" },
    { key: "floors", icon: "🏢", label: "Floors", title: "Floor selector" },
    { key: "events", icon: "🔔", label: "Events", title: "Live Event Feed" },
    { key: "layers", icon: "🧱", label: "Layers", title: "Layers panel" },
    { key: "ai", icon: "💬", label: "AI", title: "AI Copilot" },
  ];

  return (
    <div
      className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-md p-1"
      data-testid="viewer-icon-rail"
    >
      {buttons.map((b) => {
        const active = openOverlays.has(b.key);
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
            {b.icon}
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
        🚶 <span className="hidden sm:inline">{walkMode ? "Exit" : "Walk"}</span>
      </button>
    </div>
  );
}
