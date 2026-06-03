# Realtime Events — Digital Twin FM

## Transport

- Ingestion/API internal events: Redis Pub/Sub.
- Browser events: WebSocket from `api-gateway`.

## WebSocket endpoint

```text
/ws
```

The client authenticates using the same JWT used for REST API, either by secure cookie or connection token.

## Standard event envelope

```json
{
  "type": "sensor.reading.created",
  "version": 1,
  "timestamp": "2025-08-01T10:00:00Z",
  "payload": {}
}
```

## Event types

### `sensor.reading.created`

```json
{
  "type": "sensor.reading.created",
  "version": 1,
  "timestamp": "2025-08-01T10:00:00Z",
  "payload": {
    "sensorId": "uuid",
    "assetId": "uuid",
    "buildingId": "uuid",
    "value": 23.7,
    "unit": "°C",
    "quality": "good"
  }
}
```

### `asset.status.changed`

```json
{
  "type": "asset.status.changed",
  "version": 1,
  "timestamp": "2025-08-01T10:00:00Z",
  "payload": {
    "assetId": "uuid",
    "buildingId": "uuid",
    "previousStatus": "ok",
    "status": "warn",
    "reason": "temperature threshold exceeded"
  }
}
```

### `alert.created`

```json
{
  "type": "alert.created",
  "version": 1,
  "timestamp": "2025-08-01T10:00:00Z",
  "payload": {
    "alertId": "uuid",
    "buildingId": "uuid",
    "assetId": "uuid",
    "sensorId": "uuid",
    "severity": "warn",
    "title": "AHU-01 temperature warning"
  }
}
```

### `alert.updated`

```json
{
  "type": "alert.updated",
  "version": 1,
  "timestamp": "2025-08-01T10:00:00Z",
  "payload": {
    "alertId": "uuid",
    "status": "acknowledged",
    "acknowledgedBy": "uuid"
  }
}
```

### `work_order.created`

```json
{
  "type": "work_order.created",
  "version": 1,
  "timestamp": "2025-08-01T10:00:00Z",
  "payload": {
    "workOrderId": "uuid",
    "buildingId": "uuid",
    "assetId": "uuid",
    "priority": "high",
    "status": "open"
  }
}
```

### `work_order.updated`

```json
{
  "type": "work_order.updated",
  "version": 1,
  "timestamp": "2025-08-01T10:00:00Z",
  "payload": {
    "workOrderId": "uuid",
    "previousStatus": "assigned",
    "status": "in_progress"
  }
}
```

## Client subscription guidance

For MVP, one authenticated WebSocket connection can receive all building events the user is allowed to view.

Later, add subscription filters:

```json
{ "action": "subscribe", "buildingId": "uuid", "eventTypes": ["sensor.reading.created", "alert.created"] }
```

## Reconnect behavior

- Client should reconnect with exponential backoff.
- After reconnect, client should refetch REST summaries to avoid missed events.
- WebSocket events are live notifications, not the source of truth.
