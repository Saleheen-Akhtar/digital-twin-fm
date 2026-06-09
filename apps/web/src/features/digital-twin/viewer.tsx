"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Html, Edges } from "@react-three/drei";
import { Suspense } from "react";
import * as THREE from "three";
import type { Asset, AssetStatus, AssetType } from "@digital-twin-fm/types";

/**
 * DigitalTwinViewer — human-readable 3D facility viewer.
 *
 * - Procedural building outline (5 floors, scaled to real building data)
 * - Type-specific 3D markers (boiler ≠ chiller ≠ AHU ≠ pump)
 * - Friendly labels ("Boiler 1 — Hall 7" not "BOILER-001")
 * - Status legend always visible
 * - Click → side panel (handled by parent via onSelectAsset)
 */

export type ViewerAsset = Pick<
  Asset,
  "id" | "name" | "type" | "status"
> & {
  positionX?: number | null;
  positionY?: number | null;
  positionZ?: number | null;
};

export interface DigitalTwinViewerProps {
  assets?: ViewerAsset[];
  selectedId?: string | null;
  onSelectAsset?: (id: string) => void;
}

const STATUS_COLOR: Record<AssetStatus, string> = {
  ok: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
  offline: "#737373",
  info: "#3b82f6",
};

const STATUS_LABEL: Record<AssetStatus, string> = {
  ok: "OK",
  warning: "Warning",
  critical: "Critical",
  offline: "Offline",
  info: "Info",
};

// Human-readable name mapping
const TYPE_LABEL: Record<AssetType, string> = {
  ahu: "Air Handler",
  chiller: "Chiller",
  boiler: "Boiler",
  pump: "Pump",
  fan: "Fan",
  elevator: "Elevator",
  lighting: "Lighting",
  sensor_only: "Sensor",
  other: "Equipment",
};

const TYPE_ICON: Record<AssetType, string> = {
  ahu: "💨",
  chiller: "❄️",
  boiler: "🔥",
  pump: "💧",
  fan: "🌀",
  elevator: "🛗",
  lighting: "💡",
  sensor_only: "📡",
  other: "⚙️",
};

function friendlyName(a: ViewerAsset): string {
  // Strip type prefix from "BOILER-001" → "Boiler 1"
  const match = a.name.match(/^[A-Z_]+-?(\d+)$/);
  if (match) {
    const typeLabel = TYPE_LABEL[a.type] ?? "Equipment";
    return `${typeLabel} ${match[1]}`;
  }
  return a.name;
}

// ──────────── Procedural Building ────────────
// A 5-floor building outline. Real dimensions are picked to feel like
// a Singapore Expo-style hall: 40m wide × 30m deep × 18m tall (5 floors × 3.6m).
function ProceduralBuilding({ floorCount = 5 }: { floorCount?: number }) {
  // ─── Dimensions: a modern office tower ───
  // Main tower is taller than wide (realistic proportions),
  // a 2m podium at the base, and a rooftop penthouse.
  const towerW = 18;
  const towerD = 14;
  const floorH = 4.2;          // generous floor height
  const totalH = floorH * floorCount;
  const halfW = towerW / 2;
  const halfD = towerD / 2;
  const podiumH = 2.2;
  const podiumW = towerW + 3;
  const podiumD = towerD + 3;
  const halfPodiumW = podiumW / 2;
  const halfPodiumD = podiumD / 2;
  const mullionT = 0.12;       // window frame thickness
  const slabT = 0.35;          // floor slab thickness (visible between glass)

  // Mullion grid: 5 columns × 3 rows of glass panels per floor
  const mullionCols = 5;
  const mullionRows = 3;

  return (
    <group>
      {/* ─── Ground plane (matches dashboard light theme) ─── */}
      <mesh
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#e8eef7" roughness={0.95} metalness={0} />
      </mesh>
      {/* Subtle grid lines on ground (architectural feel) */}
      <Grid
        args={[120, 120]}
        cellSize={2}
        cellThickness={0.3}
        cellColor="#d4dce8"
        sectionSize={10}
        sectionThickness={0.6}
        sectionColor="#c2cbdc"
        position={[0, 0, 0]}
      />

      {/* ─── Podium (base, slightly wider than tower) ─── */}
      <mesh position={[0, podiumH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[podiumW, podiumH, podiumD]} />
        <meshStandardMaterial
          color="#94a3b8"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
      {/* Podium entrance — a darker recessed panel on the front */}
      <mesh position={[0, podiumH / 2, halfPodiumD - 0.05]}>
        <boxGeometry args={[6, 1.6, 0.1]} />
        <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Entrance canopy */}
      <mesh position={[0, podiumH - 0.15, halfPodiumD + 1.5]} castShadow>
        <boxGeometry args={[7, 0.15, 2.5]} />
        <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Canopy support columns */}
      {[-3, 3].map((x) => (
        <mesh key={`canopy-col-${x}`} position={[x, podiumH / 2 - 0.15, halfPodiumD + 1.5]} castShadow>
          <boxGeometry args={[0.2, podiumH - 0.3, 0.2]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      ))}

      {/* ─── Main tower: glass curtain wall with visible slabs ─── */}
      {Array.from({ length: floorCount }, (_, floorI) => {
        const yBase = podiumH + floorI * floorH;
        const yCenter = yBase + floorH / 2;
        const panelH = (floorH - slabT) / mullionRows;
        const panelW = towerW / mullionCols;
        return (
          <group key={`tower-floor-${floorI}`}>
            {/* Floor slab (concrete, visible as horizontal band) */}
            <mesh position={[0, yBase, 0]} castShadow receiveShadow>
              <boxGeometry args={[towerW + 0.3, slabT, towerD + 0.3]} />
              <meshStandardMaterial
                color="#e2e8f0"
                roughness={0.85}
                metalness={0.05}
              />
            </mesh>

            {/* Glass panels — front */}
            {Array.from({ length: mullionRows }, (_, row) =>
              Array.from({ length: mullionCols }, (_, col) => {
                const x = -halfW + panelW * (col + 0.5);
                const y = yBase + slabT / 2 + panelH * (row + 0.5);
                return (
                  <mesh key={`gf-${floorI}-${row}-${col}`} position={[x, y, halfD - 0.05]}>
                    <boxGeometry args={[panelW * 0.92, panelH * 0.88, 0.08]} />
                    <meshPhysicalMaterial
                      color="#5b8fd9"
                      metalness={0.1}
                      roughness={0.05}
                      transmission={0.6}
                      transparent
                      opacity={0.55}
                      ior={1.5}
                    />
                  </mesh>
                );
              })
            )}

            {/* Glass panels — back */}
            {Array.from({ length: mullionRows }, (_, row) =>
              Array.from({ length: mullionCols }, (_, col) => {
                const x = -halfW + panelW * (col + 0.5);
                const y = yBase + slabT / 2 + panelH * (row + 0.5);
                return (
                  <mesh key={`gb-${floorI}-${row}-${col}`} position={[x, y, -halfD + 0.05]}>
                    <boxGeometry args={[panelW * 0.92, panelH * 0.88, 0.08]} />
                    <meshPhysicalMaterial
                      color="#5b8fd9"
                      metalness={0.1}
                      roughness={0.05}
                      transmission={0.6}
                      transparent
                      opacity={0.55}
                      ior={1.5}
                    />
                  </mesh>
                );
              })
            )}

            {/* Glass panels — left */}
            {Array.from({ length: mullionRows }, (_, row) =>
              Array.from({ length: mullionCols }, (_, col) => {
                const z = -halfD + panelW * (col + 0.5);
                const y = yBase + slabT / 2 + panelH * (row + 0.5);
                return (
                  <mesh key={`gl-${floorI}-${row}-${col}`} position={[-halfW + 0.05, y, z]}>
                    <boxGeometry args={[0.08, panelH * 0.88, panelW * 0.92]} />
                    <meshPhysicalMaterial
                      color="#5b8fd9"
                      metalness={0.1}
                      roughness={0.05}
                      transmission={0.6}
                      transparent
                      opacity={0.55}
                      ior={1.5}
                    />
                  </mesh>
                );
              })
            )}

            {/* Glass panels — right */}
            {Array.from({ length: mullionRows }, (_, row) =>
              Array.from({ length: mullionCols }, (_, col) => {
                const z = -halfD + panelW * (col + 0.5);
                const y = yBase + slabT / 2 + panelH * (row + 0.5);
                return (
                  <mesh key={`gr-${floorI}-${row}-${col}`} position={[halfW - 0.05, y, z]}>
                    <boxGeometry args={[0.08, panelH * 0.88, panelW * 0.92]} />
                    <meshPhysicalMaterial
                      color="#5b8fd9"
                      metalness={0.1}
                      roughness={0.05}
                      transmission={0.6}
                      transparent
                      opacity={0.55}
                      ior={1.5}
                    />
                  </mesh>
                );
              })
            )}

            {/* Vertical mullions (window frames) — front + back */}
            {Array.from({ length: mullionCols + 1 }, (_, i) => {
              const x = -halfW + panelW * i;
              return (
                <group key={`mv-${floorI}-${i}`}>
                  <mesh position={[x, yCenter, halfD - 0.02]}>
                    <boxGeometry args={[mullionT, floorH - slabT, mullionT]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
                  </mesh>
                  <mesh position={[x, yCenter, -halfD + 0.02]}>
                    <boxGeometry args={[mullionT, floorH - slabT, mullionT]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
                  </mesh>
                </group>
              );
            })}

            {/* Vertical mullions — left + right */}
            {Array.from({ length: mullionCols + 1 }, (_, i) => {
              const z = -halfD + panelW * i;
              return (
                <group key={`mvl-${floorI}-${i}`}>
                  <mesh position={[-halfW + 0.02, yCenter, z]}>
                    <boxGeometry args={[mullionT, floorH - slabT, mullionT]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
                  </mesh>
                  <mesh position={[halfW - 0.02, yCenter, z]}>
                    <boxGeometry args={[mullionT, floorH - slabT, mullionT]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
                  </mesh>
                </group>
              );
            })}

            {/* Horizontal mullions (mid-rail of each panel row) */}
            {Array.from({ length: mullionRows - 1 }, (_, i) => {
              const y = yBase + slabT / 2 + panelH * (i + 1);
              return (
                <group key={`mh-${floorI}-${i}`}>
                  {/* front + back */}
                  <mesh position={[0, y, halfD - 0.02]}>
                    <boxGeometry args={[towerW, mullionT * 0.8, mullionT]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
                  </mesh>
                  <mesh position={[0, y, -halfD + 0.02]}>
                    <boxGeometry args={[towerW, mullionT * 0.8, mullionT]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
                  </mesh>
                  {/* left + right */}
                  <mesh position={[-halfW + 0.02, y, 0]}>
                    <boxGeometry args={[mullionT, mullionT * 0.8, towerD]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
                  </mesh>
                  <mesh position={[halfW - 0.02, y, 0]}>
                    <boxGeometry args={[mullionT, mullionT * 0.8, towerD]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}

      {/* ─── Rooftop structure (penthouse + mechanical equipment) ─── */}
      <mesh position={[0, podiumH + totalH + 0.6, 0]} castShadow>
        <boxGeometry args={[towerW + 1, 1.2, towerD + 1]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Mechanical boxes on roof */}
      {[
        [-5, 0, -3],
        [5, 0, -3],
        [-5, 0, 3],
        [5, 0, 3],
        [0, 0, 0],
      ].map(([x, , z], i) => (
        <mesh key={`mech-${i}`} position={[x, podiumH + totalH + 1.8, z]} castShadow>
          <boxGeometry args={[1.5, 1, 1.5]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* Antenna on roof */}
      <mesh position={[0, podiumH + totalH + 3.5, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ─── Corner columns (structural, visible at corners) ─── */}
      {[
        [-halfW, -halfD],
        [halfW, -halfD],
        [-halfW, halfD],
        [halfW, halfD],
      ].map(([x, z], i) => (
        <mesh key={`col-${i}`} position={[x, podiumH + totalH / 2, z]} castShadow>
          <boxGeometry args={[0.5, totalH, 0.5]} />
          <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      {/* ─── Floor labels (matching dashboard badge style) ─── */}
      {Array.from({ length: floorCount }, (_, i) => {
        const y = podiumH + i * floorH + floorH + 0.8;
        return (
          <Html
            key={`label-${i}`}
            position={[halfW + 1.5, y, 0]}
            center
            style={{ pointerEvents: "none" }}
          >
            <div
              style={{
                background: "white",
                border: "1px solid #c9d6ff",
                borderRadius: "12px",
                padding: "4px 10px",
                color: "#1e4fd8",
                fontSize: "11px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              Level {i + 1}
            </div>
          </Html>
        );
      })}

      {/* ─── Entrance label ─── */}
      <Html
        position={[0, podiumH / 2, halfPodiumD + 3]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            background: "white",
            border: "1px solid #c9d6ff",
            borderRadius: "12px",
            padding: "4px 10px",
            color: "#1e4fd8",
            fontSize: "11px",
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          Main Entrance
        </div>
      </Html>
    </group>
  );
}

// ──────────── Type-specific 3D Marker ────────────
// Each asset type gets a distinct shape so they're easy to identify at a glance.
function AssetMarker({
  asset,
  selected,
  onClick,
}: {
  asset: ViewerAsset;
  selected: boolean;
  onClick: (id: string) => void;
}) {
  const x = asset.positionX ?? 0;
  const y = asset.positionY ?? 0.5;
  const z = asset.positionZ ?? 0;
  const color = STATUS_COLOR[asset.status] ?? STATUS_COLOR.ok;

  // Pick a primitive based on asset type
  const renderShape = () => {
    switch (asset.type) {
      case "ahu":
        return (
          <mesh castShadow>
            <boxGeometry args={[1.6, 1.4, 0.8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.5 : 0.15} />
          </mesh>
        );
      case "chiller":
        return (
          <mesh castShadow>
            <cylinderGeometry args={[0.7, 0.7, 1.6, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.5 : 0.15} />
          </mesh>
        );
      case "boiler":
        return (
          <mesh castShadow>
            <sphereGeometry args={[0.7, 16, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.5 : 0.15} />
          </mesh>
        );
      case "pump":
        return (
          <mesh castShadow>
            <torusGeometry args={[0.4, 0.15, 8, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.5 : 0.15} />
          </mesh>
        );
      case "fan":
        return (
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.4, 0.15, 8, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.5 : 0.15} />
          </mesh>
        );
      case "elevator":
        return (
          <mesh castShadow>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.5 : 0.15} />
          </mesh>
        );
      default:
        return (
          <mesh castShadow>
            <sphereGeometry args={[0.4, 12, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.5 : 0.15} />
          </mesh>
        );
    }
  };

  return (
    <group
      position={[x, y, z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick(asset.id);
      }}
    >
      {renderShape()}

      {/* Pulse ring for critical/offline states */}
      {(asset.status === "critical" || asset.status === "warning") && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.1, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} side={2} />
        </mesh>
      )}

      {/* Selection halo */}
      {selected && (
        <mesh>
          <sphereGeometry args={[1.4, 16, 16]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} />
        </mesh>
      )}

      {/* Label */}
      <Html distanceFactor={8} position={[0, 1.2, 0]} center>
        <div
          className={`px-2 py-1 text-xs rounded whitespace-nowrap pointer-events-none ${
            selected
              ? "bg-blue-600 text-white font-medium"
              : "bg-black/80 text-white"
          }`}
        >
          {friendlyName(asset)}
        </div>
      </Html>
    </group>
  );
}

// ──────────── Status Legend ────────────
function StatusLegend() {
  const entries: Array<{ status: AssetStatus; label: string }> = [
    { status: "ok", label: STATUS_LABEL.ok },
    { status: "warning", label: STATUS_LABEL.warning },
    { status: "critical", label: STATUS_LABEL.critical },
    { status: "offline", label: STATUS_LABEL.offline },
  ];
  return (
    <Html position={[18, 12, 0]} center>
      <div className="bg-black/85 backdrop-blur border border-neutral-700 rounded-lg p-3 pointer-events-none">
        <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2">Status</div>
        <ul className="space-y-1.5">
          {entries.map(({ status, label }) => (
            <li key={status} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: STATUS_COLOR[status] }}
              />
              <span className="text-neutral-200">{label}</span>
            </li>
          ))}
        </ul>
        <div className="text-xs uppercase tracking-wider text-neutral-400 mt-3 mb-1">Asset types</div>
        <ul className="space-y-1 text-xs">
          {Object.entries(TYPE_ICON).slice(0, 5).map(([type, icon]) => (
            <li key={type} className="flex items-center gap-2">
              <span className="w-3 text-center">{icon}</span>
              <span className="text-neutral-200">{TYPE_LABEL[type as AssetType]}</span>
            </li>
          ))}
        </ul>
      </div>
    </Html>
  );
}

// ──────────── Main Component ────────────
export function DigitalTwinViewer({
  assets = [],
  selectedId,
  onSelectAsset,
}: DigitalTwinViewerProps) {
  return (
    <div className="w-full h-[640px] bg-[#f7f9fd] rounded-lg overflow-hidden relative" data-testid="digital-twin-viewer">
      <Canvas
        camera={{ position: [22, 18, 28], fov: 50 }}
        shadows
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          {/* Lighting — tuned for light theme + glass building */}
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[15, 25, 10]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <hemisphereLight args={["#e8eef7", "#94a3b8", 0.6]} />

          {/* Procedural building (includes its own ground plane + grid) */}
          <ProceduralBuilding floorCount={5} />

          {/* Asset markers */}
          {assets.map((a) => (
            <AssetMarker
              key={a.id}
              asset={a}
              selected={selectedId === a.id}
              onClick={onSelectAsset ?? (() => {})}
            />
          ))}

          {/* Legend (top-right) */}
          <StatusLegend />

          <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.2} />
        </Suspense>
      </Canvas>

      {/* Header overlay — dashboard-style white card */}
      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur border border-slate-200 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] px-4 py-2 pointer-events-none">
        <div className="text-xs text-slate-500">Digital Twin</div>
        <div className="text-sm font-medium text-slate-900">
          {assets.length} {assets.length === 1 ? "asset" : "assets"}
        </div>
      </div>

      {/* Controls hint — dashboard-style white card */}
      <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur border border-slate-200 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] px-4 py-2 pointer-events-none text-xs text-slate-500">
        Drag to rotate · Scroll to zoom · Click marker to inspect
      </div>
    </div>
  );
}
