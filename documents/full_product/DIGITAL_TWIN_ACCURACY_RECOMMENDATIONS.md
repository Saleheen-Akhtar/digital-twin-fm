# Digital Twin Viewer — Accuracy & Dynamism Refactor

**Date:** 2026-06-27
**Scope:** Singapore Expo Hall 7 demo + dynamic-multi-floor support
**Status:** Implemented

---

## 1. Problem statement

The viewer and the database disagreed about how many floors the demo
building has:

| Layer | Reported |
|---|---|
| `design-system/tokens.ts` | **2** floors (canonical, ignored) |
| `seed.ts` | **5** floors + `totalFloors: 5` |
| `viewer-building.tsx` | **3** floors (Basement + L1 + L2) |
| `viewer-data.ts` | **4** floors (`floor: 0\|1\|2\|3`) |
| `viewer-store.ts` | 0..3 in `FloorFilter` |
| `viewer.tsx` (dead code) | **5** floors (`floorCount={5}`) |
| `_landing/data.ts` | "**5** Building Floors" marketing stat |
| AI copilot | **5** floors (inherited the lie from the DB) |
| `viewer-3d.tsx` AI suggestions | "Why is **Floor 3** hot?" (no such floor) |

The customer-facing symptom: "the AI says 5 floors but the model only
shows 2." Every layer assumed a different number. None of them read
from the others.

## 2. Strategy

**The viewer must be a Digital Twin, not a demo fixture.** Future
customers will onboard with buildings of 3, 5, 10, or 20 floors. The
viewer cannot be re-deployed per customer. Therefore:

1. **Tokens hold design *proportions*, not data.** `building.floorCount`
   stays at 2 as the demo default, but the viewer reads the actual
   floor count from the API at boot.
2. **Floor unions widen from `0 \| 1` to `number`.** TypeScript stops
   enforcing a count we don't actually want to enforce — the count is
   data, not type.
3. **Hardcoded `BUILDING_FLOORS` becomes `buildDefaultFloors(N)`.**
   When the API supplies per-floor metadata (zones, yBase, height),
   those win. When it doesn't, we fall back to N evenly-stacked floors.
4. **Runtime invariants in dev.** Drift between the seed and the
   design tokens surfaces as a `console.error` (dev) or a thrown error
   (test). Never as a silent visual mismatch.
5. **Floor-selector labels are data-driven.** Each floor carries its
   own `shortLabel` ("L1", "B1", "M", "Roof") — the UI doesn't try to
   guess from the floor's level index.

## 3. What changed

### 3.1 `packages/db/src/seed.ts`

- `BUILDING_FLOOR_COUNT = 2`, `FLOOR_NAMES = ["Exhibition Level",
  "Upper Mezzanine"]`, `ROOM_NAMES` expanded to 4-zone layout
  (N/S/E/W) per floor.
- Asset distribution rebuilt to match real convention-hall MEP:
  - Floor 1: 3 AHU + 2 Chiller + 5 Lighting + 1 Fan + 1 Elevator +
    2 Boiler + 1 Pump = 15 (boilers/chillers/pumps clustered in the
    back-of-house plant room)
  - Floor 2: 2 Pump + 2 Fan + 1 Lighting = 5
- Sensor sets are now type-aware. AHUs get temperature/humidity/
  pressure/power. Chillers get chilled-water temp + flow + power +
  vibration. Lights only get power. (Previously every asset got a
  random subset, which made the data look fake.)
- Asset positions are now deterministic and inside the building
  footprint. Plant-room equipment clusters at (−16..−10, +6..+10) —
  a real back-of-house location.
- Drift warning at end of seed: if the inserted floor count ≠
  `BUILDING_FLOOR_COUNT`, log a `⚠️` and the floor names.

### 3.2 `apps/web/src/design-system/tokens.ts`

Unchanged. `building.floorCount: 2` remains the demo default. Future
PR will change this to `1` and force every layer to handle `N ≥ 1`
floors.

### 3.3 `apps/web/src/features/digital-twin/viewer-data.ts`

- `AssetFloor` widened from `0 \| 1` to `number`.
- `SEED_ASSETS` rebuilt to 20 assets across the 2 demo floors, matching
  the seed distribution.
- `apiAssetToViewerAsset` removed the `0 \| 1 \| 2 \| 3` literal cast
  in favor of a clamped `Math.floor(a.floorLevel) - 1`. Clamps to
  non-negative integers; a malformed seed with `floorLevel=99` no
  longer crashes the viewer.
- **New runtime invariant at module load:** every `SEED_ASSETS` floor
  must satisfy `0 ≤ floor < building.floorCount`. Violations throw
  under `NODE_ENV=test`, `console.error` otherwise.

### 3.4 `apps/web/src/features/digital-twin/viewer-store.ts`

- `FloorFilter` widened from `"ALL" \| 0 \| 1` to `"ALL" \| number`.
  The floor-selector buttons are generated at runtime from the actual
  floor list, not from the type.

### 3.5 `apps/web/src/features/digital-twin/viewer-building.tsx`

- `BUILDING_FLOORS` retained as the **offline fallback** for tests and
  when the API is down. Each floor now carries an explicit
  `shortLabel` ("L1", "L2") so the floor-selector button label is
  data, not derived from the index.
- **New `buildDefaultFloors(count)` factory.** Builds N evenly-stacked
  floors for any building. Caps at 64 to prevent runaway UI from a
  bad API response.
- Strict drift check softened to a `console.warn` in dev (was
  `throw`) since real customer buildings override this with API data.

### 3.6 `apps/web/src/features/digital-twin/viewer-3d.tsx`

- Floor-selector button label now reads `floor.shortLabel` with a
  `L{level+1}` fallback.
- AI copilot suggestion "Why is **Floor 3** hot?" → "Why is the **upper
  level** hot?". Stub fallback responses rewritten to reference
  AHU-001, Chiller 1, etc. (assets that actually exist in the demo).

### 3.7 `apps/web/src/features/digital-twin/viewer-3d.test.tsx`

- Test expects `All + L1 + L2` (was `All + B1 + L1 + L2`).
- "Highlights active floor" test uses `selectedFloor: 0` (was 1) to
  match the new convention where level 0 = Exhibition Level.

### 3.8 `apps/web/src/app/_landing/data.ts`

- `STATS.items.Building Floors` value now reads `B.floorCount` from
  design tokens. The hero overrides this at render time with the API
  count when available.

### 3.9 `apps/web/src/features/digital-twin/_legacy/viewer.tsx-LEGACY-DO-NOT-USE`

The original raw-Three.js viewer with `floorCount={5}` is moved into
`_legacy/` with a README explaining why. Verified zero imports remain.

## 4. What this enables (future PR)

The viewer can now onboard a customer building with N floors in 3 steps:

1. **Schema:** add `floors.yBase numeric`, `floors.height numeric`,
   `floors.zones jsonb` so each floor carries its own 3D metadata.
2. **API:** `GET /buildings/:id/floors` returns the full floor list.
3. **Boot:** `viewer-3d.tsx` fetches the list on mount, calls
   `buildDefaultFloors(N)` if zones are missing, and replaces
   `BUILDING_FLOORS` for the lifetime of the session.

No frontend re-deploy needed.

## 5. Recommendations for production readiness

### 5.1 Schema enrichment (this sprint)

```sql
ALTER TABLE floors ADD COLUMN y_base numeric NOT NULL DEFAULT 0;
ALTER TABLE floors ADD COLUMN height numeric NOT NULL DEFAULT 3.6;
ALTER TABLE floors ADD COLUMN zones jsonb NOT NULL DEFAULT '[]'::jsonb;
```

`zones` shape (matches `ZoneData` in `viewer-building.tsx`):
```json
[
  { "id": "1a", "name": "Main Entrance", "cx": 0, "cz": 8, "w": 14, "d": 6, "color": "#3b82f6" }
]
```

### 5.2 Building config endpoint (next sprint)

`GET /buildings/:id/config` returns:
```json
{
  "building": { "id": "...", "name": "...", "totalFloors": 5 },
  "floors": [
    { "level": 0, "name": "Ground", "shortLabel": "G", "yBase": 0, "height": 4.5, "zones": [...] },
    ...
  ],
  "footprint": { "widthM": 36, "depthM": 24 },
  "maxDistance": 120
}
```

The viewer boot flow becomes:
1. `viewer-3d.tsx` mounts → `useBuildingConfig(buildingId)` hook.
2. While loading: render `BUILDING_FLOORS` (offline fallback) with a
   skeleton state.
3. On success: `setFloors(data.floors)`, recompute camera bounds,
   update `CAM.maxDistance`.
4. On failure: keep fallback + log warning.

### 5.3 Asset Y-coordinate reconciliation

Today the seed sets `positionY` randomly inside a vertical range. A
real building has deterministic per-floor Y bands. The viewer should
derive `positionY` from `floors[floor].yBase + assetHeight/2` instead
of trusting the DB column. Suggested approach:

- Add `asset.height` column (default 2m).
- Viewer reads `floors[floor].yBase + asset.height/2` and overrides
  `positionY` at the marker-render boundary.
- DB `positionY` becomes advisory; the viewer treats it as a hint.

### 5.4 Schema-enforced asset positions

Real customers will have CAD-imported positions (`revit-export.json`).
Add `assets.positionValid boolean DEFAULT false` and a one-time
importer that writes `positionX/Y/Z` from the CAD file. Until then,
the seed's deterministic grid keeps the demo looking correct.

### 5.5 End-to-end test for floor consistency

`apps/web/e2e/twin-floor-consistency.spec.ts`:

```ts
test("viewer, AI, and DB all agree on floor count", async () => {
  const api = await page.request.get("/api/buildings/9a83477a-...");
  const { totalFloors } = await api.json();
  expect(totalFloors).toBe(2);

  await page.goto("/dashboard");
  const buttons = await page.locator('[data-testid^="floor-button-"]').count();
  expect(buttons).toBe(2); // L1, L2

  await page.locator('[data-testid="ai-copilot"]').click();
  await page.locator('[data-testid="ai-suggestion-how-many-floors"]').click();
  const answer = await page.locator('[data-testid="ai-answer"]').textContent();
  expect(answer).toMatch(/2 floor/i);
});
```

This is the test that would have caught the original bug pre-merge.

### 5.6 AI grounding

Append to the AI system prompt in `apps/ai-service/app/routers/copilot.py`:

```
This building has exactly ${building.totalFloors} floors.
If asked about a floor outside that range, say so explicitly
("There is no floor 3 in this building").
```

This stops the LLM from hallucinating "Floor 3" in a 2-floor demo
or "Floor 12" in a 5-floor customer building.

### 5.7 Visual fidelity (post-MVP)

- Replace `LiveAirHandler/LiveChiller/etc.` primitives with GLTF
  imports from real equipment vendors. Trane, Carrier, Daikin publish
  SketchUp/Revit models under permissive licenses.
- Add real skylights, MEP ductwork visible through transparent floor
  slabs in walk mode, signage, loading-dock doors.
- Animated HVAC airflow: moving particles along duct paths when a
  zone's AHU is on.
- Live occupancy heatmap overlay.

### 5.8 Sync guarantees (operational)

- Nightly cron asserts `building.totalFloors === count(floors rows)`
  in the DB. Email on drift.
- Add the `seeds:check` script that runs both `pnpm db:seed` (in a
  scratch DB) and a unit test that reads `BUILDING_FLOORS.length`,
  asserting equality.
- Add `pnpm lint:drift` that greps for hardcoded floor counts in
  `.tsx/.ts` files outside of `_legacy/`.

---

## 6. Files touched

| File | Action |
|---|---|
| `packages/db/src/seed.ts` | 2 floors, type-aware sensors, drift warning |
| `apps/web/src/features/digital-twin/viewer-data.ts` | `AssetFloor = number`, runtime invariant |
| `apps/web/src/features/digital-twin/viewer-store.ts` | `FloorFilter = "ALL" \| number` |
| `apps/web/src/features/digital-twin/viewer-building.tsx` | `shortLabel`, `buildDefaultFloors(N)` |
| `apps/web/src/features/digital-twin/viewer-3d.tsx` | label from `shortLabel`, AI copy |
| `apps/web/src/features/digital-twin/viewer-3d.test.tsx` | updated tests |
| `apps/web/src/app/_landing/data.ts` | stats read from tokens |
| `apps/web/src/features/digital-twin/_legacy/viewer.tsx-LEGACY-DO-NOT-USE` | quarantined |
| `apps/web/src/features/digital-twin/_legacy/README.md` | new |
| `documents/full_product/DIGITAL_TWIN_ACCURACY_RECOMMENDATIONS.md` | this file |
