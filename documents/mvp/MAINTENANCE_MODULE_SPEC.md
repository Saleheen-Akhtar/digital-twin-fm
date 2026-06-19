# Maintenance Module Specification — Digital Twin FM

## Owner

Primary domain owner: Sahil.

## Purpose

The maintenance domain connects assets, alerts, and facility actions. However, the full maintenance module is **not part of the MVP**.

The product should first prove:

```text
Digital Twin + Live Sensors + AI Insight
```

Then add deeper CMMS/work-order workflows after the core value proposition is validated.

## Scope decision

### MVP scope

Keep only:

- asset registry,
- asset detail,
- asset status,
- latest sensor readings,
- linked open alerts,
- AI maintenance recommendation text,
- asset health summary.

### Post-MVP / Phase 7 scope

Move these later:

- work orders,
- technician assignment,
- work order lifecycle,
- maintenance history,
- maintenance logs,
- comments/attachments,
- create work order from alert,
- technician workflow.

## Why full maintenance is deferred

A full maintenance module is effectively a mini-CMMS system. It includes workflow state, permissions, assignments, activity logs, notifications, and technician UX.

That is valuable, but it should not block the MVP demo.

For the demo, customers are more likely to remember:

```text
3D/spatial building view
+ live sensors
+ AI explanation
+ building health score
```

than a work-order form.

## MVP asset registry capabilities

- View asset registry.
- View asset detail with:
  - status,
  - type/category,
  - location,
  - latest readings,
  - open alerts,
  - health score/status,
  - AI maintenance suggestion.
- Filter assets by building/floor/zone/type/status.
- Link an asset to a digital twin marker.
- Show alert status on asset cards and twin markers.

## MVP frontend structure

```text
apps/web/src/features/assets/
  components/
    AssetTable.tsx
    AssetDetailPanel.tsx
    AssetStatusBadge.tsx
    AssetHealthSummary.tsx
    AssetTwinMarker.tsx
  hooks/
    useAssets.ts
    useAsset.ts
  services/
    assets.api.ts
  store/
    asset-ui.store.ts
  types/
    asset.types.ts
  index.ts
```

Optional placeholder for future maintenance navigation:

```text
apps/web/src/features/maintenance/
  README.md              # explains deferred post-MVP scope
```

Do not build full work-order screens for the demo unless the core digital twin + AI demo is already complete.

## MVP backend structure

```text
apps/api-gateway/src/domains/assets/
  assets.module.ts
  assets.controller.ts
  assets.service.ts
  assets.dto.ts
  assets.repository.ts
```

Optional future placeholder:

```text
apps/api-gateway/src/domains/maintenance/
  README.md              # deferred Phase 7 scope
```

## MVP API endpoints

Asset registry endpoints:

- `GET /api/assets`
- `GET /api/assets/:assetId`
- `GET /api/assets/:assetId/readings/latest`
- `GET /api/assets/:assetId/alerts`
- `GET /api/assets/:assetId/health`

AI-assisted asset insight:

- `POST /api/ai/asset-health-summary`

Example request:

```json
{
  "assetId": "uuid",
  "timeRange": "24h"
}
```

Example response:

```json
{
  "assetId": "uuid",
  "healthStatus": "warning",
  "summary": "AHU-03 has elevated energy usage and longer runtime than expected.",
  "evidence": [
    { "metric": "energy_kw", "change": "+22%", "period": "last_24h" }
  ],
  "suggestedActions": [
    "Check AHU schedule",
    "Inspect cooling setpoint",
    "Review occupancy pattern"
  ]
}
```

## Deferred work-order lifecycle

The future work-order lifecycle remains:

```text
open -> assigned -> in_progress -> completed
open -> cancelled
assigned -> blocked -> in_progress
in_progress -> blocked -> in_progress
```

Allowed statuses:

- `open`
- `assigned`
- `in_progress`
- `blocked`
- `completed`
- `cancelled`

This lifecycle belongs to Phase 7/post-MVP, not the MVP.

## Deferred work-order endpoints

Do not implement these for the demo unless explicitly re-scoped:

- `GET /api/work-orders`
- `POST /api/work-orders`
- `GET /api/work-orders/:workOrderId`
- `PATCH /api/work-orders/:workOrderId`
- `PATCH /api/work-orders/:workOrderId/status`
- `POST /api/work-orders/:workOrderId/logs`
- `POST /api/alerts/:alertId/create-work-order`

## Future permissions

Future CMMS permissions:

| Action | admin | facility_manager | technician | viewer |
|---|---|---|---|---|
| View work orders | yes | yes | assigned only | yes |
| Create work order | yes | yes | no | no |
| Assign technician | yes | yes | no | no |
| Change status | yes | yes | assigned only | no |
| Add log | yes | yes | assigned only | no |
| Cancel work order | yes | yes | no | no |

MVP asset registry permissions should remain simpler:

| Action | admin | facility_manager | technician | viewer |
|---|---|---|---|---|
| View assets | yes | yes | yes | yes |
| View asset health | yes | yes | yes | yes |
| Edit asset metadata | yes | yes | no | no |

## MVP acceptance criteria

- Facility manager can view the asset registry.
- Facility manager can open asset detail.
- Asset detail shows location, status, latest readings, and open alerts.
- Asset appears as a marker in the digital twin viewer.
- Alert state can change the asset marker/status color.
- AI can produce a short asset-health explanation with evidence.

## Post-MVP acceptance criteria

When Phase 7 begins:

- Facility manager can create a work order for an asset.
- Facility manager can assign a technician.
- Technician can move assigned work order to `in_progress` and `completed`.
- Every status change creates a maintenance log row.
- Work order created from alert stores `alert_id`.
- Work order list can be filtered by `status` and `priority`.
