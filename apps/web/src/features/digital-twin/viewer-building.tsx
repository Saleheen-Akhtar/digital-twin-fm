"use client";

/**
 * Digital Twin FM — Procedural Building (R3F)
 *
 * Convention-centre building with per-floor groups, clickable zones,
 * and interior walkthrough support. Each floor is independently
 * visible/hidden/transparent so the user can explore level by level.
 *
 * Builds from @/design-system/tokens so it stays consistent with
 * the dashboard light theme.
 */

import { useRef, useState, useMemo, type ReactNode } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html, Edges, Grid } from "@react-three/drei";
import * as THREE from "three";
import {
  colors,
  building as B,
} from "@/design-system/tokens";
import type { Asset } from "./viewer-data";
import type { FloorFilter } from "./viewer-store";

// ─── Types ─────────────────────────────────────────────────────────

export interface ZoneData {
  id: string;
  name: string;
  /** [x, z] center of the zone, relative to the floor's origin. */
  cx: number;
  cz: number;
  /** Width (x-axis) and depth (z-axis) of the zone rectangle. */
  w: number;
  d: number;
  /** Optional accent colour; defaults to a subtle blue. */
  color?: string;
}

export interface FloorData {
  level: number;            // 0 = basement, 1 = ground, 2 = upper
  name: string;
  /** Y offset of the floor slab bottom. */
  yBase: number;
  height: number;
  zones: ZoneData[];
}

// ─── Building constants ────────────────────────────────────────────

const W = B.towerW;       // 36
const D = B.towerD;       // 24
const HALF_W = W / 2;
const HALF_D = D / 2;
const SLAB_T = 0.4;
const WALL_T = 0.08;

/**
 * 3-floor building suitable for a convention centre / expo hall.
 * Levels 0–2 mapped from actual Singapore Expo Hall 7 scale.
 */
export const BUILDING_FLOORS: FloorData[] = [
  {
    level: 0,
    name: "Basement",
    yBase: 0,
    height: 6,
    zones: [
      { id: "b1", name: "Loading Dock", cx: -8, cz: -6, w: 10, d: 8, color: "#94a3b8" },
      { id: "b2", name: "Plant Room", cx: 8, cz: -6, w: 10, d: 8, color: "#64748b" },
      { id: "b3", name: "Storage", cx: -8, cz: 6, w: 10, d: 8, color: "#94a3b8" },
      { id: "b4", name: "Service Corridor", cx: 8, cz: 6, w: 10, d: 8, color: "#cbd5e1" },
      { id: "b5", name: "MEP Room", cx: 0, cz: 0, w: 8, d: 8, color: "#64748b" },
    ],
  },
  {
    level: 1,
    name: "Level 1 · Exhibition",
    yBase: 6.5,
    height: 8.5,
    zones: [
      { id: "1a", name: "Main Entrance", cx: 0, cz: -HALF_D + 4, w: 14, d: 6, color: "#3b82f6" },
      { id: "1b", name: "Hall A — West", cx: -10, cz: 2, w: 14, d: 12, color: "#60a5fa" },
      { id: "1c", name: "Hall A — East", cx: 10, cz: 2, w: 14, d: 12, color: "#60a5fa" },
      { id: "1d", name: "Concourse", cx: 0, cz: -4, w: 12, d: 4, color: "#93c5fd" },
      { id: "1e", name: "Restrooms", cx: -HALF_W + 3, cz: 8, w: 4, d: 6, color: "#bfdbfe" },
      { id: "1f", name: "Meeting Rooms", cx: HALF_W - 4, cz: 8, w: 6, d: 6, color: "#bfdbfe" },
    ],
  },
  {
    level: 2,
    name: "Level 2 · Upper Hall",
    yBase: 15.5,
    height: 8.5,
    zones: [
      { id: "2a", name: "Hall B — West", cx: -10, cz: 0, w: 14, d: 14, color: "#a78bfa" },
      { id: "2b", name: "Hall B — East", cx: 10, cz: 0, w: 14, d: 14, color: "#a78bfa" },
      { id: "2c", name: "VIP Lounge", cx: 0, cz: -8, w: 10, d: 6, color: "#c4b5fd" },
      { id: "2d", name: "Terrace", cx: 0, cz: 8, w: 16, d: 6, color: "#ddd6fe" },
      { id: "2e", name: "Control Room", cx: -HALF_W + 4, cz: -6, w: 6, d: 5, color: "#8b5cf6" },
    ],
  },
];

/** Roof parameters (sawtooth, from tokens). */
const ROOF_RIDGES = B.roofRidgeCount;    // 6
const ROOF_RIDGE_H = B.roofRidgeH;       // 3.0
const ROOF_RIDGE_W = W / ROOF_RIDGES;    // 6

// ─── Zone rectangle (clickable) ────────────────────────────────────

interface ZoneBoxProps {
  zone: ZoneData;
  floorY: number;
  floorHeight: number;
  selected: boolean;
  onSelect: (zoneId: string) => void;
}

function ZoneBox({ zone, floorY, floorHeight, selected, onSelect }: ZoneBoxProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const baseColor = zone.color ?? "#3b82f6";
  const yPos = floorY + 0.02; // slightly above the slab

  useFrame(() => {
    if (meshRef.current && hovered) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + 0.08 * Math.sin(Date.now() * 0.004);
    }
  });

  return (
    <group>
      {/* Zone floor highlight */}
      <mesh
        ref={meshRef}
        position={[zone.cx, yPos, zone.cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(zone.id);
        }}
      >
        <planeGeometry args={[zone.w, zone.d]} />
        <meshBasicMaterial
          color={selected ? "#3b82f6" : baseColor}
          transparent
          opacity={hovered || selected ? 0.25 : 0.08}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Zone border */}
      <mesh position={[zone.cx, yPos + 0.01, zone.cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[zone.w, zone.d]} />
        <meshBasicMaterial
          color={selected ? "#3b82f6" : "#1e40af"}
          transparent
          opacity={hovered ? 0.5 : selected ? 0.7 : 0.15}
          wireframe={false}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Zone outline edges */}
      <Edges
        visible={hovered || selected}
        color={selected ? "#3b82f6" : "#1e40af"}
        scale={1}
      >
        <planeGeometry args={[zone.w, zone.d]} />
      </Edges>

      {/* Zone label (above the floor) */}
      {hovered && (
        <Html position={[zone.cx, floorY + 0.5, zone.cz]} center>
          <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 shadow-md pointer-events-none whitespace-nowrap">
            {zone.name}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Floor slab (concrete platform) ────────────────────────────────

function FloorSlab({ y, width = W, depth = D, thickness = SLAB_T, transparent = false }: {
  y: number;
  width?: number;
  depth?: number;
  thickness?: number;
  transparent?: boolean;
}) {
  return (
    <mesh position={[0, y, 0]} receiveShadow>
      <boxGeometry args={[width, thickness, depth]} />
      <meshStandardMaterial
        color={colors.building.slab}
        transparent={transparent}
        opacity={transparent ? 0.15 : 1}
        roughness={0.85}
        metalness={0.05}
      />
    </mesh>
  );
}

// ─── Perimeter walls (semi-transparent for interior visibility) ────

function PerimeterWalls({ floorY, floorHeight, transparent = false }: {
  floorY: number;
  floorHeight: number;
  transparent?: boolean;
}) {
  const wallColor = colors.building.podium;
  const wallOpacity = transparent ? 0.12 : 0.2;
  const h = floorHeight;

  // Front and back walls have the entrance / glass areas
  return (
    <group>
      {/* Front wall (glass-like, more transparent) */}
      <mesh position={[0, floorY + h / 2, HALF_D]} castShadow>
        <boxGeometry args={[W - 2, h - 0.5, WALL_T]} />
        <meshPhysicalMaterial
          color="#5b8fd9"
          transparent
          opacity={0.15}
          roughness={0.05}
          metalness={0.1}
          ior={1.5}
        />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, floorY + h / 2, -HALF_D]} castShadow>
        <boxGeometry args={[W, h - 0.5, WALL_T]} />
        <meshStandardMaterial color={wallColor} transparent opacity={wallOpacity} roughness={0.7} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-HALF_W, floorY + h / 2, 0]} castShadow>
        <boxGeometry args={[WALL_T, h - 0.5, D]} />
        <meshStandardMaterial color={wallColor} transparent opacity={wallOpacity} roughness={0.7} />
      </mesh>
      {/* Right wall */}
      <mesh position={[HALF_W, floorY + h / 2, 0]} castShadow>
        <boxGeometry args={[WALL_T, h - 0.5, D]} />
        <meshStandardMaterial color={wallColor} transparent opacity={wallOpacity} roughness={0.7} />
      </mesh>
    </group>
  );
}

// ─── Structural columns ────────────────────────────────────────────

function Columns({ floorY, floorHeight }: { floorY: number; floorHeight: number }) {
  const colSize = B.columnSize;
  const spacingX = 8;
  const spacingZ = 8;
  const cols = [];

  for (let x = -HALF_W + spacingX; x < HALF_W - 2; x += spacingX) {
    for (let z = -HALF_D + spacingZ; z < HALF_D - 2; z += spacingZ) {
      cols.push(
        <mesh key={`col-${x.toFixed(0)}-${z.toFixed(0)}`} position={[x, floorY + floorHeight / 2, z]} castShadow>
          <boxGeometry args={[colSize, floorHeight, colSize]} />
          <meshStandardMaterial color={colors.building.column} roughness={0.5} metalness={0.3} />
        </mesh>,
      );
    }
  }
  return <>{cols}</>;
}

// ─── Single floor ──────────────────────────────────────────────────

interface FloorProps {
  data: FloorData;
  visible: boolean;
  isolated: boolean;  // true when this is the ONLY visible floor
  selectedZone: string | null;
  onSelectZone: (zoneId: string) => void;
}

function Floor({ data, visible, isolated, selectedZone, onSelectZone }: FloorProps) {
  const { yBase, height, zones } = data;

  // When isolated (other floors hidden), make walls more transparent
  const wallsTransparent = !visible || isolated;

  if (!visible) return null;

  return (
    <group visible={visible}>
      {/* Floor slab */}
      <FloorSlab y={yBase} />
      {/* Ceiling slab (hide when isolated so you can look into this floor) */}
      {!isolated && <FloorSlab y={yBase + height} transparent />}
      {/* Perimeter walls */}
      <PerimeterWalls floorY={yBase} floorHeight={height} transparent={wallsTransparent} />
      {/* Structural columns */}
      <Columns floorY={yBase} floorHeight={height} />
      {/* Zones */}
      {zones.map((zone) => (
        <ZoneBox
          key={zone.id}
          zone={zone}
          floorY={yBase}
          floorHeight={height}
          selected={selectedZone === zone.id}
          onSelect={onSelectZone}
        />
      ))}
      {/* Floor name label (shown at the front edge) */}
      <Html position={[0, yBase + 0.3, HALF_D + 1.2]} center>
        <div
          className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm"
          style={{
            background: "white",
            border: "1px solid #c9d6ff",
            color: "#1e4fd8",
          }}
        >
          {data.name}
        </div>
      </Html>
    </group>
  );
}

// ─── Sawtooth roof ─────────────────────────────────────────────────

function SawtoothRoof({ yBase }: { yBase: number }) {
  const ridges = [];
  const startX = -HALF_W;

  for (let i = 0; i < ROOF_RIDGES; i++) {
    const x = startX + ROOF_RIDGE_W * i + ROOF_RIDGE_W / 2;
    ridges.push(
      <group key={`ridge-${i}`}>
        {/* Slanted face 1 (front) */}
        <mesh position={[x - ROOF_RIDGE_W / 4, yBase, 0]} castShadow>
          <boxGeometry args={[ROOF_RIDGE_W / 2, 0.08, D]} />
          <meshStandardMaterial
            color={colors.building.penthouse}
            roughness={0.6}
            metalness={0.3}
          />
        </mesh>
        {/* Slanted face 2 (back) — lift the front half to create sawtooth */}
        <mesh
          position={[x + ROOF_RIDGE_W / 4, yBase + ROOF_RIDGE_H / 2, 0]}
          rotation={[0, 0, -0.15]}
          castShadow
        >
          <boxGeometry args={[ROOF_RIDGE_W / 2 + 0.3, ROOF_RIDGE_H, 0.08]} />
          <meshStandardMaterial
            color={colors.building.penthouse}
            roughness={0.5}
            metalness={0.4}
          />
        </mesh>
        {/* Vertical glass panel at the front of each ridge */}
        <mesh position={[x, yBase + ROOF_RIDGE_H * 0.4, HALF_D - 0.1]}>
          <boxGeometry args={[0.6, ROOF_RIDGE_H * 0.8, 0.08]} />
          <meshPhysicalMaterial
            color="#5b8fd9"
            transparent
            opacity={0.3}
            roughness={0.05}
            metalness={0.1}
          />
        </mesh>
      </group>,
    );
  }

  return <>{ridges}</>;
}

// ─── Ground plane + grid ───────────────────────────────────────────

function Ground() {
  return (
    <group>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={colors.building.ground} roughness={0.95} metalness={0} />
      </mesh>
      <Grid
        args={[100, 100]}
        cellSize={2}
        cellThickness={0.3}
        cellColor="#d4dce8"
        sectionSize={10}
        sectionThickness={0.6}
        sectionColor="#c2cbdc"
        position={[0, 0.01, 0]}
      />
    </group>
  );
}

// ─── Asset Marker (adapted from old viewer.tsx) ────────────────────

const STATUS_COLORS: Record<string, string> = {
  operational: "#22c55e",
  warning: "#eab308",
  fault: "#ef4444",
};

const STATUS_COLORS_HEX: Record<string, number> = {
  operational: 0x22c55e,
  warning: 0xeab308,
  fault: 0xef4444,
};

export function AssetMarker3D({ asset, selected, onClick }: {
  asset: Asset;
  selected: boolean;
  onClick: (id: string) => void;
}) {
  const color = STATUS_COLORS[asset.status] ?? "#22c55e";
  const hexColor = STATUS_COLORS_HEX[asset.status] ?? 0x22c55e;
  const meshRef = useRef<THREE.Mesh>(null);

  // Map asset (x, z) floor coords to 3D position
  // The asset's x, z are relative to the floor's 0-center (width=D, depth=D coordinate system)
  // In the old viewer, the building was 16x12. Now it's 36x24, so we scale.
  const pos: [number, number, number] = [
    asset.x * (W / 16),     // scale from old 16-wide to new 36-wide
    (BUILDING_FLOORS[asset.floor]?.yBase ?? 6.5) + 0.5,
    asset.z * (D / 12),     // scale from old 12-deep to new 24-deep
  ];

  const renderShape = () => {
    const emissiveIntensity = selected ? 0.5 : 0.15;
    switch (asset.type) {
      case "Air Handler":
        return (
          <mesh ref={meshRef} castShadow>
            <boxGeometry args={[1.6, 1.4, 0.8]} />
            <meshStandardMaterial color={hexColor} emissive={hexColor} emissiveIntensity={emissiveIntensity} />
          </mesh>
        );
      case "Chiller":
        return (
          <mesh ref={meshRef} castShadow>
            <cylinderGeometry args={[0.7, 0.7, 1.6, 12]} />
            <meshStandardMaterial color={hexColor} emissive={hexColor} emissiveIntensity={emissiveIntensity} />
          </mesh>
        );
      case "Boiler":
        return (
          <mesh ref={meshRef} castShadow>
            <sphereGeometry args={[0.7, 16, 16]} />
            <meshStandardMaterial color={hexColor} emissive={hexColor} emissiveIntensity={emissiveIntensity} />
          </mesh>
        );
      case "Pump":
        return (
          <mesh ref={meshRef} castShadow>
            <torusGeometry args={[0.4, 0.15, 8, 16]} />
            <meshStandardMaterial color={hexColor} emissive={hexColor} emissiveIntensity={emissiveIntensity} />
          </mesh>
        );
      case "Fan":
        return (
          <mesh ref={meshRef} castShadow rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.4, 0.15, 8, 16]} />
            <meshStandardMaterial color={hexColor} emissive={hexColor} emissiveIntensity={emissiveIntensity} />
          </mesh>
        );
      default:
        return (
          <mesh ref={meshRef} castShadow>
            <sphereGeometry args={[0.4, 12, 12]} />
            <meshStandardMaterial color={hexColor} emissive={hexColor} emissiveIntensity={emissiveIntensity} />
          </mesh>
        );
    }
  };

  return (
    <group
      position={pos}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick(asset.id);
      }}
    >
      {renderShape()}
      {selected && (
        <mesh>
          <sphereGeometry args={[1.4, 16, 16]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} />
        </mesh>
      )}
      <Html distanceFactor={8} position={[0, 1.2, 0]} center>
        <div
          className={`px-2 py-1 text-xs rounded whitespace-nowrap pointer-events-none ${
            selected ? "bg-blue-600 text-white font-medium" : "bg-black/80 text-white"
          }`}
        >
          {asset.name}
        </div>
      </Html>
    </group>
  );
}

// ─── Main Building Component ───────────────────────────────────────

export interface BuildingProps {
  /** Selected floor ("ALL" to show all, 0/1/2/3 for specific) */
  selectedFloor: FloorFilter;
  /** Selected zone (null = none) */
  selectedZone: string | null;
  /** Called when a zone is clicked */
  onSelectZone: (zoneId: string) => void;
  /** Currently hovered zone info */
  onZoneInfo?: (info: { name: string; floor: string } | null) => void;
  /** Whether walls should be extra transparent (walk mode) */
  walkMode?: boolean;
}

export function Building({ selectedFloor, selectedZone, onSelectZone, walkMode = false }: BuildingProps) {
  const roofY = BUILDING_FLOORS[BUILDING_FLOORS.length - 1].yBase + BUILDING_FLOORS[BUILDING_FLOORS.length - 1].height;

  return (
    <group>
      <Ground />
      {BUILDING_FLOORS.map((floor) => {
        const showFloor = selectedFloor === "ALL" || selectedFloor === floor.level;
        const isolated = selectedFloor !== "ALL" && selectedFloor === floor.level;
        return (
          <Floor
            key={`floor-${floor.level}`}
            data={floor}
            visible={showFloor}
            isolated={isolated || walkMode}
            selectedZone={selectedZone}
            onSelectZone={onSelectZone}
          />
        );
      })}
      {/* Sawtooth roof */}
      <SawtoothRoof yBase={roofY} />
    </group>
  );
}

// Re-export for convenience
export type { FloorFilter };
