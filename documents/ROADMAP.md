# Roadmap — Digital Twin FM

## Phase 0 — Documentation precision

- Finalize architecture decisions.
- Add MVP scope.
- Add database schema.
- Add API contracts.
- Add realtime events.
- Add maintenance module spec.

## Phase 1 — Monorepo foundation

- Scaffold pnpm workspace + Turborepo.
- Add `apps/web`, `apps/api-gateway`, `apps/ingestion-service`, `apps/ai-service`.
- Add `packages/ui`, `packages/db`, `packages/types`, `packages/config`.
- Add Docker Compose for PostgreSQL/TimescaleDB and Redis.
- Add CI workflow.

## Phase 2 — Core data model and API

- Implement Drizzle schema.
- Add migrations and seed data.
- Implement buildings/floors/rooms/assets/sensors modules.
- Add JWT auth and RBAC.

## Phase 3 — Dashboard and monitoring

- Implement dashboard shell.
- Implement asset list/detail.
- Implement sensor readings API.
- Add charts with Recharts.

## Phase 4 — Ingestion and realtime

- Implement HTTP sensor ingestion.
- Store readings in TimescaleDB.
- Publish Redis events.
- Implement WebSocket gateway.
- Show live sensor updates in frontend.

## Phase 5 — Alerts and maintenance

- Implement threshold alerts.
- Implement alerts list/detail/acknowledge/resolve.
- Implement work orders and maintenance logs.
- Create work orders from alerts.

## Phase 6 — Digital twin MVP

- Add simplified 3D or GLB/GLTF model view.
- Overlay asset markers and statuses.
- Link markers to asset details.

## Phase 7 — AI service MVP

- Add AI service health and copilot endpoints.
- Add simple rule-based anomaly explanation.
- Add provider abstraction for future LLM integrations.

## Post-MVP / full product

The MVP roadmap above is intentionally focused. The full commercial product direction is documented in [`full_product/`](./full_product/README.md), including:

- enterprise architecture,
- real IoT/BMS integration,
- BIM/IFC digital twin viewer,
- AI service maturity,
- observability,
- data retention,
- enterprise security,
- deployment strategy,
- mobile/PWA strategy,
- reporting and analytics.
