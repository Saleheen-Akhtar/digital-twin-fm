# Digital Twin 3D Building — Full Redesign

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the broken/glitchy convention-centre viewer with a validated floor-plan-driven BMS/facility-management-style 3D building.

**Architecture:** Replace hand-placed ZoneData rectangles with closed polygon rooms, derive equipment positions from zone-relative coords, add build-time validation, then rebuild visuals to match the flat translucent BMS aesthetic.

**Style:** Willow/Siemens/Honeywell flat — translucent frosted walls, icon markers per asset type, no photorealism, no HDRIs, no PBR noise.

---

## Phase 1 — Data Model (prerequisite for everything else)

### Task 1.1: Define polygon-based floor-plan types

**Objective:** Replace `ZoneData {cx, cz, w, d}` with a validated polygon schema.

**Files:**
- Modify: `viewer-building.tsx:30-41` (ZoneData → RoomPolygon)
- Modify: `viewer-data.ts:43-58` (add `zoneId` to Asset, add `wallSegment` to zones)

**New types:**

```typescript
/** A 2D point in xz space (floor-plan coords) */
export interface Point2D {
  x: number;
  z: number;
}

/** A wall segment: start → end at a given height */
export interface WallSegment {
  start: Point2D;
  end: Point2D;
  height: number; // floor-relative, metres
}

/** A room defined by its perimeter walls, forming a closed polygon */
export interface RoomPolygon {
  id: string;
  name: string;
  /** Closed polygon vertices in xz space (counter-clockwise, no repeated last vertex) */
  vertices: Point2D[];
  /** Floor-relative Y offset of the floor slab */
  yBase: number;
  /** Ceiling height relative to yBase */
  height: number;
  /** Optional accent colour */
  color?: string;
}

export interface FloorPlan {
  level: number;
  name: string;
  shortLabel?: string;
  yBase: number;
  height: number;
  rooms: RoomPolygon[];
}

// Replace BUILDING_FLOORS type signature from FloorData[] to FloorPlan[]
```

**Migration path:**
Convert the 12 existing zones to rooms with rectangular polygons (4 vertices each) so the rest of the code continues working during the transition. Add a `toRectVertices(cx, cz, w, d)` helper.

```typescript
function rectFromZone(z: ZoneData): Point2D[] {
  const hw = z.w / 2;
  const hd = z.d / 2;
  return [
    { x: z.cx - hw, z: z.cz - hd },
    { x: z.cx + hw, z: z.cz - hd },
    { x: z.cx + hw, z: z.cz + hd },
    { x: z.cx - hw, z: z.cz + hd },
  ];
}
```

**Test:**
- Run `pnpm --filter web typecheck` — must pass
- Run `pnpm --filter web test -- --testPathPattern="viewer-3d"` — must pass (12/12)

### Task 1.2: Point-in-polygon utility + validator

**Objective:** Runtime validator that checks zone overlap and asset-in-zone membership.

**New file:** `viewer-geometry-utils.ts`

```typescript
/**
 * Check if a point is inside a convex polygon using cross-product winding.
 * Polygon vertices in counter-clockwise order.
 */
export function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;
    if ((zi > point.z) !== (zj > point.z) &&
        point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Check if two convex polygons overlap (separating-axis theorem).
 * Works for axis-aligned rectangles — sufficient for the current data.
 */
export function polygonsOverlap(a: Point2D[], b: Point2D[]): boolean {
  // SAT for axis-aligned rects: check x and z projections
  const aMinX = Math.min(...a.map(p => p.x));
  const aMaxX = Math.max(...a.map(p => p.x));
  const aMinZ = Math.min(...a.map(p => p.z));
  const aMaxZ = Math.max(...a.map(p => p.z));
  const bMinX = Math.min(...b.map(p => p.x));
  const bMaxX = Math.max(...b.map(p => p.x));
  const bMinZ = Math.min(...b.map(p => p.z));
  const bMaxZ = Math.max(...b.map(p => p.z));
  return !(aMaxX <= bMinX || bMaxX <= aMinX || aMaxZ <= bMinZ || bMaxZ <= aMinZ);
}

export interface ValidationError {
  type: 'overlap' | 'orphan-asset';
  message: string;
  zoneId?: string;
  assetId?: string;
}

/**
 * Validate a floor plan against its asset list.
 * Fails loudly in dev via console.error with asset/zone IDs.
 */
export function validateFloorPlan(
  floors: FloorPlan[],
  assets: Asset[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const floor of floors) {
    // Check zone overlap
    for (let i = 0; i < floor.rooms.length; i++) {
      for (let j = i + 1; j < floor.rooms.length; j++) {
        if (polygonsOverlap(floor.rooms[i].vertices, floor.rooms[j].vertices)) {
          errors.push({
            type: 'overlap',
            message: `Overlap between "${floor.rooms[i].name}" and "${floor.rooms[j].name}" on ${floor.name}`,
            zoneId: floor.rooms[i].id,
          });
        }
      }
    }

    // Check assets are inside their assigned zone
    const floorAssets = assets.filter(a => a.floor === floor.level);
    for (const asset of floorAssets) {
      if (!asset.zoneId) continue; // skip orphan assets that aren't zone-tagged yet
      const room = floor.rooms.find(r => r.id === asset.zoneId);
      if (!room) {
        errors.push({ type: 'orphan-asset', message: `Asset "${asset.name}" assigned to unknown zone "${asset.zoneId}"`, assetId: asset.id });
        continue;
      }
      // Derive the actual xz from zone-relative coords
      const actualPos = zoneRelativeToWorld(asset, room.vertices);
      if (!pointInPolygon(actualPos, room.vertices)) {
        errors.push({ type: 'orphan-asset', message: `Asset "${asset.name}" (${asset.id}) position (${actualPos.x}, ${actualPos.z}) is outside its zone "${room.name}" on ${floor.name}`, assetId: asset.id });
      }
    }
  }

  if (errors.length > 0 && process.env.NODE_ENV === 'development') {
    console.error('[FloorPlan Validation Failed]');
    for (const e of errors) console.error(`  ❌ ${e.message}`);
  }

  return errors;
}
```

**Test:**
- Add a unit test file `viewer-geometry-utils.test.ts` with basic point-in-polygon and overlap tests
- Run `pnpm --filter web test`

### Task 1.3: Zone-relative asset positioning

**Objective:** Assets store zone-relative coords instead of raw world coords.

**Files:**
- Modify: `viewer-data.ts:43-58` — add `zoneId: string;` and `relativePos: { x: number; z: number }` to Asset interface (x/z as fraction 0-1 within the zone polygon)
- Add: `zoneRelativeToWorld()` in `viewer-geometry-utils.ts`

```typescript
/**
 * Convert zone-relative position (0-1 fraction) to world x,z coords.
 * 0,0 = min-x,min-z corner of polygon bounding box.
 * 1,1 = max-x,max-z corner.
 */
export function zoneRelativeToWorld(
  relative: { x: number; z: number },
  polygon: Point2D[],
): { x: number; z: number } {
  const minX = Math.min(...polygon.map(p => p.x));
  const maxX = Math.max(...polygon.map(p => p.x));
  const minZ = Math.min(...polygon.map(p => p.z));
  const maxZ = Math.max(...polygon.map(p => p.z));
  return {
    x: minX + relative.x * (maxX - minX),
    z: minZ + relative.z * (maxZ - minZ),
  };
}
```

**Update seed assets** in `viewer-data.ts` to include `zoneId` for each asset, mapped to the zone it should be inside.

**Update `AssetMarker3D`** in `viewer-building.tsx` to resolve position via `zoneRelativeToWorld` when `zoneId` is present, falling back to raw coords for backward compat.

**Test:**
- Run `pnpm --filter web build` — must pass
- Run `pnpm --filter web typecheck` — must pass
- Run `pnpm --filter web test` — must pass

### Task 1.4: Run validator at boot

**Objective:** Call `validateFloorPlan()` when floors are loaded, in dev mode only.

**Files:**
- Modify: `viewer-3d.tsx` — call validator in SceneContent or a `useEffect`
- Also call in `viewer-building.tsx` when `BUILDING_FLOORS` is used

Place the call in both `SceneContent` (for runtime API-loaded data) and module scope in `viewer-building.tsx` (for offline fallback).

---

## Phase 2 — Camera Behavior

### Task 2.1: Fix default initial framing

**Files:** `viewer-3d.tsx:130-185` (AutoFocusCamera or CameraAnimation)
**Change:** Compute initial camera position from total building bounding box (min/max x/z of all rooms across all floors). Set `camera.position = [bbox.center.x * 1.4, bbox.maxY * 2, bbox.center.z * 1.4]` with FOV 40-ish for cleaner isometric framing.

### Task 2.2: Per-floor focus on floor select

**Files:** `viewer-3d.tsx` — the animation logic triggered by `selectedFloor`
**Change:** When user clicks L1/L2, compute the bounding box of that floor's rooms, animate camera to frame that box. Use `camera.position.lerp` with ease-out cubic. Distance = `max(bboxW, bboxD) * 1.2`, centered on `(bbox.cx, yBase + height/2, bbox.cz)`.

### Task 2.3: Camera collision bounds

**Files:** `viewer-3d.tsx` — OrbitControls clamp
**Change:** Add `minPolarAngle` and `maxPolarAngle` to prevent going below floor level. Add a `useFrame` check that clamps camera position relative to building extents.

### Task 2.4: Constrained free-walk mode

**Files:** `viewer-3d.tsx` — walkMode logic
**Change:** Replace the current free-walk with a bounded version that reads walkable area from room polygons (union of all rooms on the current floor).

---

## Phase 3 — Materials & Rendering

### Task 3.1: Frosted-glass wall material

**Files:** `viewer-building.tsx` — ExteriorWalls and any interior partitions
**Change:** Replace `meshStandardMaterial` with `transparent opacity={0.3} roughness={0.1} metalness={0.05} color="#e2e8f0"`. Remove bumpMap/roughnessMap from previous changes.

### Task 3.2: Functional lighting (remove Environment)

**Files:** `viewer-3d.tsx:225-266`
**Change:** Remove the `<Environment>` component entirely. Keep ambient + 2 directional lights. Optionally add a single warm directional and a single cool directional for clear shape definition.

### Task 3.3: Icon-style equipment markers

**Files:** `viewer-building.tsx:1360-1401` (renderShape in AssetMarker3D)
**Change:** Replace sphere/cylinder/box primitives with flat-shaded icon pins per asset type. Use `<Html>` with SVG icons (lightbulb, fan, pump, chiller symbols) or R3F `<Text>` billboards with material icons. Scale and color by status (existing STATUS_COLORS logic unchanged).

### Task 3.4: Simplify furniture/MEP

**Files:** `viewer-interior.tsx`
**Change:** Adjust existing furniture/MEP props (desks, server racks, ducts) to flat low-poly shapes. Remove detailed geometry, use simple box planes with consistent material.

---

## Phase 4 — Labels (verify, don't regress)

### Task 4.1: Zone labels hover/select-only

**Files:** `viewer-building.tsx` — ZoneOverlay / ZoneLabel components
**Change:** Re-verify that zone labels only show on hover or selection, never always-on. The PR #15 changes should already have this, but re-verify after Phase 1 polygon migration changes the anchor positions.

---

## Verification Plan

After each task:
```bash
pnpm --filter web build     # must exit 0
pnpm --filter web typecheck  # must exit 0
pnpm --filter web test       # all tests pass
```

Final acceptance:
1. No visual clipping at any camera angle or floor selection
2. Default page load shows correct full-building framing
3. Validation errors surface loudly in dev console for overlap/out-of-bounds
4. Translucent walls, flat shading, icon markers
5. Zone labels hover/select-only
6. Per-floor framing adapts to occupied area
