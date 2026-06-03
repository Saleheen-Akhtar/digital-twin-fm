# Post-MVP Architecture — Digital Twin FM

## Purpose

This document explains how the MVP architecture should evolve into the full product architecture without unnecessary rewrites.

## Architecture philosophy

The MVP should be simple, but not disposable.

Recommended evolution:

```text
MVP simplicity -> pilot reliability -> enterprise scalability
```

Avoid introducing heavy infrastructure before there is a real need, but keep boundaries clean so upgrades are straightforward.

## MVP baseline

```text
Next.js web
NestJS api-gateway
Node.js ingestion-service
Python FastAPI ai-service
PostgreSQL + TimescaleDB
Redis Pub/Sub
Docker Compose
GitHub Actions
```

## Full product target architecture

```text
Web/PWA clients
  -> API gateway / BFF
  -> domain services / modules
  -> PostgreSQL/TimescaleDB
  -> event streaming layer
  -> ingestion connector framework
  -> AI service and model pipelines
  -> observability stack
```

## Service evolution

### Web app

MVP:
- One Next.js app.
- Dashboard, alerts, maintenance, digital twin view.

Full product:
- Responsive PWA support.
- Role-specific navigation.
- Offline-tolerant technician workflows.
- Large-model viewer performance optimizations.
- Possible separate operator wallboard or executive portal only if needed.

### API gateway

MVP:
- NestJS REST API and WebSocket gateway.
- Domain modules in one service.

Full product:
- Keep one API gateway/BFF for frontend-facing APIs.
- Split backend services only when domain scaling or team ownership requires it.
- Use clear module boundaries before physical microservice separation.

Do not split into microservices too early. A modular monolith API gateway is acceptable until there is clear pressure.

### Ingestion service

MVP:
- HTTP sensor ingestion.
- Redis Pub/Sub events.

Full product:
- Connector plugin framework.
- Device registry.
- Connector health checks.
- Durable ingestion queue/event stream.
- Backpressure handling.
- Dead-letter queue.
- Raw payload archive.

### AI service

MVP:
- FastAPI skeleton.
- Rule-based anomaly explanation.

Full product:
- RAG service.
- Model provider abstraction.
- Predictive model training/inference pipeline.
- Evaluation harness.
- AI governance and permissions.

## Data architecture evolution

### MVP

```text
buildings -> floors -> rooms -> assets -> sensors -> sensor_readings
alerts -> work_orders -> maintenance_logs
```

### Full product

Add:

```text
organizations
sites
zones
asset_relationships
devices
connectors
sensor_mappings
audit_logs
attachments
reports
model_versions
model_object_mappings
```

Recommended hierarchy:

```text
organization
  -> site
    -> building
      -> floor
        -> zone/room
          -> asset
            -> sensor
```

## Event architecture evolution

### MVP

```text
Redis Pub/Sub
```

Good for live UI notifications.

### Full product

Evaluate durable event streaming when needed:

| Option | Use case |
|---|---|
| Redis Streams | Simple persistence and consumer groups |
| NATS JetStream | Lightweight durable messaging |
| Redpanda/Kafka | High-volume event streaming and replay |
| RabbitMQ | Work queues and routing |

Do not use Kafka only because it sounds enterprise. Choose it only if sensor volume, replay, and data pipelines justify it.

## API architecture evolution

### MVP

- REST first.
- WebSockets for live updates.

### Full product

- Keep REST for operational CRUD.
- Add event subscriptions for live UI.
- Consider GraphQL only if frontend aggregation becomes painful.
- Consider public/customer APIs only after internal contracts stabilize.

## Deployment architecture evolution

### Stage 1: MVP/demo

- Docker Compose local.
- Simple staging environment.

### Stage 2: pilot

- Single VM or small VM cluster.
- Managed PostgreSQL/Timescale if possible.
- Managed Redis if possible.
- Caddy/Nginx reverse proxy.
- Automated backups.

### Stage 3: enterprise

- Kubernetes/Helm only if needed.
- Private cloud/on-prem options.
- Secret manager.
- Centralized observability.
- Blue/green or rolling deployment.

## Migration principles

- Keep shared contracts in `packages/types`.
- Keep database schema in `packages/db`.
- Keep feature domains isolated by module.
- Avoid direct cross-domain imports in frontend.
- Avoid hidden coupling between ingestion and API gateway.
- Events should be versioned.
- Database migrations should be forward-only and reviewed.

## Architecture risks

| Risk | Mitigation |
|---|---|
| Overbuilding microservices | Start modular, split later |
| Redis Pub/Sub data loss | Add durable stream when real ingestion starts |
| AI security leakage | Scope all AI context by user permissions |
| 3D viewer complexity | Support GLB/GLTF before IFC/BIM |
| Database growth | Timescale compression, retention, aggregates |
| Vendor integration complexity | Build connector framework and mapping UI |
