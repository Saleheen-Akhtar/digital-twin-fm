/**
 * Digital Twin FM — Building geometry utilities
 *
 * Shared helpers for floor-plan math: polygon containment, room
 * resolution, floor boundaries, walkable-area computation, and
 * asset-decollision (spiral-out repulsion).
 *
 * Extracted from the now-deprecated viewer-building.tsx monolithic file.
 */

import * as THREE from "three";

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
 * Ray-cast point-in-polygon test for xz coordinates.
 * Returns true if (x, z) is strictly inside the polygon.
 */
export function pointInPolygon(x: number, z: number, vertices: Point2D[]): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];
    if (vi.z > z !== vj.z > z && x < ((vj.x - vi.x) * (z - vi.z)) / (vj.z - vi.z) + vi.x) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── Polygon validation ──────────────────────────────────────────

/**
 * Rough overlap test between two convex-ish polygons using SAT.
 * Fast for our axis-aligned zone rectangles.
 */
export function polygonsOverlap(a: Point2D[], b: Point2D[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      const axis = { x: -(poly[j].z - poly[i].z), z: poly[j].x - poly[i].x };
      const len = Math.sqrt(axis.x * axis.x + axis.z * axis.z);
      if (len === 0) continue;
      const norm = { x: axis.x / len, z: axis.z / len };
      const projA = poly.map((p) => p.x * norm.x + p.z * norm.z);
      const projB = b.map((p) => p.x * norm.x + p.z * norm.z);
      const minA = Math.min(...projA), maxA = Math.max(...projA);
      const minB = Math.min(...projB), maxB = Math.max(...projB);
      if (maxA <= minB || maxB <= minA) return false;
    }
  }
  return true;
}

/** Line-segment intersection test (excludes endpoints). */
function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const o1 = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const o2 = (b.x - a.x) * (d.z - a.z) - (b.z - a.z) * (d.x - a.x);
  const o3 = (d.x - c.x) * (a.z - c.z) - (d.z - c.z) * (a.x - c.x);
  const o4 = (d.x - c.x) * (b.z - c.z) - (d.z - c.z) * (b.x - c.x);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** Validate a floor-plan for overlaps and out-of-bounds assets. */
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
          console.warn(
            `[validateFloorPlan] OUT_OF_BOUNDS: asset "${asset.id}" at (${asset.x}, ${asset.z}) is not inside any room on floor ${floor.level}. Verify seed coordinates align with room polygons.`,
          );
        }
      }
    }
  }
}

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

// ─── Conversions ──────────────────────────────────────────────────

/**
 * Resolve an asset's position given its floor.
 * Used during floor-layout resolution to find the world position.
 */
export function resolveAssetPosition(
  asset: { id: string; type?: string; floor: number; x: number; y?: number; z: number },
  floors: FloorData[],
): { x: number; z: number; y: number; roomName?: string } {
  const floor = floors.find((f) => f.level === asset.floor);
  const y = floor ? (floor.yBase + 0.001) : 0;
  const room = floor?.rooms?.find((r) => pointInPolygon(asset.x, asset.z, r.vertices));
  return { x: asset.x, z: asset.z, y, roomName: room?.name };
}

/**
 * Asset-position decollision: nudges overlapping markers apart using a
 * golden-angle spiral, maintaining minDist spacing.
 *
 * Returns a Map<assetId, {x, z}> of corrected positions.
 */
export function resolveFloorLayout(
  assets: { id: string; type?: string; floor: number; x: number; y?: number; z: number }[],
  floors: FloorData[],
  minDist = 0.6,
): Map<string, { x: number; z: number }> {
  const out = new Map<string, { x: number; z: number }>();
  const byFloor = new Map<number, typeof assets>();
  for (const a of assets) {
    const lvl = a.floor ?? 0;
    if (!byFloor.has(lvl)) byFloor.set(lvl, []);
    byFloor.get(lvl)!.push(a);
  }
  const spiral = (k: number): [number, number] => {
    // k-th step of a small golden-angle spiral around the anchor
    const r = 0.45 * Math.sqrt(k + 1);
    const t = k * 2.39996323;
    return [r * Math.cos(t), r * Math.sin(t)];
  };
  for (const [, group] of byFloor) {
    const placed = group.map((a) => {
      const r = resolveAssetPosition(a, floors);
      return { id: a.id, x: r.x, z: r.z };
    });
    for (let i = 0; i < placed.length; i++) {
      let attempts = 0;
      for (let j = 0; j < i; j++) {
        const dx = placed[i].x - placed[j].x;
        const dz = placed[i].z - placed[j].z;
        const d = Math.hypot(dx, dz);
        if (d < minDist) {
          // nudge `i` outward along the spiral until it clears all prior
          while (attempts < 24) {
            const [ox, oz] = spiral(attempts);
            placed[i].x = placed[j].x + ox;
            placed[i].z = placed[j].z + oz;
            const nd = Math.hypot(placed[i].x - placed[j].x, placed[i].z - placed[j].z);
            attempts++;
            if (nd >= minDist) break;
          }
        }
      }
    }
    for (const p of placed) out.set(p.id, { x: p.x, z: p.z });
  }
  return out;
}

// ─── Floor boundary helpers ───────────────────────────────────────

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

/** Compute the bounding box that covers all given floors. */
export function buildingGlobalBounds(
  floors: FloorData[],
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const floor of floors) {
    const bounds = floorFootprintBounds(floor);
    if (!bounds) continue;
    if (bounds.cx - bounds.width / 2 < minX) minX = bounds.cx - bounds.width / 2;
    if (bounds.cx + bounds.width / 2 > maxX) maxX = bounds.cx + bounds.width / 2;
    if (bounds.cz - bounds.depth / 2 < minZ) minZ = bounds.cz - bounds.depth / 2;
    if (bounds.cz + bounds.depth / 2 > maxZ) maxZ = bounds.cz + bounds.depth / 2;
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * Compute the walkable area (THREE.Box3) for a given floor,
 * used by the walk-mode camera guard to clamp the player.
 */
export function floorWalkableBounds(floor: FloorData): THREE.Box3 {
  const box = new THREE.Box3();
  if (!floor) {
    box.set(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 0, 10));
    return box;
  }
  const bounds = floorFootprintBounds(floor);
  if (!bounds) {
    box.set(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 0, 10));
    return box;
  }
  const halfW = bounds.width / 2;
  const halfD = bounds.depth / 2;
  box.set(
    new THREE.Vector3(bounds.cx - halfW + 0.5, floor.yBase, bounds.cz - halfD + 0.5),
    new THREE.Vector3(bounds.cx + halfW - 0.5, floor.yBase + floor.height, bounds.cz + halfD - 0.5),
  );
  return box;
}
