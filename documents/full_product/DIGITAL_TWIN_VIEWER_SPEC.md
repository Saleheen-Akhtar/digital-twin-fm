# Digital Twin Viewer Specification — Digital Twin FM

## Purpose

This document defines the full-product direction for the 2D/3D digital twin viewer. The MVP may use a simplified GLB/GLTF model or placeholder visualization, but the full product should support realistic facility navigation and asset overlays.

## Viewer goals

The viewer should help users answer:

- Where is this asset located?
- Which area is unhealthy right now?
- What sensor or alert is attached to this equipment?
- Which floor/zone is affected?
- What work orders are open in this area?

## MVP viewer

- Simplified 3D model or 2D/floor placeholder.
- Asset markers.
- Status colors.
- Click marker -> asset detail.
- Basic floor selector.

## Full-product viewer

- GLB/GLTF support.
- IFC/BIM import support or integration.
- Model versioning.
- Asset-to-model-object mapping.
- Floor/zone isolation.
- Sensor overlays.
- Alert heatmaps.
- Object selection and metadata panel.
- Performance optimizations for large models.

## Candidate technologies

| Technology | Use |
|---|---|
| Three.js | Core 3D rendering |
| React Three Fiber | React integration |
| drei | Common Three.js helpers |
| web-ifc / IFC.js / ThatOpen Engine | IFC/BIM parsing and rendering |
| xeokit | Alternative BIM viewer for large models |

Recommendation:
- MVP: React Three Fiber + GLB/GLTF.
- Full product: evaluate IFC/BIM requirements after pilot facility model availability is known.

## Model lifecycle

Full product should handle:

1. Upload/import model.
2. Validate model.
3. Generate optimized web version.
4. Store model metadata.
5. Map assets to model objects.
6. Version model updates.
7. Preserve mappings across versions where possible.

Potential model tables:

```text
model_versions
model_objects
asset_model_mappings
```

## Asset-to-object mapping

Assets in the database must be linkable to 3D/BIM objects.

Mapping fields:

| Field | Meaning |
|---|---|
| asset_id | internal asset |
| model_version_id | model version |
| object_external_id | IFC GUID or GLTF node ID |
| mapping_confidence | manual, imported, inferred |
| created_by | user/service |
| created_at | timestamp |

## Viewer interactions

Required interactions:

- Pan/orbit/zoom.
- Select building/floor/zone.
- Search asset by name/type/status.
- Click model object or marker.
- Highlight asset by status.
- Show sensor value overlays.
- Show active alerts.
- Open linked work orders.

## Status visualization

Use consistent status colors from design tokens:

| Status | Meaning |
|---|---|
| ok | normal |
| warn | degraded/anomaly |
| crit | critical/failure |
| offline | no data/unavailable |
| maintenance | under maintenance |

## Performance requirements

The viewer should define budgets:

- Initial model load under acceptable network conditions.
- Smooth interaction on target laptops.
- Progressive loading for large models.
- Hide or simplify non-visible floors/zones.
- Avoid rendering thousands of labels at once.
- Use instancing or clustering for markers.

## Data overlay requirements

Overlays should be driven by API/realtime events, not hardcoded model metadata.

Overlay sources:
- latest sensor readings,
- asset status,
- active alerts,
- open work orders,
- energy/occupancy heatmaps.

## Versioning concerns

Real buildings change. Model updates must not break asset history.

Rules:
- Never delete old model versions immediately.
- Mappings should reference a specific model version.
- New model upload should run mapping reconciliation.
- Manual remapping should be available for changed objects.

## Acceptance criteria for full product

- User can navigate building/floor/zone visually.
- User can find an asset in the viewer from search or asset detail.
- User can click a model object/marker and see current status.
- Active alerts are visually represented.
- Model update does not erase existing asset records.
- Viewer remains usable with realistic facility model size.
