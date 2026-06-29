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

import { useRef, useState } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { Html, Edges, Grid } from "@react-three/drei";
import {
  colors,
  building as B,
} from "@/design-system/tokens";
import type { Asset } from "./viewer-data";
import type { FloorFilter } from "./viewer-store";
import { RoomInterior } from "./viewer-interior";

// ─── Types ─────────────────────────────────────────────────────────

/** A 2D point in xz space (floor-plan coords). */
export interface Point2D {
  x: number;
  z: number;
}

/** A wall segment: start → end at a given floor-relative height. */
export interface WallSegment {
  start: Point2D;
  end: Point2D;
  height: number;
}

/**
 * A room defined by its perimeter walls, forming a closed polygon.
 * Vertices are in counter-clockwise order, no repeated last vertex.
 */
export interface RoomPolygon {
  id: string;
  name: string;
  /** Closed polygon vertices in xz space. */
  vertices: Point2D[];
  /** Optional accent colour; defaults to a subtle blue. */
  color?: string;
}

// Keep ZoneData/FloorData for backward compat during migration
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
  level: number;            // 0 = basement, 1 = ground, 2 = upper, N-1 = top
  name: string;
  /** Short label for the floor-selector button ("L1", "B1", "M", "Roof"). */
  shortLabel?: string;
  /** Y offset of the floor slab bottom. */
  yBase: number;
  height: number;
  zones: ZoneData[];
  /** Closed-polygon rooms replacing zones. Present on all new data. */
  rooms?: RoomPolygon[];
}

// ─── Polygon helpers ──────────────────────────────────────────────

/**
 * Convert cx,cz,w,d zone to a 4-vertex closed polygon (counter-clockwise).
 */
function rectVertices(cx: number, cz: number, w: number, d: number): Point2D[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    { x: cx - hw, z: cz - hd },
    { x: cx + hw, z: cz - hd },
    { x: cx + hw, z: cz + hd },
    { x: cx - hw, z: cz + hd },
  ];
}

/**
 * Compute {cx, cz, w, d} bounding box from polygon vertices.
 */
function zoneBoundsFromVertices(verts: Point2D[]): { cx: number; cz: number; w: number; d: number } {
  const xs = verts.map(v => v.x);
  const zs = verts.map(v => v.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    w: maxX - minX,
    d: maxZ - minZ,
  };
}

// ─── Polygon validation ──────────────────────────────────────────

/**
 * Ray-casting point-in-polygon test.
 * Returns true if (x, z) is inside the closed polygon described by `vertices`.
 * Vertices should be in CCW order, no repeated-last-vertex.
 */
export function pointInPolygon(x: number, z: number, vertices: Point2D[]): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, zi = vertices[i].z;
    const xj = vertices[j].x, zj = vertices[j].z;
    if (
      (zi > z) !== (zj > z) &&
      x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Check whether two convex polygons overlap (separating-axis test for
 * axis-aligned rectangles; general SAT for arbitrary polygons).
 * For the current codebase all rooms are axis-aligned rectangles, but
 * this uses a simple edge-separating check that works for any convex
 * polygon.
 */
export function polygonsOverlap(a: Point2D[], b: Point2D[]): boolean {
  // If either polygon has a vertex inside the other, they overlap.
  for (const v of a) {
    if (pointInPolygon(v.x, v.z, b)) return true;
  }
  for (const v of b) {
    if (pointInPolygon(v.x, v.z, a)) return true;
  }
  // Edge-crossing check (for cases where one polygon fully contains the other
  // with no vertex of one inside the other — e.g. nested rectangles).
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i], p2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const q1 = b[j], q2 = b[(j + 1) % b.length];
      if (segmentsIntersect(p1, p2, q1, q2)) return true;
    }
  }
  return false;
}

function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const orient = (p: Point2D, q: Point2D, r: Point2D) =>
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function onSegment(p: Point2D, q: Point2D, r: Point2D): boolean {
  return (
    r.x <= Math.max(p.x, q.x) && r.x >= Math.min(p.x, q.x) &&
    r.z <= Math.max(p.z, q.z) && r.z >= Math.min(p.z, q.z)
  );
}

/**
 * Run at boot in dev: validates all floors' rooms for overlap and that
 * every asset position (from the live data) falls inside a room on its floor.
 * Callers pass the asset array from the API hook.
 * Fails loudly (console.error) naming every offending zone/asset — never
 * throws, so the user can still interact with the scene.
 */
export function validateFloorPlan(
  floors: FloorData[],
  assets?: Array<{ id: string; floor: number; x: number; z: number }>,
): void {
  for (const floor of floors) {
    const rooms = floor.rooms ?? [];
    // Check room-vs-room overlap
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        if (polygonsOverlap(rooms[i].vertices, rooms[j].vertices)) {
          console.error(
            `[validateFloorPlan] OVERLAP: rooms "${rooms[i].id}" and "${rooms[j].id}" on floor ${floor.level} (${floor.name}) overlap. Fix the floor-plan data.`,
          );
        }
      }
    }
    // Check every asset is inside at least one room on its floor
    if (assets) {
      for (const asset of assets) {
        if (asset.floor !== floor.level) continue;
        const inside = rooms.some(r => pointInPolygon(asset.x, asset.z, r.vertices));
        if (!inside) {
          console.error(
            `[validateFloorPlan] OUT_OF_BOUNDS: asset "${asset.id}" at (${asset.x}, ${asset.z}) is not inside any room on floor ${floor.level}.`,
          );
        }
      }
    }
  }
}

// ─── Floor-plan coordinate utilities ──────────────────────────────

/**
 * Compute the axis-aligned bounding box of a room polygon.
 */
export function roomBounds(room: RoomPolygon): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const xs = room.vertices.map(v => v.x);
  const zs = room.vertices.map(v => v.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

/**
 * Convert world coordinates to relative (0..1) position inside a room.
 * (0,0) = north-west corner of bounding box; (1,1) = south-east corner.
 */
export function worldToRelativePosition(
  room: RoomPolygon,
  x: number,
  z: number,
): { relX: number; relZ: number } {
  const b = roomBounds(room);
  const w = b.maxX - b.minX || 1;
  const d = b.maxZ - b.minZ || 1;
  return {
    relX: (x - b.minX) / w,
    relZ: (z - b.minZ) / d,
  };
}

/**
 * Convert relative (0..1) position back to world coordinates.
 */
export function relativeToWorldPosition(
  room: RoomPolygon,
  relX: number,
  relZ: number,
): { x: number; z: number } {
  const b = roomBounds(room);
  return {
    x: b.minX + Math.max(0, Math.min(1, relX)) * (b.maxX - b.minX),
    z: b.minZ + Math.max(0, Math.min(1, relZ)) * (b.maxZ - b.minZ),
  };
}

/**
 * Clamp world (x, z) so it never sits outside the room polygon.
 * Returns the clamped position. If the room has no vertices (empty
 * room), returns {x, z} unchanged.
 */
export function clampToRoom(
  room: RoomPolygon | undefined,
  x: number,
  z: number,
): { x: number; z: number } {
  if (!room || room.vertices.length < 3) return { x, z };
  if (pointInPolygon(x, z, room.vertices)) return { x, z };
  // Fall back to nearest point on the bounding box
  const b = roomBounds(room);
  return {
    x: Math.max(b.minX, Math.min(b.maxX, x)),
    z: Math.max(b.minZ, Math.min(b.maxZ, z)),
  };
}

/**
 * Find the first room in `floors[floorLevel]` that contains (x, z).
 * Returns undefined if no room matches.
 */
export function findRoomAt(floors: FloorData[], floorLevel: number, x: number, z: number): RoomPolygon | undefined {
  const floor = floors[floorLevel];
  if (!floor) return undefined;
  return (floor.rooms ?? []).find(r => pointInPolygon(x, z, r.vertices));
}

/**
 * Resolve an asset's final world position by clamping to its assigned
 * room polygon (by roomId or point-in-polygon test) — guarantees the
 * marker can never clip through a wall or sit in an unoccupied area.
 * Falls back to raw world coords when no room is matched.
 */
export function resolveAssetPosition(
  asset: { id: string; floor: number; x: number; y?: number; z: number },
  floors: FloorData[],
): { x: number; y: number; z: number } {
  const rawX = asset.x ?? 0;
  const rawZ = asset.z ?? 0;
  const floorLevel = asset.floor ?? 0;

  // Try to find a room that contains this position
  const floor = floors[floorLevel];
  let room: RoomPolygon | undefined;
  if (floor) {
    room = (floor.rooms ?? []).find(r => pointInPolygon(rawX, rawZ, r.vertices));
  }

  const clamped = clampToRoom(room, rawX, rawZ);
  const floorY = floor?.yBase ?? 6.5;
  return {
    x: clamped.x,
    y: asset.y ?? (floorY + 1.0),
    z: clamped.z,
  };
}

/**
 * Compute the combined bounding box of all rooms on a floor.
 * Returns undefined if the floor has no rooms.
 */
export function floorFootprintBounds(floor: FloorData): { cx: number; cz: number; width: number; depth: number } | undefined {
  const rooms = floor.rooms ?? [];
  if (rooms.length === 0) return undefined;
  const allXs = rooms.flatMap(r => r.vertices.map(v => v.x));
  const allZs = rooms.flatMap(r => r.vertices.map(v => v.z));
  const minX = Math.min(...allXs);
  const maxX = Math.max(...allXs);
  const minZ = Math.min(...allZs);
  const maxZ = Math.max(...allZs);
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

/**
 * Overall bounding box of the entire building across all floors.
 * Used to constrain the orbit-camera target so the user can never
 * pan the view centre outside the building footprint.
 */
export function buildingGlobalBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const allFloors = BUILDING_FLOORS;
  const allRooms = allFloors.flatMap(f => f.rooms ?? []);
  if (allRooms.length === 0) {
    // Fallback — building extents from tokens
    return { minX: -18, maxX: 18, minZ: -12, maxZ: 12 };
  }
  const allXs = allRooms.flatMap(r => r.vertices.map(v => v.x));
  const allZs = allRooms.flatMap(r => r.vertices.map(v => v.z));
  return {
    minX: Math.min(...allXs),
    maxX: Math.max(...allXs),
    minZ: Math.min(...allZs),
    maxZ: Math.max(...allZs),
  };
}

/**
 * Returns a THREE.Box3 covering the walkable area of a given floor,
 * or the full building extents as a fallback. Used to bound walk-mode
 * CameraControls.
 */
export function floorWalkableBounds(floorIndex: number): THREE.Box3 {
  const floor = BUILDING_FLOORS.find(f => f.level === floorIndex);
  let minX = -18, maxX = 18, minZ = -12, maxZ = 12; // fallback global extents
  if (floor) {
    const b = floorFootprintBounds(floor);
    if (b) {
      const hw = b.width / 2;
      const hd = b.depth / 2;
      minX = b.cx - hw;
      maxX = b.cx + hw;
      minZ = b.cz - hd;
      maxZ = b.cz + hd;
    }
  }
  return new THREE.Box3(
    new THREE.Vector3(minX, -Infinity, minZ),
    new THREE.Vector3(maxX, Infinity, maxZ),
  );
}

// ─── Building constants ────────────────────────────────────────────

const W = B.towerW;       // 36
const D = B.towerD;       // 24
const HALF_W = W / 2;
const HALF_D = D / 2;
const SLAB_T = 0.4;

/**
 * Demo default: Singapore Expo Hall 7 — 2-floor convention centre.
 * Real customer buildings are loaded from `/buildings/:id` at boot —
 * see `loadFloorsFromApi()` below. This constant is the offline fallback
 * used when the API is unreachable or for unit tests.
 *
 * Each floor carries a `shortLabel` so the floor-selector button shows
 * "L1", "L2" instead of "Level 1", "Level 2".
 */
export const BUILDING_FLOORS: FloorData[] = [
  {
    level: 0,
    name: "Level 1 · Exhibition",
    shortLabel: "L1",
    yBase: 0,
    height: 8.5,
    zones: [
      { id: "1a", name: "Main Entrance", cx: 0, cz: -HALF_D + 4, w: 14, d: 6, color: "#3b82f6" },
      { id: "1b", name: "Hall A — West", cx: -10, cz: 2, w: 14, d: 12, color: "#60a5fa" },
      { id: "1c", name: "Hall A — East", cx: 10, cz: 2, w: 14, d: 12, color: "#60a5fa" },
      { id: "1d", name: "Concourse", cx: 0, cz: -4, w: 12, d: 4, color: "#93c5fd" },
      { id: "1e", name: "Restrooms", cx: -HALF_W + 3, cz: 8, w: 4, d: 6, color: "#bfdbfe" },
      { id: "1f", name: "Meeting Rooms", cx: HALF_W - 4, cz: 8, w: 6, d: 6, color: "#bfdbfe" },
      // Plant room (back-of-house, where the seed puts boilers/chillers/primary pumps)
      { id: "1g", name: "Plant Room", cx: -13, cz: 8, w: 6, d: 4, color: "#64748b" },
    ],
    rooms: [
      { id: "1a", name: "Main Entrance", vertices: rectVertices(0, -HALF_D + 4, 14, 6), color: "#3b82f6" },
      { id: "1b", name: "Hall A — West", vertices: rectVertices(-10, 2, 14, 12), color: "#60a5fa" },
      { id: "1c", name: "Hall A — East", vertices: rectVertices(10, 2, 14, 12), color: "#60a5fa" },
      { id: "1d", name: "Concourse", vertices: rectVertices(0, -4, 12, 4), color: "#93c5fd" },
      { id: "1e", name: "Restrooms", vertices: rectVertices(-HALF_W + 3, 8, 4, 6), color: "#bfdbfe" },
      { id: "1f", name: "Meeting Rooms", vertices: rectVertices(HALF_W - 4, 8, 6, 6), color: "#bfdbfe" },
      { id: "1g", name: "Plant Room", vertices: rectVertices(-13, 8, 6, 4), color: "#64748b" },
    ],
  },
  {
    level: 1,
    name: "Level 2 · Upper Mezzanine",
    shortLabel: "L2",
    yBase: 9.0,
    height: 8.5,
    zones: [
      { id: "2a", name: "Hall B — West", cx: -10, cz: 0, w: 14, d: 14, color: "#a78bfa" },
      { id: "2b", name: "Hall B — East", cx: 10, cz: 0, w: 14, d: 14, color: "#a78bfa" },
      { id: "2c", name: "VIP Lounge", cx: 0, cz: -8, w: 10, d: 6, color: "#c4b5fd" },
      { id: "2d", name: "Terrace", cx: 0, cz: 8, w: 16, d: 6, color: "#ddd6fe" },
      { id: "2e", name: "Control Room", cx: -HALF_W + 4, cz: -6, w: 6, d: 5, color: "#8b5cf6" },
    ],
    rooms: [
      { id: "2a", name: "Hall B — West", vertices: rectVertices(-10, 0, 14, 14), color: "#a78bfa" },
      { id: "2b", name: "Hall B — East", vertices: rectVertices(10, 0, 14, 14), color: "#a78bfa" },
      { id: "2c", name: "VIP Lounge", vertices: rectVertices(0, -8, 10, 6), color: "#c4b5fd" },
      { id: "2d", name: "Terrace", vertices: rectVertices(0, 8, 16, 6), color: "#ddd6fe" },
      { id: "2e", name: "Control Room", vertices: rectVertices(-HALF_W + 4, -6, 6, 5), color: "#8b5cf6" },
    ],
  },
];

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
          <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 shadow-md pointer-events-none whitespace-nowrap">
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
    <group>
      {/* Main slab */}
      <mesh position={[0, y, 0]} receiveShadow>
        <boxGeometry args={[width, thickness, depth]} />
        <meshPhysicalMaterial
          color={colors.building.slab}
          transparent={transparent}
          opacity={transparent ? 0.15 : 1}
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
  const baseOpacity = transparent ? 0.15 : 0.35;
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
    transmission: 0.35,
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
          transparent opacity={transparent ? 0.08 : 0.2}
          roughness={0.05} metalness={0}
          clearcoat={0.3} clearcoatRoughness={0.2}
          transmission={transparent ? 0.85 : 0.65}
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
            <meshPhysicalMaterial color={glassColor} transparent opacity={transparent ? 0.08 : 0.2}
              roughness={0.1} metalness={0} clearcoat={0.2} clearcoatRoughness={0.3}
              transmission={transparent ? 0.85 : 0.65} thickness={0.5} ior={1.5}
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
            <meshPhysicalMaterial color={glassColor} transparent opacity={transparent ? 0.08 : 0.2}
              roughness={0.1} metalness={0} clearcoat={0.2} clearcoatRoughness={0.3}
              transmission={transparent ? 0.85 : 0.65} thickness={0.5} ior={1.5}
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
            <meshPhysicalMaterial color={glassColor} transparent opacity={transparent ? 0.08 : 0.2}
              roughness={0.1} metalness={0} clearcoat={0.2} clearcoatRoughness={0.3}
              transmission={transparent ? 0.85 : 0.65} thickness={0.5} ior={1.5}
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
  // Build 6 sawtooth ridges using angled roof planes, not flat boxes.
  // Each ridge: front glass panel, slanted roof plane, flat top.
  const ridges = [];
  const rw = ROOF_RIDGE_W;
  const rh = ROOF_RIDGE_H;
  const startX = -HALF_W;

  for (let i = 0; i < ROOF_RIDGES; i++) {
    const cx = startX + rw * i + rw / 2;
    ridges.push(
      <group key={`ridge-${i}`}>
        {/* Slanted roof face — tilted box to approximate a pitched sawtooth */}
        <mesh
          position={[cx, yBase + rh * 0.4, 0]}
          rotation={[0, 0, -0.35]}
          castShadow
        >
          <boxGeometry args={[rw * 0.45, rh * 0.85, D]} />
          <meshStandardMaterial
            color="#b8c9d6"
            roughness={0.5}
            metalness={0.35}
          />
        </mesh>
        {/* Flat top section */}
        <mesh position={[cx + rw * 0.2, yBase + rh * 0.55, 0]} castShadow>
          <boxGeometry args={[rw * 0.35, 0.08, D]} />
          <meshStandardMaterial
            color="#a8b9c8"
            roughness={0.6}
            metalness={0.3}
          />
        </mesh>
        {/* Front vertical glass panel for each ridge */}
        <mesh position={[cx - rw * 0.25, yBase + rh * 0.4, HALF_D - 0.08]}>
          <boxGeometry args={[0.05, rh * 0.8, D - 0.4]} />
          <meshPhysicalMaterial
            color="#5b8fd9"
            transparent
            opacity={0.2}
            roughness={0.05}
            metalness={0.9}
            transmission={0.75}
            thickness={0.2}
          />
        </mesh>
        {/* Horizontal cap rail on front glass */}
        <mesh position={[cx - rw * 0.25, yBase + rh * 0.78, HALF_D - 0.08]}>
          <boxGeometry args={[0.06, 0.04, D - 0.2]} />
          <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.6} />
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

function LiveFan({ status, color: _color }: { status: string; color: number }) {
  const bladeRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (bladeRef.current) {
      const t = state.clock.getElapsedTime();
      let speed = 0;
      let wobble = 0;
      
      if (status === "ok" || status === "info") {
        speed = t * 14.0;
      } else if (status === "warning") {
        speed = t * 3.5;
        wobble = Math.sin(t * 8.0) * 0.03;
      }
      
      bladeRef.current.rotation.z = speed;
      bladeRef.current.position.y = wobble;
    }
  });

  const isOffline = status === "offline";
  const housingColor = isOffline ? "#78716c" : status === "critical" ? "#ef4444" : "#475569";
  const bladeColor = isOffline ? "#57534e" : "#0f172a";

  return (
    <group>
      {/* Outer Housing */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.3, 1.3, 0.8]} />
        <meshStandardMaterial color={housingColor} roughness={0.4} metalness={isOffline ? 0.1 : 0.5} />
      </mesh>
      {/* Shroud */}
      <mesh position={[0, 0, 0.41]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 16]} />
        <meshStandardMaterial color={isOffline ? "#57534e" : "#1e293b"} roughness={0.3} metalness={isOffline ? 0.1 : 0.7} />
      </mesh>
      {/* Fan Blades */}
      <group position={[0, 0, 0.42]}>
        <mesh ref={bladeRef} castShadow>
          <boxGeometry args={[0.85, 0.12, 0.02]} />
          <meshStandardMaterial color={bladeColor} roughness={0.5} />
        </mesh>
        <mesh ref={bladeRef} rotation={[0, 0, Math.PI / 2]} castShadow>
          <boxGeometry args={[0.85, 0.12, 0.02]} />
          <meshStandardMaterial color={bladeColor} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function LivePump({ status, color }: { status: string; color: number }) {
  const flowBeadRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (flowBeadRef.current && (status === "ok" || status === "info")) {
      const t = state.clock.getElapsedTime();
      flowBeadRef.current.position.y = -0.8 + ((t * 2.5) % 1.6);
    }
  });

  const isOffline = status === "offline";
  const bodyColor = isOffline ? 0x78716c : color;

  return (
    <group>
      {/* Pump Motor Base */}
      <mesh position={[0, -0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.15, 0.5]} />
        <meshStandardMaterial color={isOffline ? "#57534e" : "#1e293b"} roughness={0.6} />
      </mesh>
      {/* Centrifugal Casing */}
      <mesh position={[-0.2, 0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.35, 12]} />
        <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={isOffline ? 0.1 : 0.5} />
      </mesh>
      {/* Motor Cylinder */}
      <mesh position={[0.2, 0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.45, 12]} />
        <meshStandardMaterial color={isOffline ? "#57534e" : "#475569"} roughness={0.5} metalness={isOffline ? 0.1 : 0.7} />
      </mesh>
      {/* Outlet Pipe */}
      <mesh position={[-0.2, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.9, 8]} />
        <meshStandardMaterial color={isOffline ? "#57534e" : "#94a3b8"} roughness={0.2} metalness={isOffline ? 0.1 : 0.8} />
      </mesh>
      {/* Flow Indicator bead inside outlet pipe */}
      {(status === "ok" || status === "info") && (
        <mesh ref={flowBeadRef} position={[-0.2, 0, 0]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color="#38bdf8" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function LiveBoiler({ status, color }: { status: string; color: number }) {
  const furnaceRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    if (furnaceRef.current && (status === "ok" || status === "info")) {
      const t = state.clock.getElapsedTime();
      furnaceRef.current.opacity = 0.4 + Math.sin(t * 6.0) * 0.2;
    }
  });

  const isOffline = status === "offline";
  const bodyColor = isOffline ? 0x78716c : color;

  return (
    <group>
      {/* Boiler Tank */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 1.1, 16]} />
        <meshStandardMaterial color={bodyColor} roughness={0.3} metalness={isOffline ? 0.1 : 0.3} />
      </mesh>
      {/* Domed top */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <sphereGeometry args={[0.5, 16, 8]} />
        <meshStandardMaterial color={bodyColor} roughness={0.3} metalness={isOffline ? 0.1 : 0.3} />
      </mesh>
      {/* Fire/Glow ring at base */}
      {(status === "ok" || status === "info") && (
        <group>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.52, 0.52, 0.08, 12]} />
            <meshBasicMaterial ref={furnaceRef} color="#f97316" transparent opacity={0.6} toneMapped={false} />
          </mesh>
          <pointLight position={[0, -0.35, 0]} intensity={1.5} distance={3} color="#f97316" />
        </group>
      )}
      {/* Flue pipe */}
      <mesh position={[0.2, 0.95, 0.2]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.55, 8]} />
        <meshStandardMaterial color={isOffline ? "#57534e" : "#475569"} roughness={0.2} metalness={isOffline ? 0.1 : 0.8} />
      </mesh>
    </group>
  );
}

function LiveChiller({ status, color }: { status: string; color: number }) {
  const coolingAuraRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    if (coolingAuraRef.current && (status === "ok" || status === "info")) {
      const t = state.clock.getElapsedTime();
      coolingAuraRef.current.opacity = 0.2 + Math.sin(t * 3.0) * 0.1;
    }
  });

  const isOffline = status === "offline";
  const bodyColor = isOffline ? 0x78716c : color;

  return (
    <group>
      {/* Condenser barrels */}
      {[-0.28, 0.28].map((z, idx) => (
        <mesh key={idx} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.3, 1.5, 12]} />
          <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={isOffline ? 0.1 : 0.6} />
        </mesh>
      ))}
      {/* End plates */}
      {[-0.75, 0.75].map((x, idx) => (
        <mesh key={idx} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[0.05, 0.65, 0.9]} />
          <meshStandardMaterial color={isOffline ? "#57534e" : "#334155"} roughness={0.3} metalness={isOffline ? 0.1 : 0.7} />
        </mesh>
      ))}
      {/* Cooling aura bands */}
      {(status === "ok" || status === "info") && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.1, 0.7, 0.95]} />
          <meshBasicMaterial ref={coolingAuraRef} color="#06b6d4" transparent opacity={0.25} wireframe toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function LiveAirHandler({ status, color }: { status: string; color: number }) {
  const fanRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (fanRef.current && (status === "ok" || status === "info")) {
      fanRef.current.rotation.z = state.clock.getElapsedTime() * 11.0;
    }
  });

  const isOffline = status === "offline";
  const bodyColor = isOffline ? 0x78716c : color;

  return (
    <group>
      {/* Cabinet */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.5, 1.1, 0.85]} />
        <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={isOffline ? 0.1 : 0.7} />
      </mesh>
      {/* Filter panel */}
      <mesh position={[0, 0, 0.435]}>
        <boxGeometry args={[1.1, 0.75, 0.02]} />
        <meshStandardMaterial color={isOffline ? "#57534e" : "#1e293b"} roughness={0.8} />
      </mesh>
      {/* Fan window */}
      <mesh position={[-0.35, 0, 0.44]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.01, 16]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.2} transmission={0.9} roughness={0.1} />
      </mesh>
      {/* Fan inside window */}
      <group position={[-0.35, 0, 0.41]}>
        <mesh ref={fanRef}>
          <boxGeometry args={[0.45, 0.06, 0.01]} />
          <meshStandardMaterial color={isOffline ? "#57534e" : "#0f172a"} roughness={0.3} />
        </mesh>
        <mesh ref={fanRef} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.45, 0.06, 0.01]} />
          <meshStandardMaterial color={isOffline ? "#57534e" : "#0f172a"} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Asset Marker (adapted from old viewer.tsx) ────────────────────

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

export function AssetMarker3D({ asset, selected, onClick }: {
  asset: Asset;
  selected: boolean;
  onClick: (id: string) => void;
}) {
  const hexColor = STATUS_COLORS_HEX[asset.status] ?? 0x22c55e;
  const setHovered = useState(false)[1];
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

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
  });

  // Map asset (x, y, z) floor coords to 3D position — clamped to room polygon
  const resolved = resolveAssetPosition(asset, BUILDING_FLOORS);
  const pos: [number, number, number] = [resolved.x, resolved.y, resolved.z];

  // Status condition badge color
  const conditionRingColor = STATUS_COLORS[asset.status] ?? "#22c55e";
  const conditionRingOpacity = asset.status === "offline" ? 0.25 : 0.55;
  const showConditionGlow = asset.status === "critical" || asset.status === "warning";

  const renderShape = () => {
    switch (asset.type) {
      case "Air Handler":
        return <LiveAirHandler status={asset.status} color={hexColor} />;
      case "Chiller":
        return <LiveChiller status={asset.status} color={hexColor} />;
      case "Boiler":
        return <LiveBoiler status={asset.status} color={hexColor} />;
      case "Pump":
        return <LivePump status={asset.status} color={hexColor} />;
      case "Fan":
        return <LiveFan status={asset.status} color={hexColor} />;
      case "Elevator":
        return (
          <mesh ref={meshRef} castShadow>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshStandardMaterial color={hexColor} roughness={0.3} metalness={0.8} />
          </mesh>
        );
      case "Lighting":
        return (
          <mesh ref={meshRef} castShadow>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color={hexColor} roughness={0.2} emissive={hexColor} emissiveIntensity={asset.status === "ok" ? 0.6 : 0.1} />
          </mesh>
        );
      case "Sensor":
        return (
          <mesh ref={meshRef} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 0.5, 8]} />
            <meshStandardMaterial color={hexColor} roughness={0.5} />
          </mesh>
        );
      default:
        return (
          <mesh ref={meshRef} castShadow>
            <sphereGeometry args={[0.4, 12, 12]} />
            <meshStandardMaterial color={hexColor} emissive={hexColor} emissiveIntensity={0.15} roughness={0.3} metalness={0.2} />
          </mesh>
        );
    }
  };

  return (
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
      {/* Status condition ring on floor beneath asset */}
      <mesh position={[0, -0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.2, 24]} />
        <meshBasicMaterial
          color={conditionRingColor}
          transparent
          opacity={conditionRingOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Inner solid dot */}
      <mesh position={[0, -0.89, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 16]} />
        <meshBasicMaterial
          color={conditionRingColor}
          transparent
          opacity={conditionRingOpacity * 0.4}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Vertical status beacon pole + emissive sphere ── */}
      {/* Thin pole */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 3.0, 8]} />
        <meshStandardMaterial color={conditionRingColor} roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Glowing sphere at top of pole */}
      <mesh position={[0, 2.1, 0]}>
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
        position={[0, 2.1, 0]}
        intensity={asset.status === "ok" || asset.status === "info" ? 1.5 : asset.status === "critical" ? 3.0 : asset.status === "warning" ? 0.5 : 0}
        distance={4}
        color={conditionRingColor}
      />

      {/* Glow point-light for critical / warning */}
      {showConditionGlow && (
        <pointLight
          position={[0, 0, 0]}
          intensity={asset.status === "critical" ? 2.5 : 0.8}
          distance={3.5}
          color={conditionRingColor}
        />
      )}
      {/* Scaled-up equipment model */}
      <group scale={1.5}>
        {renderShape()}
      </group>
      {selected && (
        <mesh>
          <sphereGeometry args={[1.4, 16, 16]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} />
        </mesh>
      )}
      {/* Always-visible compact status badge */}
      <Html distanceFactor={8} position={[0, 3.5, 0]} center>
        <div
          className="px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap pointer-events-none"
          style={{
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            lineHeight: 1.3,
            textAlign: "center",
          }}
        >
          <div className="font-medium">{asset.name}</div>
          <div style={{ color: conditionRingColor }}>
            ● {asset.status.toUpperCase()}
          </div>
        </div>
      </Html>
    </group>
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

  return (
    <group position={[0, 0, 0]}>
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

// Re-export for convenience
export type { FloorFilter };
