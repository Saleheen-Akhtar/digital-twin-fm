# IoT Integration Strategy — Digital Twin FM

## Purpose

This document defines how Digital Twin FM should evolve from simulated sensor ingestion to real facility/BMS/IoT integrations.

## MVP vs full product

MVP:
- HTTP endpoint for simulated readings.
- Known sensor IDs from seed data.
- Redis Pub/Sub for live UI.

Full product:
- Connector framework for real protocols and vendor APIs.
- Device registry.
- Sensor mapping UI.
- Connector health monitoring.
- Durable ingestion pipeline.
- Data quality and dead-letter handling.

## Target integration types

| Integration | Purpose | Priority |
|---|---|---|
| HTTP/Webhook | Simple vendor APIs and simulator | MVP |
| MQTT | Common IoT telemetry | High |
| BACnet | Building automation systems | High for facilities |
| Modbus | Industrial equipment/meters | Medium/high |
| OPC-UA | Industrial systems | Medium |
| Vendor REST APIs | Cloud BMS/EMS platforms | Medium |
| CSV/import | Historical/manual onboarding | Medium |
| File drop/SFTP | Legacy integration | Later |

## Connector architecture

Recommended folder structure:

```text
apps/ingestion-service/src/
  connectors/
    connector.interface.ts
    http.connector.ts
    mqtt.connector.ts
    bacnet.connector.ts
    modbus.connector.ts
    opcua.connector.ts
    vendor-rest.connector.ts
  registry/
    device-registry.service.ts
    sensor-mapping.service.ts
  processors/
    normalize-reading.ts
    validate-reading.ts
    threshold-evaluator.ts
    data-quality.ts
  publishers/
    readings.repository.ts
    event-publisher.ts
    dead-letter.publisher.ts
  health/
    connector-health.service.ts
```

Connector interface should standardize:

```text
connect()
disconnect()
readHealth()
subscribe()/poll()
normalize(rawPayload)
```

## Device registry

Full product should track devices separately from sensors.

Example `devices` table:

| Column | Notes |
|---|---|
| id | uuid |
| organization_id | owner |
| site_id | location |
| connector_id | source connector |
| external_device_id | ID from source system |
| name | display name |
| protocol | mqtt, bacnet, modbus, opcua, http |
| status | online, offline, degraded, unknown |
| metadata | jsonb |
| last_seen_at | timestamp |

## Sensor mapping

Real integrations rarely match internal IDs directly. Need mapping:

```text
external source point -> internal sensor_id
```

Example fields:

| Field | Meaning |
|---|---|
| connector_id | which integration source |
| external_point_id | source point name/id |
| sensor_id | internal sensor |
| unit | source unit |
| transform | optional scaling/conversion rule |
| enabled | mapping active/inactive |

## Data normalization

All readings must normalize to:

```json
{
  "sensorId": "uuid",
  "time": "2025-08-01T10:00:00Z",
  "value": 23.7,
  "unit": "°C",
  "quality": "good",
  "source": {
    "connectorId": "uuid",
    "deviceId": "uuid",
    "externalPointId": "AHU01_TEMP"
  },
  "metadata": {}
}
```

## Data quality states

Use explicit quality values:

- `good`
- `estimated`
- `stale`
- `out_of_range`
- `bad`
- `unknown_sensor`
- `invalid_unit`

Bad readings should not silently become live dashboard values.

## Dead-letter handling

Invalid readings should go to a dead-letter store/queue with:

- raw payload,
- connector ID,
- error code,
- error message,
- received time,
- retryable flag.

Reasons:
- unknown sensor,
- invalid timestamp,
- invalid value,
- failed unit conversion,
- database write failure,
- connector parsing error.

## Connector health

Each connector should expose:

- status: `healthy`, `degraded`, `offline`, `error`,
- last successful read,
- last error,
- messages processed,
- messages failed,
- ingestion lag,
- reconnect count.

UI should show connector status for operators/admins.

## Security

Production ingestion must authenticate data sources.

Options:
- per-device API keys,
- MQTT credentials/certificates,
- request signing,
- IP allowlist for private deployments,
- source system tokens,
- per-connector secrets in secret manager.

Never expose production ingestion endpoint publicly without authentication.

## Reliability requirements

- Idempotent writes where possible.
- Deduplicate readings by `sensor_id + time + source`.
- Retry transient failures.
- Avoid blocking all ingestion because one connector fails.
- Preserve raw payloads when troubleshooting is needed.
- Track ingestion lag.

## Upgrade path

1. HTTP simulator.
2. HTTP real vendor connector.
3. MQTT connector.
4. Device registry and mapping UI.
5. Dead-letter handling.
6. Connector health dashboard.
7. BACnet/Modbus/OPC-UA based on pilot facility needs.
8. Durable event stream if Redis Pub/Sub is insufficient.
