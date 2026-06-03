# Data Retention — Digital Twin FM

## Purpose

This document defines how Digital Twin FM should retain, aggregate, compress, back up, restore, and delete operational data in the full product.

## Data categories

| Data type | Examples | Notes |
|---|---|---|
| Time-series readings | temperature, energy, vibration, occupancy | High volume |
| Operational records | alerts, work orders, maintenance logs | Business critical |
| Asset metadata | equipment, locations, mappings | Long-lived |
| User/security data | users, roles, audit logs | Sensitive |
| AI data | prompts, responses, citations, embeddings | Govern carefully |
| Model files | GLB/GLTF/IFC/BIM files | Large objects |
| Raw integration payloads | connector data, dead-letter payloads | Useful for debugging |

## Time-series retention strategy

Sensor data can grow quickly. Use TimescaleDB features:

- hypertables,
- compression,
- continuous aggregates,
- retention policies.

Recommended starting policy:

| Data | Retention |
|---|---|
| Raw high-frequency readings | 30-90 days depending on volume |
| 1-minute aggregates | 1 year |
| 1-hour aggregates | 3-5 years |
| Daily aggregates | 5+ years if useful for energy reporting |

Exact retention should be configurable per customer/site.

## Aggregation examples

Continuous aggregates:

```text
sensor_readings_1m
sensor_readings_1h
energy_usage_daily
asset_health_daily
alert_counts_daily
```

For each bucket, store:
- average,
- min,
- max,
- count,
- last value,
- quality summary.

## Operational data retention

Recommended:

| Table | Retention |
|---|---|
| assets | retain while active + archive after decommission |
| work_orders | retain 5+ years or customer policy |
| maintenance_logs | retain with work orders |
| alerts | retain 2-5 years depending on customer policy |
| audit_logs | retain 1-7 years depending on compliance |
| users | retain active; anonymize/deactivate after offboarding where required |

## Raw payload retention

Raw connector payloads are useful but can be large.

Recommended:
- Store only failed/dead-letter payloads by default.
- Optionally store raw payloads for selected connectors during onboarding/debugging.
- Retain raw payloads for 7-30 days unless customer needs longer.

## Backup strategy

Back up:
- PostgreSQL/TimescaleDB,
- uploaded model files,
- document/RAG source files,
- configuration/secrets metadata where appropriate,
- deployment manifests.

Recommended backup schedule:

| Environment | Frequency |
|---|---|
| local/dev | no formal backup |
| staging | daily backup optional |
| pilot/prod | daily full backup + point-in-time recovery if possible |

## Restore requirements

Backups are only useful if restores are tested.

Define:
- RPO: maximum acceptable data loss.
- RTO: maximum acceptable restore time.
- restore procedure,
- responsible owner,
- test frequency.

Minimum full-product expectation:
- monthly restore test for production-like backup,
- documented restore steps,
- restore verification checklist.

## Deletion and archival

Full product should support:
- asset decommissioning,
- user deactivation,
- customer data export,
- customer data deletion if required,
- archive of old model versions.

Avoid hard deleting records that are part of operational history unless required by policy.

## AI data retention

AI data may include sensitive operational context.

Rules:
- Do not log raw prompts/responses indefinitely by default.
- Mask secrets and credentials.
- Store AI interactions only if there is product value and customer consent/policy.
- Retain citations and generated recommendations linked to actions when operationally important.

## Data quality and lineage

Sensor readings should preserve enough metadata to answer:

- where did this reading come from?
- which connector/device produced it?
- was it transformed?
- was the quality good or estimated?
- was it used to create an alert?

## Acceptance criteria

- Retention policy is documented per data type.
- TimescaleDB compression/aggregation plan exists.
- Backups are automated for production.
- Restore process is tested.
- Raw payload storage is controlled.
- AI data retention is governed.
