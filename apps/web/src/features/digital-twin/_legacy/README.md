# Legacy viewer — DO NOT IMPORT

`viewer.tsx-LEGACY-DO-NOT-USE` is the original raw-Three.js viewer
(`DigitalTwinViewer`) that was replaced by `viewer-3d.tsx`
(`DigitalTwinViewer3D`).

It is kept here only as a reference for the migration diff.

**Reasons it was retired:**

1. Hardcoded `floorCount={5}` while the actual convention-hall
   building is 2 floors — the source of the "AI says 5, model shows 2"
   mismatch.
2. Hardcoded 18m × 14m tower geometry that didn't match the
   `design-system/tokens.ts` convention-hall proportions (36m × 24m).
3. Custom asset markers and status legend that didn't match the
   R3F-based marker system in `viewer-building.tsx`.
4. No floor isolation, walk mode, zone selection, or live KPI overlay.

**If you need anything from this file:** port the idea into
`viewer-3d.tsx`. Do not import this component anywhere.
