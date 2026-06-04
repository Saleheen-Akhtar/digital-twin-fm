# API Contracts — Digital Twin FM

## API principles

- MVP uses REST under `/api`.
- JSON request/response bodies.
- Authenticated endpoints require an authorization header, for example `Authorization: Bearer YOUR_ACCESS_TOKEN`.
- Use consistent response envelopes for lists and errors.
- Validate inputs at the API boundary.

## Standard error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": []
  }
}
```

## Auth

### `POST /api/auth/login`

Request:
```json
{ "email": "manager@example.com", "password": "password" }
```

Response:
```json
{
  "accessToken": "jwt",
  "user": { "id": "uuid", "name": "Facility Manager", "role": "facility_manager" }
}
```

### `GET /api/auth/me`

Returns current user.

## Buildings

### `GET /api/buildings`

Response:
```json
{
  "items": [
    { "id": "uuid", "name": "Singapore Expo", "status": "ok", "timezone": "Asia/Singapore" }
  ]
}
```

### `GET /api/buildings/:buildingId`

Returns building detail with summary counts.

### `GET /api/buildings/:buildingId/floors`

Returns floors for a building.

### `GET /api/floors/:floorId/rooms`

Returns rooms for a floor.

## Assets

### `GET /api/assets`

Query parameters:
- `buildingId`
- `floorId`
- `roomId`
- `status`
- `assetType`
- `search`

### `POST /api/assets`

Request:
```json
{
  "buildingId": "uuid",
  "floorId": "uuid",
  "roomId": "uuid",
  "name": "AHU-01",
  "assetType": "hvac",
  "manufacturer": "ExampleCo",
  "model": "X100"
}
```

### `GET /api/assets/:assetId`

Returns asset detail including location, status, latest sensor readings, open alerts, and asset health summary.

### `PATCH /api/assets/:assetId`

Updates asset metadata/status.

## Sensors and monitoring

### `GET /api/sensors`

Query parameters: `assetId`, `roomId`, `sensorType`, `status`.

### `GET /api/sensors/:sensorId/readings`

Query parameters:
- `from` ISO datetime
- `to` ISO datetime
- `bucket` e.g. `1m`, `5m`, `1h`

Response:
```json
{
  "sensorId": "uuid",
  "unit": "°C",
  "points": [
    { "time": "2025-08-01T10:00:00Z", "value": 23.4 }
  ]
}
```

### `GET /api/monitoring/live-summary`

Returns latest readings grouped by building/floor/asset for dashboard cards.

## Alerts

### `GET /api/alerts`

Query parameters: `buildingId`, `severity`, `status`, `assetId`.

### `GET /api/alerts/:alertId`

Returns alert detail.

### `POST /api/alerts/:alertId/acknowledge`

Response returns updated alert.

### `POST /api/alerts/:alertId/resolve`

Request:
```json
{ "resolutionNotes": "Issue checked and resolved." }
```

### `POST /api/alerts/:alertId/ai-explain`

Returns an AI/rule-based explanation of why the alert triggered and recommended next checks.

## Asset health

### `GET /api/assets/:assetId/health`

Returns computed MVP asset health.

Response:
```json
{
  "assetId": "uuid",
  "status": "warning",
  "score": 82,
  "factors": [
    { "name": "Energy", "status": "warning", "impact": -8 },
    { "name": "Open Alerts", "status": "warning", "impact": -5 }
  ]
}
```

### `POST /api/ai/asset-health-summary`

Returns a short AI-assisted asset health explanation.

## Maintenance / work orders — deferred

Full work-order APIs are **post-MVP** and should not block the Expo build:

- `GET /api/work-orders`
- `POST /api/work-orders`
- `GET /api/work-orders/:workOrderId`
- `PATCH /api/work-orders/:workOrderId`
- `PATCH /api/work-orders/:workOrderId/status`
- `POST /api/work-orders/:workOrderId/logs`
- `POST /api/alerts/:alertId/create-work-order`

## Ingestion service

### `POST /ingest/sensor-reading`

Request:
```json
{
  "sensorId": "uuid",
  "value": 23.7,
  "unit": "°C",
  "time": "2025-08-01T10:00:00Z",
  "quality": "good",
  "metadata": {}
}
```

Response:
```json
{ "accepted": true }
```

## AI service through API gateway

### `POST /api/ai/copilot/query`

Request:
```json
{
  "question": "Why is AHU-01 in warning state?",
  "buildingId": "uuid",
  "assetId": "uuid"
}
```

Response:
```json
{
  "answer": "AHU-01 is warning because vibration readings exceeded the configured threshold for 15 minutes.",
  "citations": [],
  "suggestedActions": ["Inspect AHU schedule", "Check vibration trend", "Review cooling setpoint"]
}
```

### `POST /api/ai/anomaly/explain`

Request:
```json
{ "sensorId": "uuid", "from": "2025-08-01T09:00:00Z", "to": "2025-08-01T10:00:00Z" }
```
