# Architecture — Digital Twin FM

## Decision summary

Digital Twin FM will use a **pnpm workspace + Turborepo monorepo** for MVP. The architecture is modular-service-first: code lives in one repository, but runtime responsibilities are separated into clear services.

## Selected MVP stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Fast MVP setup, simple caching/task orchestration |
| Frontend | Next.js 15, React 19, TypeScript | App Router, dashboard UI |
| Styling/UI | Tailwind CSS, shadcn/ui, Radix UI, `packages/ui` | Shared components and tokens |
| Server state | TanStack Query / React Query | API data only |
| UI state | Zustand | Selected building/floor/asset, filters, panel state |
| Charts | Recharts | MVP analytics and time-series charts |
| 3D | React Three Fiber, Three.js, drei | Start with GLB/GLTF or simplified 3D model |
| API gateway | NestJS, TypeScript | REST, WebSockets, auth, domain modules |
| Ingestion | Node.js TypeScript | HTTP ingestion first, MQTT connector later |
| AI service | Python 3.11, FastAPI, Pydantic | AI copilot, anomaly explanations, predictive maintenance later |
| Database | PostgreSQL 16 + TimescaleDB | Relational + time-series sensor readings |
| ORM | Drizzle ORM | Type-safe schema/migrations for Node services |
| Realtime | Redis Pub/Sub + WebSockets | Live sensor/alert updates |
| Auth | JWT + RBAC | SSO later |
| Infra | Docker Compose + GitHub Actions | Kubernetes post-MVP only |
| Reverse proxy | Caddy recommended | HTTPS for staging/prod |

## Runtime services

```text
apps/web                 Next.js web UI
apps/api-gateway         NestJS REST API + WebSocket gateway
apps/ingestion-service   Node.js sensor intake and normalization
apps/ai-service          FastAPI AI/RAG/anomaly service
postgres/timescaledb     relational + time-series database
redis                    cache + pub/sub event bus
```

## Service responsibilities

### `apps/web`

- Authenticated dashboard UI.
- Building/floor navigation.
- Sensor charts and live cards.
- Alerts and maintenance screens.
- 3D or simplified digital twin viewer.
- Uses React Query for server data.
- Uses Zustand only for local UI state.

### `apps/api-gateway`

- Public REST API for frontend.
- WebSocket server for live updates.
- JWT authentication and RBAC authorization.
- Domain modules: buildings, assets, sensors, monitoring, alerts, maintenance, users, reporting.
- Calls `ai-service` for AI features.
- Subscribes to Redis events from ingestion.

### `apps/ingestion-service`

- Accepts sensor readings from HTTP for MVP.
- Normalizes and validates sensor payloads.
- Persists readings to TimescaleDB.
- Publishes live events to Redis.
- MQTT connector is later-stage.

### `apps/ai-service`

- Exposes FastAPI endpoints for AI copilot and anomaly explanations.
- Reads relevant data through API/database integration.
- MVP should use simple explainable rules before complex ML.
- Provider abstraction for OpenAI/Anthropic/local models should be added before production AI usage.

## Main data flows

### Real-time sensor flow

```text
sensor/simulator
  -> ingestion-service HTTP endpoint
  -> validate + normalize
  -> insert into sensor_readings hypertable
  -> publish Redis event
  -> api-gateway subscribes
  -> WebSocket broadcast
  -> web updates live UI
```

### Alert flow

```text
sensor reading
  -> threshold evaluation in ingestion-service or api-gateway domain service
  -> create/update alert in PostgreSQL
  -> publish alert event
  -> web receives alert update over WebSocket
```

### Maintenance flow

```text
asset issue / alert / user action
  -> api-gateway maintenance module
  -> work_order created/updated
  -> assigned technician updates status
  -> maintenance_logs record actions
```

### AI flow

```text
web asks question
  -> api-gateway validates/authenticates
  -> ai-service receives scoped context request
  -> AI returns answer/citations/suggestions
  -> api-gateway returns response to web
```

## API style

MVP uses **REST first**. GraphQL is not part of MVP.

Reasons:
- Easier for the team.
- Clear endpoint ownership.
- Works well for CRUD-heavy facility software.
- Easier to test and document.

## Realtime style

MVP uses WebSocket messages from `api-gateway` to `web`.

Redis Pub/Sub is enough for MVP. Kafka/Redpanda/NATS are later options only if event volume grows.

## Database ownership

For MVP, `api-gateway` owns relational business tables through `packages/db` Drizzle schema. `ingestion-service` may write sensor readings directly using shared DB helpers or a narrow repository package.

Avoid duplicate schema definitions. Shared types should live in `packages/types`; DB schema should live in `packages/db`.

## Authentication and authorization

MVP uses JWT auth and role-based access control.

Roles:
- `admin`
- `facility_manager`
- `technician`
- `viewer`

SSO/OIDC/SAML should be designed later for enterprise customers.

## Scalability rules

Start simple:
- Docker Compose before Kubernetes.
- Redis before Kafka.
- REST before GraphQL.
- Simple anomaly rules before complex ML.
- GLB/GLTF or simplified 3D before IFC/BIM.

Upgrade only when real requirements demand it.
