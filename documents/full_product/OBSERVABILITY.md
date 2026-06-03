# Observability — Digital Twin FM

## Purpose

This document defines how the full product should be monitored, debugged, and operated in production.

Observability is required because Digital Twin FM will run multiple services, ingest live data, support realtime dashboards, and may influence facility operations.

## Observability pillars

- Logs.
- Metrics.
- Traces.
- Health checks.
- Alerts.
- Dashboards.

## MVP baseline

MVP should include:
- health endpoints,
- Docker logs,
- structured logs where possible,
- request IDs in API gateway,
- basic service status checks.

## Full-product target stack

Recommended stack:

| Capability | Tooling |
|---|---|
| Metrics | Prometheus |
| Dashboards | Grafana |
| Logs | Loki or centralized log platform |
| Tracing | OpenTelemetry |
| Error tracking | Sentry or equivalent |
| Uptime checks | external uptime monitor or cloud monitor |

## Logging standards

All services should log structured JSON in production.

Common fields:

```text
timestamp
level
service
environment
request_id
user_id nullable
organization_id nullable
site_id nullable
message
error nullable
metadata nullable
```

Rules:
- Do not log secrets.
- Do not log full JWTs.
- Mask API keys and credentials.
- Avoid logging large raw sensor payloads unless explicitly in debug/dead-letter mode.

## Request IDs

Every incoming HTTP request should receive a request ID.

The request ID should propagate through:
- web/API requests,
- API gateway logs,
- AI service calls,
- ingestion processing where applicable,
- error responses.

## Metrics to track

### API gateway

- request count,
- request latency,
- error rate,
- status codes,
- auth failures,
- WebSocket connections,
- WebSocket broadcast failures.

### Ingestion service

- readings received,
- readings accepted,
- readings rejected,
- processing latency,
- ingestion lag,
- connector status,
- connector reconnect count,
- dead-letter count.

### Database

- connection pool usage,
- slow queries,
- insert rate for sensor readings,
- table/hypertable size,
- migration status,
- backup status.

### Redis/event system

- publish rate,
- subscriber errors,
- queue/stream lag if using durable stream,
- connection failures.

### AI service

- request count,
- latency,
- model/provider used,
- token/cost estimate,
- errors/timeouts,
- unauthorized/context-filtered requests,
- user feedback rating.

## Health endpoints

Each service should expose:

```text
GET /health
GET /ready
```

`/health` checks whether the service process is alive.

`/ready` checks dependencies:
- database,
- Redis/event system,
- AI provider if required,
- connector readiness if applicable.

## Dashboards

Recommended dashboards:

1. Platform overview.
2. API gateway health.
3. Ingestion health.
4. Connector health.
5. Database/TimescaleDB health.
6. WebSocket/realtime health.
7. AI service usage and errors.
8. Customer/site operational health.

## Alerting

Operational alerts should notify the team when:

- service is down,
- database unavailable,
- Redis unavailable,
- ingestion lag exceeds threshold,
- connector offline,
- error rate spikes,
- disk usage high,
- backup fails,
- AI provider failures spike.

## Incident response

Full product should include runbooks for:

- API outage,
- database outage,
- ingestion stopped,
- connector misconfigured,
- WebSocket not updating,
- AI service unavailable,
- backup restore,
- bad sensor data flood.

## Acceptance criteria

- Every service has health/readiness endpoints.
- Logs include service and request ID.
- Production metrics are available in dashboards.
- Alerts exist for critical service failures.
- Backup failures are monitored.
- Ingestion lag and connector health are visible.
