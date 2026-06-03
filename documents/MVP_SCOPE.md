# MVP Scope — Digital Twin FM

## MVP objective

Build a demo-ready facility management platform that shows a live operational view of a facility using seeded/simulated data.

The MVP should prove:
- the monorepo works,
- core services run locally,
- facility data is modeled correctly,
- sensor readings can stream live,
- alerts and work orders can be managed,
- the UI is usable for facility managers.

## Included in MVP

### Core platform

- Turborepo + pnpm workspace scaffold.
- Next.js web app.
- NestJS API gateway.
- Node.js ingestion service.
- Python FastAPI AI service skeleton.
- PostgreSQL + TimescaleDB + Redis using Docker Compose.
- GitHub Actions CI.

### Web UI

- Login screen or mock-auth flow.
- Dashboard overview.
- Building/floor selector.
- Asset list and asset detail page.
- Live sensor monitoring page.
- Alerts list and alert detail/acknowledge flow.
- Maintenance work orders list/detail/create/update flow.
- Basic digital twin view using simplified model or placeholder GLB/GLTF.

### Backend

- REST API for buildings, floors, rooms, assets, sensors, alerts, work orders, users.
- WebSocket channel for live sensor and alert updates.
- JWT + role-based access control.
- Drizzle migrations.
- Seed data for a demo facility.

### Ingestion

- HTTP endpoint for simulated sensor readings.
- Validation and normalization.
- Store readings in TimescaleDB hypertable.
- Publish realtime events through Redis.

### AI service

- Health endpoint.
- Basic copilot endpoint with stubbed/provider-ready implementation.
- Basic anomaly explanation using deterministic rules.

## Excluded from MVP

- Full BIM/IFC model ingestion.
- Real physical IoT integration.
- Kafka/Redpanda/NATS.
- Kubernetes/Helm production deployment.
- Complex predictive maintenance ML.
- Enterprise SSO/SAML/OIDC.
- Mobile app.
- Multi-tenant billing.
- Advanced permissions matrix.

## MVP success criteria

- `pnpm install` completes.
- `docker compose up` starts Postgres/TimescaleDB and Redis.
- `pnpm dev` starts web/api/ingestion services.
- Seed data creates at least one building, floors, rooms, assets, sensors, alerts, and work orders.
- A simulated sensor reading appears in the frontend without page refresh.
- Creating a work order from the UI persists to the database.
- CI runs lint, typecheck, tests, and build.

## Recommended first build order

1. Monorepo scaffold.
2. Shared config/types/ui/db packages.
3. Docker Compose database and Redis.
4. Drizzle schema and seed data.
5. API gateway core modules.
6. Web dashboard shell.
7. Ingestion service and realtime WebSocket.
8. Alerts and maintenance flows.
9. Basic digital twin view.
10. AI service skeleton.
