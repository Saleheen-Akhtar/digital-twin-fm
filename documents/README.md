# Digital Twin for Intelligent Facility Management

A real-time digital twin platform that gives facility managers a live 3D view of their building — sensor readings, equipment health, energy consumption, and active incidents — all in one place.

> **MVP target:** Singapore Expo, August 2025

---

## Table of Contents

- [Documentation](#documentation)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Running Services](#running-services)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Feature Domains](#feature-domains)
- [Team Ownership](#team-ownership)
- [Contributing](#contributing)
- [CI/CD](#cicd)

---

## Documentation

| Document | Description |
|---|---|
| [MVP_SCOPE.md](./MVP_SCOPE.md) | MVP boundaries, success criteria, and first build order |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, stack decisions, services, and data flows |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Core PostgreSQL/TimescaleDB tables and seed data expectations |
| [API_CONTRACTS.md](./API_CONTRACTS.md) | REST endpoint contracts and example payloads |
| [REALTIME_EVENTS.md](./REALTIME_EVENTS.md) | Redis/WebSocket event names and message shapes |
| [MAINTENANCE_MODULE_SPEC.md](./MAINTENANCE_MODULE_SPEC.md) | Maintenance domain scope, workflows, permissions, and UI/API structure |
| [SECURITY.md](./SECURITY.md) | Authentication, RBAC, secrets, ingestion, and AI security boundaries |
| [FILE_STRUCTURE.md](./FILE_STRUCTURE.md) | Full directory breakdown and team ownership |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Branch strategy, code standards, PR and review process |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Local, staging, and production deployment guide |
| [TECHNICAL_PRD.md](./TECHNICAL_PRD.md) | Full product requirements and feature specs |
| [ROADMAP.md](./ROADMAP.md) | MVP implementation phases and near-term build order |
| [full_product/README.md](./full_product/README.md) | Full commercial product roadmap and enterprise-grade post-MVP specifications |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui/Radix UI |
| 3D Viewer | React Three Fiber + Three.js + drei; GLB/GLTF or simplified model for MVP |
| State | Zustand (UI state only), React Query/TanStack Query (server state) |
| Backend | Node.js 20 + NestJS (api-gateway), Python 3.11 + FastAPI (ai-service) |
| Ingestion | Node.js 20 TypeScript; HTTP ingestion for MVP, MQTT later |
| Realtime | WebSockets + Redis pub/sub |
| Database | PostgreSQL 16 + TimescaleDB (time-series), Redis 7 (cache + pub/sub) |
| ORM | Drizzle ORM |
| Monorepo | Turborepo + pnpm workspaces |
| CI/CD | GitHub Actions |

---

## Project Structure

See [FILE_STRUCTURE.md](./FILE_STRUCTURE.md) for the full directory breakdown and team ownership.

```
digital-twin-fm/
├── apps/
│   ├── web/                  # Next.js frontend
│   ├── api-gateway/          # Node.js REST + WebSocket server
│   ├── ai-service/           # Python FastAPI — LLM, RAG, anomaly detection
│   └── ingestion-service/    # IoT sensor data intake (MQTT / HTTP)
├── packages/
│   ├── ui/                   # Shared design system + components
│   ├── db/                   # Drizzle schema, migrations, db client
│   ├── types/                # Shared TypeScript interfaces
│   └── config/               # ESLint, TypeScript, Prettier configs
├── scripts/                  # seed, migrate, local setup
├── infra/                    # Terraform/K8s (post-MVP)
├── documents/                # PRD and other docs
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ — `npm install -g pnpm`
- **Python** 3.11+ (for ai-service)
- **Docker + Docker Compose** (for local databases)

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-org/digital-twin-fm.git
cd digital-twin-fm
```

### 2. One-command setup (recommended)

```bash
bash scripts/setup-local.sh
```

This script will install dependencies, copy `.env.example` to `.env`, start Docker services, run migrations, and seed demo data.

### 3. Manual setup

```bash
pnpm install
cp .env.example .env           # fill in values
docker-compose up -d postgres redis
pnpm migrate
pnpm seed
pnpm dev
```

> For full deployment instructions see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Running Services

```bash
pnpm dev          # all services with hot reload
```

### Individual services

```bash
pnpm --filter web dev
pnpm --filter api-gateway dev
pnpm --filter ingestion-service dev

# AI service (Python)
cd apps/ai-service && uvicorn app.main:app --reload --port 8001
```

### Default ports

| Service | Port |
|---|---|
| web (Next.js) | 3000 |
| api-gateway | 4000 |
| ai-service | 8001 |
| ingestion-service | 5000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## Environment Variables

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `OPENAI_API_KEY` | OpenAI key for AI copilot (or swap for Anthropic) |
| `NEXT_PUBLIC_API_URL` | API gateway base URL for the frontend |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL for live sensor updates |

See `.env.example` for the full list.

---

## Database

```bash
pnpm migrate      # run migrations
pnpm seed         # seed demo data
```

The `sensor_readings` table is a TimescaleDB hypertable — partitioned automatically by timestamp for fast time-series queries. See [ARCHITECTURE.md](./ARCHITECTURE.md#database-design) for the full schema and design rationale.

---

## Feature Domains

Vertical feature slices under `apps/web/src/features/`. Each domain owns its components, hooks, services, store, and types.

| Domain | Description |
|---|---|
| `building-overview` | Floor-by-floor navigation and health status |
| `digital-twin` | 3D building viewer with live sensor overlays |
| `monitoring` | Live sensor cards and time-series charts |
| `alerts` | Threshold-based incident detection and management |
| `maintenance` | Asset registry and work order tracking |
| `ai-copilot` | Conversational assistant with RAG over facility data |
| `executive-dashboard` | KPI cards — energy, incidents, building health score |

---

## Team Ownership

| Domain | Owner |
|---|---|
| `building-overview/` | Akshay |
| `digital-twin/` | Akshay |
| `monitoring/` | Sumanth |
| `alerts/` | Sumanth |
| `maintenance/` | Sahil |
| `ai-copilot/` | Sudhanva |
| `executive-dashboard/` | Shared |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide — branch strategy, code standards, PR process, and review rules.

Quick reference:

```bash
pnpm lint        # ESLint
pnpm typecheck   # TypeScript strict
pnpm test        # Jest + Pytest
pnpm build       # verify all packages compile
```

Branch off `dev`. Never commit directly to `main` or `dev`. PRs require 1 approval + green CI before merge.

---

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Every PR | Lint, typecheck, tests, build |
| `deploy-staging.yml` | Merge to `dev` | Full CI + Docker build + deploy to staging |
| `deploy-prod.yml` | Manual approval | Full CI + Docker build + deploy to production |

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full pipeline details.

---

## License

Internal — Digital Twin FM Team © 2025
