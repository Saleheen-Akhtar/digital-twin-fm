# Maintenance Module Specification — Digital Twin FM

## Owner

Primary domain owner: Sahil.

## Purpose

The maintenance module manages assets, work orders, and maintenance activity. It connects facility issues from alerts/sensors to actionable technician work.

## MVP capabilities

- View asset registry.
- View asset detail with status, location, latest sensor readings, open alerts, and work orders.
- Create work order manually.
- Create work order from an alert.
- Assign work order to technician.
- Update work order status.
- Add maintenance log notes.
- Track priority and due date.

## Work order lifecycle

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

Priorities:
- `low`
- `medium`
- `high`
- `critical`

## Frontend structure

```text
apps/web/src/features/maintenance/
  components/
    WorkOrderTable.tsx
    WorkOrderDetail.tsx
    WorkOrderForm.tsx
    WorkOrderStatusBadge.tsx
    AssetMaintenanceSummary.tsx
  hooks/
    useWorkOrders.ts
    useWorkOrder.ts
    useCreateWorkOrder.ts
    useUpdateWorkOrderStatus.ts
  services/
    maintenance.api.ts
  store/
    maintenance-ui.store.ts
  types/
    maintenance.types.ts
  index.ts
```

## Backend structure

```text
apps/api-gateway/src/domains/maintenance/
  maintenance.module.ts
  maintenance.controller.ts
  maintenance.service.ts
  maintenance.dto.ts
  maintenance.repository.ts
```

## API endpoints

- `GET /api/work-orders`
- `POST /api/work-orders`
- `GET /api/work-orders/:workOrderId`
- `PATCH /api/work-orders/:workOrderId`
- `PATCH /api/work-orders/:workOrderId/status`
- `POST /api/work-orders/:workOrderId/logs`
- `POST /api/alerts/:alertId/create-work-order`

## Permissions

| Action | admin | facility_manager | technician | viewer |
|---|---|---|---|---|
| View work orders | yes | yes | assigned only | yes |
| Create work order | yes | yes | no | no |
| Assign technician | yes | yes | no | no |
| Change status | yes | yes | assigned only | no |
| Add log | yes | yes | assigned only | no |
| Cancel work order | yes | yes | no | no |

## UI pages

### Work orders list

Path:
```text
/maintenance/work-orders
```

Features:
- Filter by status, priority, assignee, asset.
- Sort by due date and priority.
- Quick status badge.
- Create button for managers/admins.

### Work order detail

Path:
```text
/maintenance/work-orders/[id]
```

Features:
- Work order summary.
- Linked asset and alert.
- Status transition buttons.
- Maintenance log timeline.
- Assigned technician.

### Asset maintenance view

Path:
```text
/assets/[id]
```

Maintenance section:
- Open work orders.
- Past completed work.
- Latest related alerts.

## Acceptance criteria

- Facility manager can create a work order for an asset.
- Facility manager can assign a technician.
- Technician can move assigned work order to `in_progress` and `completed`.
- Every status change creates a maintenance log row.
- Work order created from alert stores `alert_id`.
- Work order list can be filtered by `status` and `priority`.
