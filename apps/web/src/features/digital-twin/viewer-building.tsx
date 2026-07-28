"use client";

/**
 * Digital Twin FM — Procedural Building (R3F)
 *
 * Convention-centre building with per-floor groups, clickable zones,
 * and interior walkthrough support. Each floor is independently
 * visible/hidden/transparent so the user can explore level by level.
 *
 * Types, constants, and pure utilities live in viewer-building-utils.ts
 * so that viewer-3d.tsx can import the small data layer without pulling
 * in this 80 KiB R3F chunk.
 */

import { useRef, useState, useMemo, useEffect } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useViewerStore } from "./viewer-store";
import { Edges, Grid, useGLTF } from "@react-three/drei";
import { Html } from "@react-three/drei";
import {
  colors,
  building as B,
} from "@/design-system/tokens";
import type { Asset } from "./viewer-data";
import type { FloorFilter } from "./viewer-store";
import { RoomInterior } from "./viewer-interior";
import {
  ZoneData,
  FloorData,
  BUILDING_FLOORS,
  W, D, HALF_W, HALF_D, SLAB_T,
  resolveAssetPosition,
  validateFloorPlan,
} from "./viewer-building-utils";

/**
 * Dynamic floor factory — builds N floors for an arbitrary building when
 * the API returns rows but no zones are configured. Used as a fallback so
 * a customer with 5 floors sees 5 clickable floor buttons even before
 * the zone editor is built.
 *
 * Y-stacking: each floor sits `floorH` (8.5m) above the previous, with a
 * 0.5m service gap. Labels follow the convention L1, L2, L3, …, LN.
 */
export function buildDefaultFloors(count: number): FloorData[] {
  const safeCount = Math.max(1, Math.min(count, 64)); // cap at 64 floors
  const result: FloorData[] = [];
  let y = 0;
  for (let i = 0; i < safeCount; i++) {
    const height = 8.5;
    result.push({
      level: i,
      name: `Level ${i + 1}`,
      shortLabel: `L${i + 1}`,
      yBase: y,
      height,
      zones: [],
      rooms: [],
    });
    y += height + 0.5;
  }
  return result;
}

/**
 * Runtime invariant — warns in dev if BUILDING_FLOORS drifts from the
 * canonical tokens. The mismatch was the root cause of "AI says 5
 * floors, model shows 2" reports. In production this is a no-op.
 * NOTE: this only applies to the offline fallback. When the API
 * supplies floors at boot, those override BUILDING_FLOORS.
 */
if (process.env.NODE_ENV !== "production") {
  const expected = 2;
  if (BUILDING_FLOORS.length !== expected) {
    // eslint-disable-next-line no-console
    console.warn(
      `[viewer-building] BUILDING_FLOORS.length (${BUILDING_FLOORS.length}) differs from ` +
        `design-system/tokens.ts building.floorCount (${expected}). ` +
        `Update both, plus packages/db/src/seed.ts BUILDING_FLOOR_COUNT.`,
    );
  }
  // Validate polygon room data for overlap and asset-in-zone
  validateFloorPlan(BUILDING_FLOORS);
}

// ─── Zone rectangle (clickable) ────────────────────────────────────

interface ZoneBoxProps {
  zone: ZoneData;
  floorY: number;
  floorHeight: number;
  selected: boolean;
  onSelect: (zoneId: string) => void;
}

function ZoneBox({ zone, floorY, floorHeight: _floorHeight, selected, onSelect }: ZoneBoxProps) {
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
          opacity={hovered || selected ? 0.35 : 0.18}
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
          opacity={hovered ? 0.55 : selected ? 0.75 : 0.2}
          wireframe={false}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Zone outline edges (always faint, stronger on hover) */}
      <Edges
        visible={true}
        color={selected ? "#3b82f6" : "#94a3b8"}
        scale={1}
      >
        <planeGeometry args={[zone.w, zone.d]} />
      </Edges>

      {/* Zone label — only visible on hover or selection */}
      {(hovered || selected) && (
        <Html position={[zone.cx, floorY + 0.5, zone.cz]} center>
          <div className="relative flex flex-col items-center pointer-events-none">
            {/* small leader tick pointing down to the zone edge */}
            <div className="w-px h-3 bg-slate-300/80" />
            <div className="bg-white/95 backdrop-blur-xl border border-slate-200/70 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm whitespace-nowrap">
              {zone.name}
            </div>
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
    <group>
      {/* Main slab */}
      <mesh position={[0, y, 0]} receiveShadow>
        <boxGeometry args={[width, thickness, depth]} />
        <meshPhysicalMaterial
          color={colors.building.slab}
          transparent={transparent}
          opacity={transparent ? 0.24 : 1}
          roughness={0.55}
          metalness={0}
        />
      </mesh>
      {/* Perimeter edge beam — subtle dark band at slab perimeter */}
      <mesh position={[0, y - thickness / 2 + 0.05, 0]}>
        <boxGeometry args={[width + 0.08, 0.06, 0.06]} />
        <meshPhysicalMaterial color="#8a9baa" roughness={0.5} metalness={0}
          transparent={transparent} opacity={transparent ? 0.25 : 1} />
      </mesh>
      <mesh position={[0, y - thickness / 2 + 0.05, 0]}>
        <boxGeometry args={[0.06, 0.06, depth + 0.08]} />
        <meshStandardMaterial color="#8a9baa" roughness={0.5} metalness={0.3}
          transparent={transparent} opacity={transparent ? 0.25 : 1} />
      </mesh>
    </group>
  );
}

// ─── Exterior facade with panel grid + windows ────────────────────
//
// Solid opaque walls with architectural pilasters, ribbon windows, and
// horizontal cornice bands so the building reads as a real convention-centre
// exterior rather than a transparent wireframe.  In walked/isolation mode
// the facade becomes translucent so the interior remains visible.
//
// Pilaster columns at regular intervals break up the flat surface and give
// the building scale.  Window grids run the full perimeter at each floor.
function ExteriorWalls({ floorY, floorHeight, transparent = false }: {
  floorY: number;
  floorHeight: number;
  transparent?: boolean;
}) {
  const panelColor = "#d6dee8";
  const glassColor = "#88ccee";
  const mullionColor = "#8a9baa";
  const pilasterColor = "#b8c4d0";
  const midBandColor = "#a0b0bb";
  // Solid structural shell for the overview; fade only during floor isolation.
  const baseOpacity = transparent ? 0.22 : 0.82;
  const h = floorHeight;
  const halfW = W / 2;
  const halfD = D / 2;
  const wallThick = 0.12;
  const inset = 0.2;

  // Shared frosted-glass physical material — clean, BMS-style translucent panels
  const frostedMat = new THREE.MeshPhysicalMaterial({
    color: panelColor,
    roughness: 0.15,
    metalness: 0,
    transparent: true,
    opacity: baseOpacity,
    transmission: transparent ? 0.45 : 0.08,
    thickness: 1.2,
    ior: 1.4,
    envMapIntensity: 0.4,
  });

  // Helper: vertical pilaster at (x, z) spanning floor
  const PilasterComp = ({ x, z }: { x: number; z: number }) => (
    <mesh position={[x, floorY + h / 2, z]} castShadow>
      <boxGeometry args={[0.2, h - 0.2, 0.2]} />
      <meshPhysicalMaterial
        color={pilasterColor}
        roughness={0.2}
        metalness={0}
        transparent
        opacity={Math.min(baseOpacity + 0.1, 1)}
      />
    </mesh>
  );

  return (
    <group>
      {/* ══ Frosted glass wall panels ══ */}

      {/* Back wall (z = -halfD) */}
      <mesh position={[0, floorY + h / 2, -halfD]} castShadow material={frostedMat}>
        <boxGeometry args={[W - inset * 2, h - 0.2, wallThick]} />
      </mesh>

      {/* Left wall (x = -halfW) */}
      <mesh position={[-halfW, floorY + h / 2, 0]} castShadow material={frostedMat}>
        <boxGeometry args={[wallThick, h - 0.2, D - inset * 2]} />
      </mesh>

      {/* Right wall (x = +halfW) */}
      <mesh position={[halfW, floorY + h / 2, 0]} castShadow material={frostedMat}>
        <boxGeometry args={[wallThick, h - 0.2, D - inset * 2]} />
      </mesh>

      {/* Front wall lower band (bottom 40%) */}
      <mesh position={[0, floorY + h * 0.2, halfD]} castShadow material={frostedMat}>
        <boxGeometry args={[W - inset * 2, h * 0.4, wallThick]} />
      </mesh>

      {/* ══ Mid-floor horizontal band (cornice) ══ */}
      <mesh position={[0, floorY + h * 0.42, halfD]}>
        <boxGeometry args={[W - 0.2, 0.08, 0.18]} />
        <meshPhysicalMaterial color={midBandColor} roughness={0.3} metalness={0}
          transparent opacity={Math.min(baseOpacity + 0.15, 0.5)} />
      </mesh>
      <mesh position={[0, floorY + h * 0.42, -halfD]}>
        <boxGeometry args={[W - 0.2, 0.08, 0.18]} />
        <meshPhysicalMaterial color={midBandColor} roughness={0.3} metalness={0}
          transparent opacity={Math.min(baseOpacity + 0.15, 0.5)} />
      </mesh>
      {[-halfW, 0, halfW].map((px, i) => (
        px !== 0 && (
          <mesh key={`mb-side-${i}`} position={[px, floorY + h * 0.42, 0]}>
            <boxGeometry args={[0.18, 0.08, D - 0.2]} />
            <meshPhysicalMaterial color={midBandColor} roughness={0.3} metalness={0}
              transparent opacity={Math.min(baseOpacity + 0.15, 0.5)} />
          </mesh>
        )
      ))}

      {/* ══ Front facade — tall glass panel (upper 55%) ══ */}
      <mesh position={[0, floorY + h * 0.67, halfD - 0.04]}>
        <boxGeometry args={[W - 1.2, h * 0.55, 0.03]} />
        <meshPhysicalMaterial
          color={glassColor}
          transparent opacity={transparent ? 0.12 : 0.42}
          roughness={0.05} metalness={0}
          clearcoat={0.3} clearcoatRoughness={0.2}
          transmission={transparent ? 0.55 : 0.22}
          thickness={0.5} ior={1.5}
          envMapIntensity={transparent ? 0.2 : 0.5}
        />
      </mesh>

      {/* ══ Warm window emission glow behind front glass ══ */}
      {Array.from({ length: 6 }, (_, i) => -halfW + 4 + i * 5.6).map((x) => (
        <mesh key={`wglow-${x.toFixed(1)}`} position={[x, floorY + h * 0.67, halfD - 0.08]}>
          <planeGeometry args={[4.0, h * 0.45]} />
          <meshBasicMaterial color="#ffecd2" transparent opacity={0.12} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}

      {/* ══ Front facade — vertical mullions ══ */}
      {Array.from({ length: 8 }, (_, i) => -halfW + 3.6 + i * 4.2).map((x) => (
        <mesh key={`vm-${x.toFixed(1)}`} position={[x, floorY + h * 0.67, halfD - 0.01]}>
          <boxGeometry args={[0.05, h * 0.6, 0.02]} />
          <meshPhysicalMaterial color={mullionColor} roughness={0.4} metalness={0} />
        </mesh>
      ))}

      {/* ══ Front facade — horizontal mullions (transoms) ══ */}
      {Array.from({ length: 3 }, (_, i) => floorY + h * 0.3 + i * h * 0.27).map((y) => (
        <mesh key={`hm-${y.toFixed(1)}`} position={[0, y, halfD - 0.01]}>
          <boxGeometry args={[W - 0.8, 0.035, 0.02]} />
          <meshPhysicalMaterial color={mullionColor} roughness={0.4} metalness={0} />
        </mesh>
      ))}

      {/* ══ Side-wall window grids (back / left / right) ══ */}
      {/* Each side gets 4 evenly spaced tall window panes */}
      {Array.from({ length: 4 }, (_, i) => {
        const gap = W / 5;
        const wx = -halfW + gap + i * gap;
        return (
          <mesh key={`sw-${wx.toFixed(1)}`} position={[wx, floorY + h * 0.6, -halfD - 0.02]}>
            <planeGeometry args={[1.8, h * 0.4]} />
            <meshPhysicalMaterial color={glassColor} transparent opacity={transparent ? 0.12 : 0.34}
              roughness={0.1} metalness={0} clearcoat={0.2} clearcoatRoughness={0.3}
              transmission={transparent ? 0.55 : 0.18} thickness={0.5} ior={1.5}
              envMapIntensity={0.3} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
      {Array.from({ length: 4 }, (_, i) => {
        const gap = D / 5;
        const wz = -halfD + gap + i * gap;
        return (
          <mesh key={`lw-${wz.toFixed(1)}`} position={[-halfW - 0.02, floorY + h * 0.6, wz]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[1.8, h * 0.4]} />
            <meshPhysicalMaterial color={glassColor} transparent opacity={transparent ? 0.12 : 0.34}
              roughness={0.1} metalness={0} clearcoat={0.2} clearcoatRoughness={0.3}
              transmission={transparent ? 0.55 : 0.18} thickness={0.5} ior={1.5}
              envMapIntensity={0.3} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
      {Array.from({ length: 4 }, (_, i) => {
        const gap = D / 5;
        const wz = -halfD + gap + i * gap;
        return (
          <mesh key={`rw-${wz.toFixed(1)}`} position={[halfW + 0.02, floorY + h * 0.6, wz]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[1.8, h * 0.4]} />
            <meshPhysicalMaterial color={glassColor} transparent opacity={transparent ? 0.12 : 0.34}
              roughness={0.1} metalness={0} clearcoat={0.2} clearcoatRoughness={0.3}
              transmission={transparent ? 0.55 : 0.18} thickness={0.5} ior={1.5}
              envMapIntensity={0.3} side={THREE.DoubleSide} />
          </mesh>
        );
      })}

      {/* ══ Vertical pilasters (extruded facade columns) ══ */}
      {/* Front face: 6 pilasters evenly spaced */}
      {Array.from({ length: 6 }, (_, i) => -halfW + 2.5 + i * 6.2).filter(x => x > -halfW + 1 && x < halfW - 1).map((x) => (
        <PilasterComp key={`pil-f-${x.toFixed(1)}`} x={x} z={halfD + 0.04} />
      ))}
      {/* Back face: 4 pilasters */}
      {Array.from({ length: 4 }, (_, i) => -halfW + 3 + i * 8).filter(x => x > -halfW + 1 && x < halfW - 1).map((x) => (
        <PilasterComp key={`pil-b-${x.toFixed(1)}`} x={x} z={-halfD - 0.04} />
      ))}
      {/* Side pilasters */}
      {[-halfW, halfW].map((fx) => (
        [0, 0].map((_, si) => (
          <PilasterComp key={`pil-s-${fx.toFixed(0)}-${si}`} x={fx + (fx < 0 ? -0.04 : 0.04)} z={-halfD + 3 + si * (D - 6)} />
        ))
      ))}

      {/* ══ Corner edge trim — dark vertical corners so the box reads cleanly ══ */}
      {[
        [-halfW, -halfD],
        [-halfW, halfD],
        [halfW, -halfD],
        [halfW, halfD],
      ].map(([cx, cz], i) => (
        <mesh key={`corner-${i}`} position={[cx, floorY + h / 2, cz]} castShadow>
          <boxGeometry args={[0.08, h - 0.2, 0.08]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.7} />
        </mesh>
      ))}

      {/* ══ Horizontal trim bands (fascia) — bottom + top ══ */}
      {[floorY + 0.1, floorY + h - 0.1].flatMap((y) => [
        <mesh key={`trim-bot-${y}`} position={[0, y, halfD + 0.01]}>
          <boxGeometry args={[W + 0.2, 0.1, 0.08]} />
          <meshStandardMaterial color="#5a6b7c" roughness={0.3} metalness={0.5} />
        </mesh>,
        <mesh key={`trim-bot-${y}-b`} position={[0, y, -halfD - 0.01]}>
          <boxGeometry args={[W + 0.2, 0.1, 0.08]} />
          <meshStandardMaterial color="#5a6b7c" roughness={0.3} metalness={0.5} />
        </mesh>,
        <mesh key={`trim-bot-${y}-l`} position={[-halfW - 0.01, y, 0]}>
          <boxGeometry args={[0.08, 0.1, D + 0.2]} />
          <meshStandardMaterial color="#5a6b7c" roughness={0.3} metalness={0.5} />
        </mesh>,
        <mesh key={`trim-bot-${y}-r`} position={[halfW + 0.01, y, 0]}>
          <boxGeometry args={[0.08, 0.1, D + 0.2]} />
          <meshStandardMaterial color="#5a6b7c" roughness={0.3} metalness={0.5} />
        </mesh>,
      ])}
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
  showFacade: boolean;
  showFurniture: boolean;
  showMEP: boolean;
  showZones: boolean;
  showMarkers: boolean;
}

function Floor({
  data,
  visible,
  isolated,
  selectedZone,
  onSelectZone,
  showFacade,
  showFurniture,
  showMEP,
  showZones,
  showMarkers,
}: FloorProps) {
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
      {/* Exterior facade */}
      {showFacade && (
        <ExteriorWalls floorY={yBase} floorHeight={height} transparent={wallsTransparent} />
      )}
      {/* Structural columns */}
      <Columns floorY={yBase} floorHeight={height} />
      {/* Zones */}
      {showZones &&
        zones.map((zone) => (
          <ZoneBox
            key={zone.id}
            zone={zone}
            floorY={yBase}
            floorHeight={height}
            selected={selectedZone === zone.id}
            onSelect={onSelectZone}
          />
        ))}

      {/* Room Interiors & MEP */}
      {zones.map((zone) => (
        <RoomInterior
          key={`interior-${zone.id}`}
          floorLevel={data.level}
          zoneId={zone.id}
          cx={zone.cx}
          cz={zone.cz}
          w={zone.w}
          d={zone.d}
          floorY={yBase}
          floorHeight={height}
          showFurniture={showFurniture}
          showMEP={showMEP}
          showFacade={showFacade}
        />
      ))}

      {/* Terrace glass railings (zone 2d, upper mezzanine only) */}
      {data.level === 1 && zones.some((z) => z.id === "2d") && (() => {
        const tz = zones.find((z) => z.id === "2d")!;
        const railY = yBase + 0.6;
        const railH = 1.1;
        return (
          <group>
            {/* Front railing */}
            <mesh position={[tz.cx, railY, tz.cz + tz.d / 2]}>
              <boxGeometry args={[tz.w, railH, 0.04]} />
              <meshPhysicalMaterial color="#8fbfe8" transparent opacity={0.25} roughness={0.05} metalness={0.9} transmission={0.7} thickness={0.2} />
            </mesh>
            {/* Left railing */}
            <mesh position={[tz.cx - tz.w / 2, railY, tz.cz]}>
              <boxGeometry args={[0.04, railH, tz.d]} />
              <meshPhysicalMaterial color="#8fbfe8" transparent opacity={0.25} roughness={0.05} metalness={0.9} transmission={0.7} thickness={0.2} />
            </mesh>
            {/* Right railing */}
            <mesh position={[tz.cx + tz.w / 2, railY, tz.cz]}>
              <boxGeometry args={[0.04, railH, tz.d]} />
              <meshPhysicalMaterial color="#8fbfe8" transparent opacity={0.25} roughness={0.05} metalness={0.9} transmission={0.7} thickness={0.2} />
            </mesh>
            {/* Railing top rail (metal cap) */}
            <mesh position={[tz.cx, railY + railH / 2, tz.cz + tz.d / 2]}>
              <boxGeometry args={[tz.w + 0.1, 0.05, 0.06]} />
              <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.7} />
            </mesh>
            <mesh position={[tz.cx - tz.w / 2, railY + railH / 2, tz.cz]}>
              <boxGeometry args={[0.06, 0.05, tz.d + 0.1]} />
              <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.7} />
            </mesh>
            <mesh position={[tz.cx + tz.w / 2, railY + railH / 2, tz.cz]}>
              <boxGeometry args={[0.06, 0.05, tz.d + 0.1]} />
              <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.7} />
            </mesh>
          </group>
        );
      })()}

      {/* Floor name label (shown at the front-left corner) */}
      {showMarkers && (
        <Html position={[-HALF_W - 2.5, yBase + 0.4, HALF_D - 2]} center>
          <div
          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wide whitespace-nowrap shadow-sm border transition-all"
          style={{
            background: "rgba(255, 255, 255, 0.9)",
            borderColor: "#c9d6ff",
            color: "#1e4fd8",
            backdropFilter: "blur(4px)",
          }}
        >
          {data.name}
        </div>
      </Html>
      )}
    </group>
  );
}

// ─── Sawtooth roof ─────────────────────────────────────────────────

function SawtoothRoof({ yBase }: { yBase: number }) {
  // Clean flat roof slab with subtle edge relief and equipment pad
  return (
    <group position={[0, yBase, 0]}>
      {/* Main roof slab */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[W + 0.2, 0.12, D + 0.2]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} metalness={0.05} />
      </mesh>
      {/* Roof surface texture — slightly lighter pad area */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[W - 0.5, 0.04, D - 0.5]} />
        <meshStandardMaterial color="#d1d9e6" roughness={0.85} metalness={0} />
      </mesh>
      {/* Equipment pad / darker strip */}
      <mesh position={[0, 0.12, D * 0.2]}>
        <boxGeometry args={[W * 0.6, 0.03, D * 0.3]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.8} metalness={0} />
      </mesh>
    </group>
  );
}

// ─── Ground plane + grid ───────────────────────────────────────────

function Ground() {
  return (
    <group>
      {/* Main ground plane — 90×90 with subtle colour gradient (two concentric quads) */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color="#e2e8ed" roughness={0.95} metalness={0} />
      </mesh>
      <Grid
        args={[86, 86]}
        cellSize={4}
        cellThickness={0.15}
        cellColor="#d6dee5"
        sectionSize={20}
        sectionThickness={0.3}
        sectionColor="#c8d0db"
        position={[0, 0.005, 0]}
      />
      {/* Building pad — lighter apron directly under the footprint */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[42, 30]} />
        <meshStandardMaterial color="#d1dbe5" roughness={0.9} metalness={0} />
      </mesh>

      {/* ── Access road across the front ── */}
      <mesh position={[0, -0.008, HALF_D + 12]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[52, 7]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.92} metalness={0} />
      </mesh>
      {/* Road centre line */}
      <mesh position={[0, -0.006, HALF_D + 12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 0.1]} />
        <meshBasicMaterial color="#e5e7eb" transparent opacity={0.4} toneMapped={false} />
      </mesh>
      {/* Road edge lines */}
      {[-25, 25].map((x) => (
        <mesh key={`road-edge-${x}`} position={[x, -0.006, HALF_D + 12]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.15, 6.8]} />
          <meshBasicMaterial color="#f3f4f6" transparent opacity={0.3} toneMapped={false} />
        </mesh>
      ))}

      {/* Pedestrian pathway from entrance extending to road */}
      <mesh position={[0, -0.005, HALF_D + 6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3, 12]} />
        <meshStandardMaterial color="#c8d0db" roughness={0.85} metalness={0} />
      </mesh>
      {/* Pathway edge lines */}
      {[-1.5, 1.5].map((x) => (
        <mesh key={`path-edge-${x}`} position={[x, -0.003, HALF_D + 6]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 12]} />
          <meshBasicMaterial color="#d1d5db" toneMapped={false} />
        </mesh>
      ))}

      {/* Hedges along the pathway */}
      {[-1, 0, 1].map((i) => (
        <group key={`hedge-pair-${i}`}>
          <mesh position={[-2, 0.2, HALF_D + 2 + i * 3]} castShadow>
            <boxGeometry args={[0.5, 0.35, 1.2]} />
            <meshStandardMaterial color="#15803d" roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh position={[2, 0.2, HALF_D + 2 + i * 3]} castShadow>
            <boxGeometry args={[0.5, 0.35, 1.2]} />
            <meshStandardMaterial color="#15803d" roughness={0.85} metalness={0.05} />
          </mesh>
        </group>
      ))}

      {/* Parking lot area (left side) with defined layout */}
      <mesh position={[-HALF_W - 9, -0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 20]} />
        <meshStandardMaterial color="#a0adb9" roughness={0.92} metalness={0} />
      </mesh>
      {/* Parking lot curb/paint edge */}
      <mesh position={[-HALF_W - 9, -0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12.2, 20.2]} />
        <meshBasicMaterial color="#e5e7eb" transparent opacity={0.15} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* Parking lot individual stall markings */}
      {Array.from({ length: 6 }, (_, i) => -7 + i * 3).map((z) => (
        <mesh key={`pline-${z}`} position={[-HALF_W - 9, -0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 0.08]} />
          <meshBasicMaterial color="#e5e7eb" toneMapped={false} />
        </mesh>
      ))}
      {/* Parking lot centre lane */}
      <mesh position={[-HALF_W - 9, -0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.1, 18]} />
        <meshBasicMaterial color="#d1d5db" transparent opacity={0.4} toneMapped={false} />
      </mesh>

      {/* Streetlights (simple poles at the front) */}
      {[-16, 16].map((x) => (
        <group key={`light-${x}`}>
          <mesh position={[x, 0, HALF_D + 9]} castShadow>
            <cylinderGeometry args={[0.07, 0.09, 5.5, 8]} />
            <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[x, 5.6, HALF_D + 9]} castShadow>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#d1d5db" emissive="#fef3c7" emissiveIntensity={0.15} roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[x, 5.5, HALF_D + 9]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.02, 0.5, 0.02]} />
            <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Entrance canopy (front door feature) ─────────────────────────

function EntranceCanopy({ yBase, showMarkers }: { yBase: number; showMarkers: boolean }) {
  return (
    <group position={[0, yBase, HALF_D]}>
      {/* Canopy roof — wider/deeper than before */}
      <mesh position={[0, 3.8, 4]} castShadow>
        <boxGeometry args={[18, 0.1, 7]} />
        <meshStandardMaterial color="#8899aa" roughness={0.35} metalness={0.55} />
      </mesh>
      {/* Canopy roof edge trim */}
      <mesh position={[0, 3.8, 4.1]}>
        <boxGeometry args={[18.2, 0.04, 0.15]} />
        <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Canopy underside panel (soffit) */}
      <mesh position={[0, 3.75, 4]}>
        <boxGeometry args={[16, 0.03, 6.5]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Support columns — 4 instead of 2 */}
      {[-7, -3, 3, 7].map((x) => (
        <mesh key={`canopy-col-${x}`} position={[x, 1.9, 4]} castShadow>
          <cylinderGeometry args={[0.1, 0.13, 3.6, 8]} />
          <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.5} />
        </mesh>
      ))}

      {/* Glass panels between supports */}
      <mesh position={[0, 2.0, 3.9]}>
        <boxGeometry args={[14, 3.2, 0.02]} />
        <meshPhysicalMaterial
          color="#8fbfe8"
          transparent
          opacity={0.25}
          roughness={0.05}
          metalness={0.9}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          transmission={0.75}
          thickness={0.3}
          ior={1.5}
        />
      </mesh>

      {/* Glass panel mullions (vertical) */}
      {[-6, -2, 2, 6].map((x) => (
        <mesh key={`entrance-mullion-${x}`} position={[x, 2.0, 3.92]}>
          <boxGeometry args={[0.04, 3.4, 0.01]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.5} />
        </mesh>
      ))}

      {/* Side walls flanking the entrance */}
      <mesh position={[-8.5, 2.0, 3.2]}>
        <boxGeometry args={[0.12, 4.0, 5]} />
        <meshStandardMaterial color="#b0bec5" roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[8.5, 2.0, 3.2]}>
        <boxGeometry args={[0.12, 4.0, 5]} />
        <meshStandardMaterial color="#b0bec5" roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Entrance doorway recess — darker panel at ingress */}
      <mesh position={[0, 2.0, 3.7]}>
        <boxGeometry args={[3.5, 3.0, 0.08]} />
        <meshPhysicalMaterial
          color="#1e293b"
          roughness={0.3}
          metalness={0.4}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Warm light from inside the entrance */}
      <mesh position={[0, 2.0, 3.65]}>
        <planeGeometry args={[3.0, 2.5]} />
        <meshBasicMaterial color="#fef3c7" transparent opacity={0.25} toneMapped={false} />
      </mesh>

      {/* Building signage */}
      {showMarkers && (
        <Html position={[0, 4.0, 4.2]} center transform>
          <div
            className="pointer-events-none whitespace-nowrap"
            style={{
              fontSize: "16px",
              fontWeight: 800,
              letterSpacing: "0.3em",
              color: "#1e3a5f",
              textShadow: "0 2px 6px rgba(0,0,0,0.2)",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            DIGITAL TWIN FM
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Rooftop equipment (HVAC, vents) ───────────────────────────────

function SpinningFan({ position }: { position: [number, number, number] }) {
  const fanRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (fanRef.current) {
      fanRef.current.rotation.y = state.clock.getElapsedTime() * 4.0;
    }
  });
  return (
    <group position={position}>
      {/* Fan casing */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.4, 0.42, 0.08, 12]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* Rotating blades */}
      <mesh ref={fanRef} position={[0, 0.08, 0]}>
        <boxGeometry args={[0.7, 0.01, 0.08]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.8} />
      </mesh>
    </group>
  );
}

function RooftopEquipment({ yBase }: { yBase: number }) {
  const units = [
    { x: -10, z: -8, w: 3, d: 2.5, h: 1.6, color: "#94a3b8", fans: [[-0.6, 0.8, 0], [0.6, 0.8, 0]] },
    { x: -3, z: -8, w: 3, d: 2.5, h: 1.4, color: "#94a3b8", fans: [[0, 0.7, 0]] },
    { x: 4, z: -8, w: 2.5, d: 2.5, h: 1.8, color: "#94a3b8", fans: [[-0.5, 0.9, -0.5], [0.5, 0.9, 0.5]] },
    { x: 11, z: -8, w: 2, d: 2.5, h: 1.5, color: "#94a3b8", fans: [] },
    { x: -8, z: 8, w: 2.5, d: 2, h: 1.2, color: "#a8b5c8", fans: [[0, 0.6, 0]] },
    { x: 8, z: 8, w: 3.5, d: 2, h: 1.3, color: "#a8b5c8", fans: [[-0.8, 0.65, 0], [0.8, 0.65, 0]] },
  ];

  return (
    <group position={[0, yBase, 0]}>
      {units.map((u, i) => (
        <group key={`rooftop-${i}`} position={[u.x, 0, u.z]}>
          <mesh position={[0, u.h / 2, 0]} castShadow>
            <boxGeometry args={[u.w, u.h, u.d]} />
            <meshStandardMaterial color={u.color} roughness={0.6} metalness={0.2} />
          </mesh>
          {/* Vents or spinning fans */}
          {u.fans.length > 0 ? (
            u.fans.map((fanPos, idx) => (
              <SpinningFan key={`fan-${idx}`} position={[fanPos[0], u.h / 2 + fanPos[1], fanPos[2]] as [number, number, number]} />
            ))
          ) : (
            <mesh position={[0, u.h + 0.08, 0]}>
              <boxGeometry args={[u.w * 0.6, 0.05, u.d * 0.6]} />
              <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.3} />
            </mesh>
          )}
        </group>
      ))}
      {/* Exhaust vent pipes */}
      {[
        { x: -12, z: 0, h: 2.0 },
        { x: 13, z: 0, h: 1.8 },
      ].map((p, i) => (
        <mesh key={`vent-${i}`} position={[p.x, p.h / 2, p.z]}>
          <cylinderGeometry args={[0.2, 0.25, p.h, 8]} />
          <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Parapet / roof edge detail ────────────────────────────────────

function RoofParapet({ yBase }: { yBase: number }) {
  return (
    <group position={[0, yBase, 0]}>
      {/* Front edge */}
      <mesh position={[0, 0.5, HALF_D]}>
        <boxGeometry args={[W + 0.4, 0.5, 0.15]} />
        <meshStandardMaterial color="#a8b5c8" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Back edge */}
      <mesh position={[0, 0.5, -HALF_D]}>
        <boxGeometry args={[W + 0.4, 0.5, 0.15]} />
        <meshStandardMaterial color="#a8b5c8" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Left edge */}
      <mesh position={[-HALF_W, 0.5, 0]}>
        <boxGeometry args={[0.15, 0.5, D + 0.4]} />
        <meshStandardMaterial color="#a8b5c8" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Right edge */}
      <mesh position={[HALF_W, 0.5, 0]}>
        <boxGeometry args={[0.15, 0.5, D + 0.4]} />
        <meshStandardMaterial color="#a8b5c8" roughness={0.6} metalness={0.2} />
      </mesh>
    </group>
  );
}

// ─── Asset Marker ───────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ok: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
  offline: "#737373",
  info: "#3b82f6",
};

const STATUS_COLORS_HEX: Record<string, number> = {
  ok: 0x22c55e,
  warning: 0xf59e0b,
  critical: 0xef4444,
  offline: 0x737373,
  info: 0x3b82f6,
};

// Map an asset's viewer type → how its beacon pole should be drawn so the
// marker reads as physically mounted (grounded floor unit vs hanging ceiling
// fixture vs full-height feature) rather than a floating 3-unit flagpole.
// `length` = pole height (base planted on the slab at y=0);
// `sphereOffset` = orb height above the slab. Floor kit (chiller/boiler/
// pump) sits low & grounded; ceiling kit (AHU/fan/lighting) hangs its orb
// up near the ceiling; elevator gets a tall feature column.
function getPoleStyle(type: string): { length: number; sphereOffset: number } {
  switch (type) {
    case "Chiller":
    case "Boiler":
    case "Pump":
      // Floor-mounted plant — short grounded stub, orb just above the unit.
      return { length: 0.9, sphereOffset: 0.7 };
    case "Air Handler":
    case "Fan":
    case "Lighting":
      // Ceiling-mounted — tall thin pole up to the ceiling, orb near the top.
      return { length: 0.55, sphereOffset: -0.55 };
    case "Elevator":
      // Full-height feature: tall, glowing column.
      return { length: 4.5, sphereOffset: 3.5 };
    default:
      return { length: 1.4, sphereOffset: 1.0 };
  }
}

export function AssetMarker3D({ asset, selected, onClick, layoutOverride, floorY, onGroupRef }: {
  asset: Asset;
  selected: boolean;
  onClick: (id: string) => void;
  layoutOverride?: { x: number; z: number } | null;
  /** World Y of the asset's floor slab (for ceiling-mounted leader disc). */
  floorY?: number;
  /** Called with the Three.js group ref when the marker mounts. */
  onGroupRef?: (group: THREE.Group) => void;
}) {
  const hexColor = STATUS_COLORS_HEX[asset.status] ?? 0x22c55e;
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const alertRingRef = useRef<THREE.Mesh>(null);
  const hasAlert = useViewerStore((s) => s.activeAlertAssets.has(asset.id));

  // Expose the group ref to the parent (for TransformControls)
  useEffect(() => {
    if (groupRef.current) onGroupRef?.(groupRef.current);
  }, [onGroupRef]);
  // Pole geometry keyed by mounted type (floor stub / ceiling hang / full-height).
  const pole = getPoleStyle(asset.type);

  // SVG icons for each asset type
  const assetIcon = useMemo(() => {
    const icons: Record<string, string> = {
      "Air Handler": `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="6"/><path d="M12 6v4m0 4v4M6 12h4m4 0h4"/><path d="M6 6l3 3M18 6l-3 3M6 18l3-3M18 18l-3-3"/></svg>`,
      Chiller: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 12h-4l-2-3-2 3-2-3-2 3H4"/><path d="M12 2v8m0 4v8"/><path d="M4 12v2m16-2v2"/></svg>`,
      Boiler: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 3c.5 3 2 5 4 7a6 6 0 0 1-8 0c2-2 3.5-4 4-7z"/><path d="M8 12a4 4 0 0 0 8 0"/><rect x="6" y="14" width="12" height="6" rx="1"/><line x1="6" y1="17" x2="18" y2="17"/></svg>`,
      Pump: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3c0 1.5 1 2.5 3 5 2-2.5 3-3.5 3-5a3 3 0 0 0-3-3z"/><path d="M7 20h10"/><path d="M9 20v2"/><path d="M15 20v2"/><line x1="12" y1="14" x2="12" y2="20"/></svg>`,
      Fan: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 8C14 4 16 2 16 2s-1 3-4 6"/><path d="M12 16c2 4 4 6 4 6s-1-3-4-6"/><path d="M8 12C4 10 2 8 2 8s3 1 6 4"/><path d="M16 12c4 2 6 4 6 4s-3-1-6-4"/></svg>`,
      Elevator: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="2" width="18" height="20" rx="2"/><path d="M9 6l2 2-2 2M15 18l-2-2 2-2"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="15" y1="10" x2="9" y2="10"/></svg>`,
      Lighting: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15 14H9l1-2h4l1 2z"/><path d="M12 2a5 5 0 0 0-4 8c0 2 1 3 1 3h6s1-1 1-3a5 5 0 0 0-4-8z"/></svg>`,
      Sensor: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/><path d="M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M19.78 4.22l-2.83 2.83m-9.9 9.9l-2.83 2.83"/></svg>`,
    };
    return icons[asset.type] ?? `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>`;
  }, [asset.type]);

  // Status disc with the asset's real equipment emoji baked on top.
  // Replaces the old plain coloured dot so markers read as actual kit,
  // not placeholder blobs. White glyph on the status-colored disc.
  const iconTexture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    // Solid status-coloured disc
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = `#${hexColor.toString(16).padStart(6, "0")}`;
    ctx.fill();
    // Subtle rim for legibility against bright scenes
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke();
    // Equipment glyph (emoji) centred
    ctx.font = `${Math.floor(size * 0.6)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(asset.emoji, size / 2, size / 2 + size * 0.04);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }, [hexColor, asset.emoji]);

  // Gentle pulse animation based on status
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.getElapsedTime();
      const pulseSpeed = asset.status === "critical" ? 3.5 : 1.8;
      const pulseAmp = asset.status === "critical" ? 0.12 : 0.05;
      const baseScale = selected ? 1.2 : 1.0;
      const scale = baseScale + Math.sin(t * pulseSpeed) * pulseAmp;
      groupRef.current.scale.set(scale, scale, scale);

      // Wobble if critical!
      if (asset.status === "critical") {
        groupRef.current.rotation.y = Math.sin(t * 14.0) * 0.08;
        groupRef.current.rotation.z = Math.cos(t * 14.0) * 0.06;
      } else {
        groupRef.current.rotation.set(0, 0, 0);
      }
    }

    // Alert ring pulse animation
    if (alertRingRef.current && hasAlert) {
      const t = state.clock.getElapsedTime();
      // Fast, dramatic pulse for alerts
      const pulse = 0.5 + 0.5 * Math.sin(t * 4.0);
      alertRingRef.current.scale.setScalar(1 + pulse * 0.3);
      const mat = alertRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + pulse * 0.5;
    }
  });

  // Map asset (x, y, z) floor coords to 3D position — clamped to room polygon.
  // `layoutOverride` (from resolveFloorLayout) applies the min-distance
  // resampling so markers never overlap.
  const resolved = resolveAssetPosition(
    layoutOverride
      ? { ...asset, x: layoutOverride.x, z: layoutOverride.z }
      : asset,
    BUILDING_FLOORS,
  );
  const pos: [number, number, number] = [resolved.x, resolved.y, resolved.z];

  // Status condition badge color
  const conditionRingColor = STATUS_COLORS[asset.status] ?? "#22c55e";
  const conditionRingOpacity = asset.status === "offline" ? 0.25 : 0.55;
  const showConditionGlow = asset.status === "critical" || asset.status === "warning";
  const ceilingMounted = asset.type === "Air Handler" || asset.type === "Fan" || asset.type === "Lighting";
  // Fallback floorY (asset.floor → BUILDING_FLOORS) so a ceiling-mounted
  // marker can still drop a leader disc onto its own floor slab even if the
  // caller didn't pass floorY explicitly.
  const resolvedFloorY = floorY ?? BUILDING_FLOORS[asset.floor]?.yBase ?? 0;

  // Soft radial-gradient "contact shadow" disc — grounds the marker to a
  // floor plane independent of the global <ContactShadows> (which only
  // catches shadows within 5u of world y=0). Dark neutral center fading to
  // transparent, baked once on a canvas texture.
  const contactTexture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    // jsdom (unit tests) returns a gradient object missing addColorStop;
    // fall back to a flat fill so the suite doesn't blow up on import/render.
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    if (typeof grad?.addColorStop === "function") {
      grad.addColorStop(0, "rgba(15,23,42,0.85)");
      grad.addColorStop(0.55, "rgba(15,23,42,0.35)");
      grad.addColorStop(1, "rgba(15,23,42,0)");
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = "rgba(15,23,42,0.5)";
    }
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }, []);

  // Equipment icon disc — sits at the beacon orb height so it reads as the
  // unit's callout, grounded on the pole rather than floating.
  const renderShape = () => (
    <sprite scale={[0.7, 0.7, 1]} position={[0, pole.sphereOffset, 0]}>
      <spriteMaterial map={iconTexture} transparent depthTest={false} />
    </sprite>
  );

  return (
    <>
      {/* Ceiling-mounted kit (AHU/fan/lighting): drop a soft leader disc on
          the floor slab directly beneath the marker so a hung unit still has
          a visible ground-plane anchor, like a BMS leader line to a floor
          plan icon. Rendered as a sibling group at world (x,z) so it lands
          on the slab regardless of the marker's elevated position. */}
      {ceilingMounted && (
        <group position={[resolved.x, resolvedFloorY + 0.01, resolved.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.4, 32]} />
            <meshBasicMaterial
              map={contactTexture}
              color="#0f172a"
              transparent
              opacity={0.35}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}
      <group
        ref={groupRef}
        position={pos}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => {
        setHovered(false);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick(asset.id);
      }}
    >
      {/* Per-marker ground contact disc — soft radial shadow that grounds the
          marker to its floor plane at ANY zoom, independent of the global
          <ContactShadows> (which only reaches ~5u around world y=0). Floor-
          mounted kit gets the disc at its own base; ceiling-mounted kit gets
          a matching leader disc on the floor slab directly beneath it. */}
      {!ceilingMounted && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.4, 32]} />
          <meshBasicMaterial
            map={contactTexture}
            color="#0f172a"
            transparent
            opacity={0.35}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {/* Status condition ring — sits flat ON the slab beneath the asset */}
      {!ceilingMounted && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.2, 24]} />
        <meshBasicMaterial
          color={conditionRingColor}
          transparent
          opacity={conditionRingOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>}
      {/* Inner solid dot — also on the slab */}
      {!ceilingMounted && <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 16]} />
        <meshBasicMaterial
          color={conditionRingColor}
          transparent
          opacity={conditionRingOpacity * 0.4}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>}

      {/* ── Vertical status beacon pole + emissive sphere ── */}
      {/* Pole base is planted on the slab (y=0); getPoleStyle picks the
          height/orb position per mount type so floor kit and ceiling kit
          read correctly. */}
      <mesh position={[0, ceilingMounted ? -pole.length / 2 : pole.length / 2, 0]}>
        <cylinderGeometry args={[0.09, 0.09, pole.length, 10]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.28} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.05, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.65} />
      </mesh>
      {/* Glowing sphere at the orb height */}
      <mesh position={[0, pole.sphereOffset, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial
          color={conditionRingColor}
          emissive={conditionRingColor}
          emissiveIntensity={asset.status === "critical" ? 2.0 : asset.status === "offline" ? 0.3 : 1.0}
          roughness={0.2}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>
      {/* Point light at beacon top */}
      <pointLight
        position={[0, pole.sphereOffset, 0]}
        intensity={asset.status === "ok" || asset.status === "info" ? 1.5 : asset.status === "critical" ? 3.0 : asset.status === "warning" ? 0.5 : 0}
        distance={4}
        color={conditionRingColor}
      />

      {/* Glow point-light for critical / warning */}
      {showConditionGlow && (
        <pointLight
          position={[0, pole.sphereOffset, 0]}
          intensity={asset.status === "critical" ? 2.5 : 0.8}
          distance={3.5}
          color={conditionRingColor}
        />
      )}
      {/* Equipment icon disc (real emoji on status disc) */}
      {renderShape()}

      {/* Alert ring overlay — pulses red when the asset has an active alert */}
      {hasAlert && (
        <mesh position={[0, pole.sphereOffset, 0]} ref={alertRingRef}>
          <ringGeometry args={[0.9, 1.6, 32]} />
          <meshBasicMaterial
            color="#ef4444"
            transparent
            opacity={0.5}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, pole.sphereOffset, 0]}>
          <sphereGeometry args={[1.4, 16, 16]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} />
        </mesh>
      )}
      {/* ── Hover label with real SVG icon (hidden until hover) ── */}
      {hovered && (
        <Html distanceFactor={6} position={[0, pole.sphereOffset + 0.6, 0]} center>
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none shadow-lg"
            style={{
              background: "rgba(0,0,0,0.8)",
              color: "#fff",
              lineHeight: 1.3,
              fontSize: 11,
            }}
          >
            <span
              className="w-4 h-4 flex items-center justify-center rounded-full"
              style={{ background: `#${hexColor.toString(16).padStart(6, "0")}` }}
              dangerouslySetInnerHTML={{ __html: assetIcon }}
            />
            <span className="font-medium">{asset.name}</span>
            <span style={{ color: `#${hexColor.toString(16).padStart(6, "0")}` }}>
              ●
            </span>
          </div>
        </Html>
      )}
    </group>
    </>
  );
}

function Elevator() {
  const cabRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (cabRef.current) {
      const time = state.clock.getElapsedTime();
      const y = 8 + 7.8 * Math.sin(time * 0.4);
      cabRef.current.position.y = y;
    }
  });

  // Translucent shaft the cab rides inside — grounds the elevator so it
  // reads as "in a shaft" rather than a lone box gliding through the
  // inter-floor void in All Floors view. Spans L1 slab (y=0) to above L2.
  const SHAFT_X = -HALF_W + 2.5;
  const SHAFT_BOTTOM = 0;
  const SHAFT_TOP = 17.5;
  const SHAFT_H = SHAFT_TOP - SHAFT_BOTTOM;
  const SHAFT_MIDY = (SHAFT_TOP + SHAFT_BOTTOM) / 2;

  return (
    <group position={[0, 0, 0]}>
      {/* Elevator shaft — faint glass column so the cab is visibly contained */}
      <mesh position={[SHAFT_X, SHAFT_MIDY, 0]}>
        <boxGeometry args={[2.1, SHAFT_H, 2.1]} />
        <meshPhysicalMaterial
          color="#94a3b8"
          transparent
          opacity={0.08}
          roughness={0.1}
          metalness={0.3}
          transmission={0.6}
          thickness={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Shaft edge frame (4 vertical mullions) — subtle structure */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`shaft-mullion-${sx}-${sz}`} position={[SHAFT_X + sx * 1.0, SHAFT_MIDY, sz * 1.0]}>
            <cylinderGeometry args={[0.03, 0.03, SHAFT_H, 6]} />
            <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.6} />
          </mesh>
        )),
      )}
      {/* Vertical support rails — inside building near back-left corner */}
      {[-0.9, 0.9].map((z) => (
        <mesh key={`rail-${z}`} position={[-HALF_W + 2.5, 12, z]}>
          <cylinderGeometry args={[0.08, 0.08, 24, 8]} />
          <meshStandardMaterial color="#475569" roughness={0.1} metalness={0.8} />
        </mesh>
      ))}

      {/* Glass Elevator Cab */}
      <group ref={cabRef} position={[-HALF_W + 2.5, 8, 0]}>
        <mesh position={[0, 0.05, 0]} castShadow>
          <boxGeometry args={[1.8, 0.1, 1.8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, 3.15, 0]} castShadow>
          <boxGeometry args={[1.8, 0.1, 1.8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} />
        </mesh>
        
        {/* Cab glass walls */}
        <mesh position={[0, 1.6, 0.85]}>
          <boxGeometry args={[1.6, 3.0, 0.02]} />
          <meshPhysicalMaterial
            color="#8fbfe8"
            transparent
            opacity={0.3}
            roughness={0.05}
            metalness={0.9}
            transmission={0.7}
            thickness={0.2}
          />
        </mesh>
        <mesh position={[0.85, 1.6, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[1.6, 3.0, 0.02]} />
          <meshPhysicalMaterial
            color="#8fbfe8"
            transparent
            opacity={0.3}
            roughness={0.05}
            metalness={0.9}
            transmission={0.7}
            thickness={0.2}
          />
        </mesh>
        <mesh position={[-0.85, 1.6, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[1.6, 3.0, 0.02]} />
          <meshPhysicalMaterial
            color="#8fbfe8"
            transparent
            opacity={0.3}
            roughness={0.05}
            metalness={0.9}
            transmission={0.7}
            thickness={0.2}
          />
        </mesh>

        {/* Columns */}
        {[-0.85, 0.85].map((cx) =>
          [-0.85, 0.85].map((cz) => (
            <mesh key={`cab-col-${cx}-${cz}`} position={[cx, 1.6, cz]}>
              <cylinderGeometry args={[0.05, 0.05, 3.0, 8]} />
              <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
            </mesh>
          ))
        )}

        <mesh position={[0, 3.08, 0]}>
          <boxGeometry args={[1.2, 0.02, 1.2]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <pointLight position={[0, 2.9, 0]} intensity={1.5} distance={5} color="#60a5fa" />
      </group>
    </group>
  );
}

function ArchitecturalTree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 2.0, 8]} />
        <meshStandardMaterial color="#57534e" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.3, 0]} castShadow>
        <sphereGeometry args={[0.9, 12, 12]} />
        <meshStandardMaterial
          color="#15803d"
          transparent
          opacity={0.8}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0.2, 2.8, 0.1]} castShadow>
        <sphereGeometry args={[0.6, 12, 12]} />
        <meshStandardMaterial
          color="#166534"
          transparent
          opacity={0.85}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
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
  showFacade?: boolean;
  showFurniture?: boolean;
  showMEP?: boolean;
  showZones?: boolean;
  /** When false, hides data labels (floor names, signage) — used on landing page */
  showMarkers?: boolean;
}

export function Building({
  selectedFloor,
  selectedZone,
  onSelectZone,
  walkMode = false,
  showFacade = true,
  showFurniture = true,
  showMEP = true,
  showZones = true,
  showMarkers = true,
}: BuildingProps) {
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
            showFacade={showFacade}
            showFurniture={showFurniture}
            showMEP={showMEP}
            showZones={showZones}
            showMarkers={showMarkers}
          />
        );
      })}
      {/* Sawtooth roof */}
      {showFacade && <SawtoothRoof yBase={roofY} />}
      {/* Roof parapet + equipment */}
      {showFacade && <RoofParapet yBase={roofY} />}
      {showMEP && <RooftopEquipment yBase={roofY} />}
      {/* Entrance canopy (ground/exhibition floor) */}
      {showFacade && <EntranceCanopy yBase={BUILDING_FLOORS[0].yBase} showMarkers={showMarkers} />}

      {/* Moving Observation Elevator */}
      {selectedFloor === "ALL" && <Elevator />}

      {/* Surrounding landscape trees */}
      {selectedFloor === "ALL" && (
        <group>
          <ArchitecturalTree position={[-12, 0, HALF_D + 5]} />
          <ArchitecturalTree position={[-16, 0, HALF_D + 4]} />
          <ArchitecturalTree position={[12, 0, HALF_D + 5]} />
          <ArchitecturalTree position={[16, 0, HALF_D + 4]} />
          <ArchitecturalTree position={[-HALF_W - 4, 0, -4]} />
          <ArchitecturalTree position={[HALF_W + 4, 0, -6]} />
          <ArchitecturalTree position={[-8, 0, -HALF_D - 5]} />
          <ArchitecturalTree position={[8, 0, -HALF_D - 5]} />
        </group>
      )}
    </group>
  );
}

// ─── GLB / GLTF Model Loader ────────────────────────────────────────

/**
 * Renders an uploaded GLB/GLTF building model in place of the procedural
 * Building component. Named child objects in the GLB are reported via
 * onObjectsFound and can be individually toggled via visibleObjects for
 * layer-panel integration.
 */
export function BuildingModel({
  modelUrl,
  visibleObjects,
  onObjectsFound,
}: {
  modelUrl: string;
  visibleObjects?: Set<string>;
  onObjectsFound?: (names: string[]) => void;
}) {
  const { scene } = useGLTF(modelUrl, true);

  // Report distinct named objects from the GLB so the parent can show layer toggles
  useEffect(() => {
    if (!onObjectsFound) return;
    const found = new Set<string>();
    scene.traverse((child) => {
      if (child.name) found.add(child.name);
    });
    const names = Array.from(found).sort();
    if (names.length > 0) onObjectsFound(names);
  }, [scene, onObjectsFound]);

  // Apply per-object visibility toggles from the Layers panel
  useEffect(() => {
    if (!visibleObjects || visibleObjects.size === 0) {
      scene.traverse((child) => { child.visible = true; });
    } else {
      scene.traverse((child) => {
        if (child.name) {
          child.visible = visibleObjects.has(child.name);
        }
      });
    }
  }, [scene, visibleObjects]);

  // Center the model and floor it on y=0
  const [position, scale] = useMemo(() => {
    // Temporarily show all children so the bounding box is correct
    scene.traverse((child) => { child.visible = true; });
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Scale so the longest dimension fits within 28 units — a balanced
    // size that looks good with the default camera (35, 12, 35)
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = maxDim > 0 ? 28 / maxDim : 1;
    return [
      [-center.x * s, -box.min.y * s, -center.z * s] as [number, number, number],
      [s, s, s] as [number, number, number],
    ];
  }, [scene]);

  return (
    <group position={position} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

// Re-export for convenience
export type { FloorFilter };
