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
  const W = 30; // width
  const D = 24; // depth
  const H = 3.6; // floor height
  const totalH = H * floorCount;
  const halfW = W / 2;
  const halfD = D / 2;
  const cx = 0; // centered
  const cz = 0;

  return (
    <group>
      {/* Main building shell — semi-transparent so we can see through */}
      <mesh position={[cx, totalH / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[W, totalH, D]} />
        <meshStandardMaterial
          color="#1f2937"
          metalness={0.05}
          roughness={0.85}
          transparent
          opacity={0.18}
        />
        <Edges color="#64748b" linewidth={1} />
      </mesh>

      {/* Floor plates — stacked, each one slightly lighter */}
      {Array.from({ length: floorCount }, (_, i) => {
        const y = i * H + H / 2;
        return (
          <mesh key={i} position={[cx, y, cz]} receiveShadow>
            <boxGeometry args={[W, 0.08, D]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#374151" : "#4b5563"}
              metalness={0.1}
              roughness={0.7}
              transparent
              opacity={0.4}
            />
          </mesh>
        );
      })}

      {/* Floor labels — floating HTML above each plate (no font loading needed) */}
      {Array.from({ length: floorCount }, (_, i) => {
        const y = i * H + H + 0.6;
        return (
          <Html
            key={`label-${i}`}
            position={[halfW + 1.2, y, cz]}
            center
            style={{ pointerEvents: "none" }}
          >
            <div className="px-2 py-0.5 text-xs bg-neutral-800/80 text-neutral-300 rounded border border-neutral-700">
              Level {i + 1}
            </div>
          </Html>
        );
      })}

      {/* Roof */}
      <mesh position={[cx, totalH + 0.1, cz]}>
        <boxGeometry args={[W + 0.4, 0.2, D + 0.4]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* Building outline — wireframe edges for clarity */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(W, totalH, D)]} />
        <lineBasicMaterial color="#475569" />
      </lineSegments>
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
    <div className="w-full h-[640px] bg-neutral-900 rounded-lg overflow-hidden relative" data-testid="digital-twin-viewer">
      <Canvas
        camera={{ position: [22, 18, 28], fov: 50 }}
        shadows
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[15, 25, 10]}
            intensity={0.8}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <hemisphereLight args={["#a3b8c8", "#1a1f2e", 0.4]} />

          {/* Ground */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[80, 80]} />
            <meshStandardMaterial color="#0a0e1a" roughness={0.9} />
          </mesh>
          <Grid
            args={[80, 80]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#1f2937"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#374151"
            fadeDistance={60}
            infiniteGrid
            position={[0, 0.01, 0]}
          />

          {/* Procedural building */}
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

      {/* Header overlay */}
      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur border border-neutral-700 rounded px-3 py-2 pointer-events-none">
        <div className="text-xs text-neutral-400">Digital Twin</div>
        <div className="text-sm font-medium text-white">
          {assets.length} {assets.length === 1 ? "asset" : "assets"}
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur border border-neutral-700 rounded px-3 py-2 pointer-events-none text-xs text-neutral-400">
        Drag to rotate · Scroll to zoom · Click marker to inspect
      </div>
    </div>
  );
}
