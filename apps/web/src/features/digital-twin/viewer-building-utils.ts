/**
 * Digital Twin FM -- Procedural Building (types, data, pure utilities)
 *
 * Extracted from viewr-building.tsx so that viewer-3d.tsx can import
 * the small (<5 KiB) data layer without pulling in the 80 KiB R3F
 * component chunk (2097 lines of Floor, Building, etc.).
 *
 * Everything here is either a type, a constant, or a pure function
 * with no R3F / React dependency.
 */

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
  cx: number;
  cz: number;
  w: number;
  d: number;
  color?: string;
}

export interface FloorData {
  level: number;
  name: string;
  shortLabel?: string;
  yBase: number;
  height: number;
  zones: ZoneData[];
  rooms?: RoomPolygon[];
}

// ─── Building dimensions (from design-system/tokens) ────────────────

export const W = 36;
export const D = 24;
export const HALF_W = W / 2;
export const HALF_D = D / 2;
export const SLAB_T = 0.4;

// ─── Polygon helpers ──────────────────────────────────────────────

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
 * Ray-casting point-in-polygon test.
 */
export function pointInPolygon(x: number, z: number, vertices: Point2D[]): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, zi = vertices[i].z;
    const xj = vertices[j].x, zj = vertices[j].z;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
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
 * Check whether two convex polygons overlap.
 */
export function polygonsOverlap(a: Point2D[], b: Point2D[]): boolean {
  for (const v of a) {
    if (pointInPolygon(v.x, v.z, b)) return true;
  }
  for (const v of b) {
    if (pointInPolygon(v.x, v.z, a)) return true;
  }
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i], p2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const q1 = b[j], q2 = b[(j + 1) % b.length];
      if (segmentsIntersect(p1, p2, q1, q2)) return true;
    }
  }
  return false;
}

// ─── Validation ──────────────────────────────────────────────────

export function validateFloorPlan(
  floors: FloorData[],
  assets?: Array<{ id: string; floor: number; x: number; z: number }>,
): void {
  for (const floor of floors) {
    const rooms = floor.rooms ?? [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        if (polygonsOverlap(rooms[i].vertices, rooms[j].vertices)) {
          console.error(
            `[validateFloorPlan] OVERLAP: rooms "${rooms[i].id}" and "${rooms[j].id}" on floor ${floor.level} (${floor.name}) overlap. Fix the floor-plan data.`,
          );
        }
      }
    }
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

export function worldToRelativePosition(
  room: RoomPolygon, x: number, z: number,
): { relX: number; relZ: number } {
  const b = roomBounds(room);
  return {
    relX: (x - b.minX) / (b.maxX - b.minX || 1),
    relZ: (z - b.minZ) / (b.maxZ - b.minZ || 1),
  };
}

export function relativeToWorldPosition(
  room: RoomPolygon, relX: number, relZ: number,
): { x: number; z: number } {
  const b = roomBounds(room);
  return {
    x: b.minX + Math.max(0, Math.min(1, relX)) * (b.maxX - b.minX),
    z: b.minZ + Math.max(0, Math.min(1, relZ)) * (b.maxZ - b.minZ),
  };
}

export function clampToRoom(
  room: RoomPolygon | undefined, x: number, z: number,
): { x: number; z: number } {
  if (!room || room.vertices.length < 3) return { x, z };
  if (pointInPolygon(x, z, room.vertices)) return { x, z };
  const b = roomBounds(room);
  return {
    x: Math.max(b.minX, Math.min(b.maxX, x)),
    z: Math.max(b.minZ, Math.min(b.maxZ, z)),
  };
}

export function findRoomAt(floors: FloorData[], floorLevel: number, x: number, z: number): RoomPolygon | undefined {
  const floor = floors[floorLevel];
  if (!floor) return undefined;
  return (floor.rooms ?? []).find(r => pointInPolygon(x, z, r.vertices));
}

export function resolveAssetPosition(
  asset: { id: string; type?: string; floor: number; x: number; y?: number; z: number },
  floors: FloorData[],
): { x: number; y: number; z: number } {
  const rawX = asset.x ?? 0;
  const rawZ = asset.z ?? 0;
  const floorLevel = asset.floor ?? 0;
  const floor = floors[floorLevel];
  let room: RoomPolygon | undefined;
  if (floor) {
    room = (floor.rooms ?? []).find(r => pointInPolygon(rawX, rawZ, r.vertices));
  }
  const clamped = clampToRoom(room, rawX, rawZ);
  const floorY = floor?.yBase ?? 6.5;
  const floorHeight = floor?.height ?? 8.5;
  const ceilingMounted = ["Air Handler", "Fan", "Lighting"].includes(asset.type ?? "");
  const deskMounted = (asset.type ?? "") === "Sensor" || (asset.type ?? "") === "Equipment";
  let inferredY: number;
  if (ceilingMounted) inferredY = floorY + floorHeight - 0.3;
  else if (deskMounted) inferredY = floorY + 0.78;
  else inferredY = floorY;
  return { x: clamped.x, y: asset.y ?? inferredY, z: clamped.z };
}

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
    const r = 0.45 * Math.sqrt(k + 1);
    return [r * Math.cos(k * 2.39996323), r * Math.sin(k * 2.39996323)];
  };
  for (const [, group] of byFloor) {
    const placed = group.map(a => {
      const r = resolveAssetPosition(a, floors);
      return { id: a.id, x: r.x, z: r.z };
    });
    for (let i = 0; i < placed.length; i++) {
      let attempts = 0;
      for (let j = 0; j < i; j++) {
        const dx = placed[i].x - placed[j].x;
        const dz = placed[i].z - placed[j].z;
        if (Math.hypot(dx, dz) < minDist) {
          while (attempts < 24) {
            const [ox, oz] = spiral(attempts);
            placed[i].x = placed[j].x + ox;
            placed[i].z = placed[j].z + oz;
            attempts++;
            if (Math.hypot(placed[i].x - placed[j].x, placed[i].z - placed[j].z) >= minDist) break;
          }
        }
      }
    }
    for (const p of placed) out.set(p.id, { x: p.x, z: p.z });
  }
  return out;
}

export function floorFootprintBounds(floor: FloorData): { cx: number; cz: number; width: number; depth: number } | undefined {
  const rooms = floor.rooms ?? [];
  if (rooms.length === 0) return undefined;
  const allXs = rooms.flatMap(r => r.vertices.map(v => v.x));
  const allZs = rooms.flatMap(r => r.vertices.map(v => v.z));
  const minX = Math.min(...allXs);
  const maxX = Math.max(...allXs);
  const minZ = Math.min(...allZs);
  const maxZ = Math.max(...allZs);
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ };
}

export function buildingGlobalBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const allRooms = BUILDING_FLOORS.flatMap(f => f.rooms ?? []);
  if (allRooms.length === 0) return { minX: -18, maxX: 18, minZ: -12, maxZ: 12 };
  const allXs = allRooms.flatMap(r => r.vertices.map(v => v.x));
  const allZs = allRooms.flatMap(r => r.vertices.map(v => v.z));
  return { minX: Math.min(...allXs), maxX: Math.max(...allXs), minZ: Math.min(...allZs), maxZ: Math.max(...allZs) };
}

export function floorWalkableBounds(floorIndex: number): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const floor = BUILDING_FLOORS.find(f => f.level === floorIndex);
  let minX = -18, maxX = 18, minZ = -12, maxZ = 12;
  if (floor) {
    const b = floorFootprintBounds(floor);
    if (b) {
      minX = b.cx - b.width / 2;
      maxX = b.cx + b.width / 2;
      minZ = b.cz - b.depth / 2;
      maxZ = b.cz + b.depth / 2;
    }
  }
  return { minX, maxX, minZ, maxZ };
}

// ─── Building constants ────────────────────────────────────────────

/**
 * Demo default — 2-floor convention centre.
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
      { id: "1a", name: "Main Entrance", cx: 0, cz: -10, w: 16, d: 4.5, color: "#3b82f6" },
      { id: "1b", name: "Hall A — West", cx: -9.5, cz: 2, w: 13, d: 11, color: "#60a5fa" },
      { id: "1c", name: "Hall A — East", cx: 9.5, cz: 2, w: 13, d: 11, color: "#60a5fa" },
      { id: "1d", name: "Concourse", cx: 0, cz: -5.5, w: 14, d: 3.5, color: "#93c5fd" },
      { id: "1e", name: "Restrooms", cx: -13, cz: 9.75, w: 4, d: 3.5, color: "#bfdbfe" },
      { id: "1f", name: "Meeting Rooms", cx: 13, cz: 9.75, w: 4, d: 3.5, color: "#bfdbfe" },
      { id: "1g", name: "Plant Room", cx: -1, cz: 9.75, w: 14, d: 3.5, color: "#64748b" },
    ],
    rooms: [
      { id: "1a", name: "Main Entrance", vertices: rectVertices(0, -10, 16, 4.5), color: "#3b82f6" },
      { id: "1b", name: "Hall A — West", vertices: rectVertices(-9.5, 2, 13, 11), color: "#60a5fa" },
      { id: "1c", name: "Hall A — East", vertices: rectVertices(9.5, 2, 13, 11), color: "#60a5fa" },
      { id: "1d", name: "Concourse", vertices: rectVertices(0, -5.5, 14, 3.5), color: "#93c5fd" },
      { id: "1e", name: "Restrooms", vertices: rectVertices(-13, 9.75, 4, 3.5), color: "#bfdbfe" },
      { id: "1f", name: "Meeting Rooms", vertices: rectVertices(13, 9.75, 4, 3.5), color: "#bfdbfe" },
      { id: "1g", name: "Plant Room", vertices: rectVertices(-1, 9.75, 14, 3.5), color: "#64748b" },
    ],
  },
  {
    level: 1,
    name: "Level 2 · Upper Mezzanine",
    shortLabel: "L2",
    yBase: 9.0,
    height: 8.5,
    zones: [
      { id: "2a", name: "Hall B — West", cx: -10, cz: 0, w: 14, d: 6, color: "#a78bfa" },
      { id: "2b", name: "Hall B — East", cx: 10, cz: 0, w: 14, d: 6, color: "#a78bfa" },
      { id: "2c", name: "VIP Lounge", cx: 0, cz: -8, w: 10, d: 6, color: "#c4b5fd" },
      { id: "2d", name: "Terrace", cx: 0, cz: 8, w: 16, d: 6, color: "#ddd6fe" },
      { id: "2e", name: "Control Room", cx: -HALF_W + 4, cz: -6, w: 6, d: 5, color: "#8b5cf6" },
      { id: "2f", name: "Mezzanine Lobby", cx: 0, cz: -2.65, w: 5, d: 4, color: "#e0e0e0" },
    ],
    rooms: [
      { id: "2a", name: "Hall B — West", vertices: rectVertices(-10, 0, 14, 6), color: "#a78bfa" },
      { id: "2b", name: "Hall B — East", vertices: rectVertices(10, 0, 14, 6), color: "#a78bfa" },
      { id: "2c", name: "VIP Lounge", vertices: rectVertices(0, -8, 10, 6), color: "#c4b5fd" },
      { id: "2d", name: "Terrace", vertices: rectVertices(0, 8, 16, 6), color: "#ddd6fe" },
      { id: "2e", name: "Control Room", vertices: rectVertices(-HALF_W + 4, -6, 6, 5), color: "#8b5cf6" },
      { id: "2f", name: "Mezzanine Lobby", vertices: rectVertices(0, -2.65, 5, 4), color: "#e0e0e0" },
    ],
  },
];
