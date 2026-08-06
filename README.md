# Digital Twin FM

**AI-powered Digital Twin Facility Management platform.** A monorepo that pairs a real-time 3D building twin with live IoT telemetry, an AI copilot, and operational dashboards for facility managers.

[![CI — Build, Lint, Test, License-Audit](https://github.com/anbunathanr/digital-twin-for-facility-management/actions/workflows/ci.yml/badge.svg)](https://github.com/anbunathanr/digital-twin-for-facility-management/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSES.md)

## Table of contents

- [Requirements](#requirements)
- [Architecture](#architecture)
- [Key features](#key-features)
- [Running the project](#running-the-project)
- [Environment variables](#environment-variables)
- [Database workflows (Drizzle)](#database-workflows-drizzle)
- [Project scripts](#project-scripts)
- [Testing & quality](#testing--quality)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Security](#security)
- [Changelog](#changelog)
- [License](#license)

## Requirements

| Requirement | Minimum |
|-------------|---------|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| Datastores | PostgreSQL 16 + TimescaleDB, Valkey 7.2 (or Redis 7), Mosquitto MQTT |

**Docker is the recommended way to run the datastores** — it's the simplest and most reliable, and Docker Desktop / Docker Engine takes care of PostgreSQL+TimescaleDB, Valkey, and Mosquitto for you in isolated containers.

> **Notes for low-end or minimal systems** (older hardware, shared hosts, machines that can't run Docker Desktop, no virtualization, limited RAM):
> - Docker is **not** required — everything can be installed natively (see [Run without Docker](#option-2-run-without-docker-low-end--minimal-systems)). No Docker daemon, no RAM-hungry VM, no disk-hungry images.
> - Docker typically needs ~2 GB+ free RAM and several GB of disk; if your machine can't spare that, use the native route below.
> - The native route needs Node _plus_ natively-installed PostgreSQL/TimescaleDB, Valkey (or Redis), and Mosquitto, and a copy of each service bound to `localhost`.

Choose **one** datastore strategy below — either [with Docker](#option-1-with-docker) (recommended) or [without Docker](#option-2-run-without-docker-low-end--minimal-systems).

---

## Architecture

Turborepo + `pnpm` workspaces. The platform is split into four apps and four shared packages.

| App | Package | Stack | Port |
|-----|---------|-------|------|
| Web app | `@digital-twin-fm/web` | Next.js · React · React Three Fiber | `:3000` |
| API gateway | `@digital-twin-fm/api-gateway` | NestJS | `:4000` |
| AI service | `@digital-twin-fm/ai-service` | FastAPI (Python) | `:8000` |
| Ingestion service | `@digital-twin-fm/ingestion-service` | Node · MQTT → Redis/DB | `:4100` |

| Package | Purpose |
|---------|---------|
| `@digital-twin-fm/db` | Drizzle schema, migrations, types (PostgreSQL/TimescaleDB) |
| `@digital-twin-fm/types` | Shared TypeScript types |
| `@digital-twin-fm/ui` | Shared UI primitives |
| `@digital-twin-fm/eslint-config` | Shared lint configuration |

### Infrastructure (Docker)

| Container | Image | Purpose |
|-----------|-------|---------|
| `dtfm-postgres` | `timescale/timescaledb:latest-pg16` | Primary database + time-series (Timescale hypertables) |
| `dtfm-valkey` | `valkey/valkey:7.2-alpine` | Redis-compatible cache / pub-sub |
| `dtfm-mqtt` | `eclipse-mosquitto:2` | MQTT broker for IoT ingestion |
| `dtfm-db-migrate` | local build | One-shot Drizzle migration runner |
| `dtfm-api` | local build | Containerized API gateway |

## Key features

- **3D digital twin viewer** — procedural building rendered in the browser (React Three Fiber). Self-heals automatically on WebGL context loss (e.g. when other tabs evict the GPU context). Asset overlays, layers panel, click-to-inspect, and condition animations driven by live telemetry.
- **Live telemetry & KPIs** — real-time event feed, health scores, mini KPI bars, and snapshot dashboards fed through the ingestion pipeline.
- **AI copilot** — query the platform in natural language with a real FastAPI-backed copilot and graceful simulation fallback.
- **Alerts & notifications** — condition-based alerts delivered via browser notifications.
- **Asset & work-order management** — manage equipment, maintenance modules, and energy/building operations.

---

## Running the project

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment configuration

Copy the example env files and fill in the values (secrets/URLs are your local ones — never commit `.env`).

```bash
cp .env.example .env          # picks up the datastore host/ports below
cp apps/web/.env.example apps/web/.env.local
# repeat the per-app copy for any other app you run
```

Set `POSTGRES_HOST`/`POSTGRES_PORT`, `REDIS_HOST`/`REDIS_PORT`, and `MQTT_HOST`/`MQTT_PORT`
to match your chosen datastore strategy (see the port tables below).

### 3. Secrets & security

Passwords, tokens, and API keys are **secrets** — they stay out of version control.

- **`.env` and every `.env.*` variant are gitignored** (including `.env.local`, `.env.production`, `.env.staging`, and each `apps/*/.env.local`). Only **`.env.example`** is committed — and it contains placeholder values only, never real credentials.
- Supply real values via the environment or the project's secret manager — this repo uses **Infisical**: `infisical export --env=dev --format dotenv > .env`
- Secrets include: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MVP_ADMIN_PASSWORD`, `INGEST_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and any JWT secret. Rotate them per environment; **never hardcode them in source code, scripts, or committed files**.
- The aliases in `.env.example` (e.g. `change-me`, `your-openai-key`) are intentional fake defaults — never treat them as real values.

---

### Option 1 — Run *with* Docker (recommended)

Docker runs the datastores (TimescaleDB, Valkey, Mosquitto). Apps run on your host — this is the fastest dev loop.

```bash
# 1. start infrastructure (PostgreSQL+Timescale, Valkey, Mosquitto)
docker compose up -d

# 2. database migrations + seed
pnpm db:migrate
pnpm db:seed

# 3. run the apps in parallel (Turborepo)
pnpm dev
```

Docker host-exposed ports (set these in your `.env`):

| Service | Host port | Internal |
|---------|-----------|----------|
| PostgreSQL/TimeScale | `15432` | `5432` |
| Valkey (Redis) | `6379` | `6379` |
| Mosquitto broker | `1883` (+ `9001` ws) | `1883` / `9001` |

> Set `POSTGRES_PORT=15432` in `.env` for Docker-based Postgres — the container forwards host `15432` → internal `5432`. Run `pnpm db:migrate` / `db:seed` with that env exported.

Want a fully containerized dev environment with hot reload? Use the dev Compose project instead:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Open the web app at <http://localhost:3000> (API at `:4000`).

<details>
<summary><b>Scaling to / using the containerized API</b></summary>

`docker-compose.yml` also builds a prebuilt `dtfm-api` (API gateway) on `127.0.0.1:4000:4000` and a `dtfm-db-migrate` one-shot migration job. If you run the gateway from the container, make sure its `.env` inside points at the compose network hostnames (`postgres:5432`, `valkey:6379`), not `localhost`.
</details>

---

### Option 2 — Run *without* Docker (low-end / minimal systems)

No Docker daemon, no VM, no container images — everything runs natively on the machine. This suits low-RAM or restricted systems that can't run Docker. You must install each datastore yourself and point `.env` at `localhost`.

1. **Install natively**:

   | Datastore | Install | Notes |
   |-----------|---------|-------|
   | PostgreSQL 16 **+ TimescaleDB** | OS package (TimescaleDB is a Postgres extension) | Needed for time-series hypertables (`sensor_readings`) |
   | Valkey (or Redis 7) | OS package | Drop-in cache/pub-sub |
   | Mosquitto MQTT | OS package | IoT ingestion broker |

   > **Windows:** use the [TimescaleDB for Windows installer](https://docs.timescale.com/self-hosted/latest/install/installation-windows/) and the Redis/Valkey [Windows builds](https://github.com/tporadowski/redis) or WSL. The extension is required — `pnpm db:migrate` will fail without TimescaleDB because `0001_sensor_readings_hypertable.sql` calls `CREATE EXTENSION timescaledb` · `create_hypertable()`.

2. **Start each service bound to `localhost`:**

   ```bash
   # Postgres
   postgres  # (launch the initdb binary / service for `postgres`, port 5432)
   # Valkey/Redis
   valkey-server
   # Mosquitto
   mosquitto
   ```

   Set native ports in `.env` (all on `localhost`):

   | Service | Port |
   |--------|------|
   | PostgreSQL/TimeScale | `5432` |
   | Valkey (Redis) | `6379` |
   | Mosquitto | `1883` (MQTT) |

   For Postgres: host and db scripts use `POSTGRES_HOST=localhost POSTGRES_PORT=5432`, then:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

3. **Run the apps on the host** (same `pnpm dev` as before).

   ```bash
   pnpm dev
   ```

   Open the web app at <http://localhost:3000>.

---

## Environment variables

| Variable | Purpose | Default (dev) |
|----------|---------|---------------|
| `POSTGRES_HOST` / `POSTGRES_PORT` | Primary database | `localhost` / `5432` (Docker: `15432`) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | DB credentials | `dtfm_user` / … / `dtfm_db` |
| `POSTGRES_SSL` | Require TLS to Postgres (production) | `false` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Valkey cache / pub-sub | `localhost` / `6379` |
| `MQTT_HOST` / `MQTT_PORT` / `MQTT_URL` | MQTT broker (IoT ingestion) | `localhost` / `1883` |
| `MVP_ADMIN_PASSWORD` | Admin bootstrap password | — |
| `INGEST_API_KEY` | Shared secret for `/ingest/*` endpoints | dev-random at boot |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | AI provider keys | — |
| `API_GATEWAY_URL` / `NEXT_PUBLIC_API_URL` | Web → gateway URLs | `http://localhost:4000` |
| `AI_SERVICE_PORT` / `INGESTION_PORT` | Service bind ports | `8000` / `4100` |
| `CORS_ORIGIN` | Allowed browser origins | `http://localhost:3000` (dev) |

Complete list with per-variable comments: [`.env.example`](.env.example).

## Database workflows (Drizzle)

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate Drizzle migrations from schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Push schema directly (no migration history) |
| `pnpm db:seed` | Seed dev data |
| `pnpm db:reset` | Reset and re-seed the database |
| `pnpm db:studio` | Open Drizzle Studio |

## Project scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run all apps in parallel (Turborepo) |
| `pnpm build` | Build all packages and apps |
| `pnpm test` / `pnpm lint` / `pnpm typecheck` | Quality gates across the monorepo |
| `pnpm db:generate` / `db:migrate` / `db:seed` / `db:reset` / `db:studio` | Database workflows (Drizzle) |
| `pnpm licenses:check` / `licenses:report` | Open-source license audit |

To run only one app's dev server (faster than the parallel run):

```bash
pnpm --filter @digital-twin-fm/web dev
```

## Testing & quality

```bash
pnpm test        # passes across all packages
pnpm lint        # ESLint (app-only warnings, none blocking)
pnpm typecheck   # TypeScript, clean
```

## Deployment

Production is defined in [`render.yaml`](render.yaml) — a Render blueprint with managed PostgreSQL + Redis and Dockerized web services (API gateway, ingestion, AI). See that file for service definitions and environment wiring.

## Contributing

Contributions are welcome. The repo ships a [pull request template](.github/PULL_REQUEST_TEMPLATE.md), and CI runs **build, lint, test, and license-audit** on every pull request. Keep PRs focused and rebased on the latest `main`.

## Security

Secrets never belong in git — see [Secrets & security](#3-secrets--security). To report a vulnerability, open a private issue or contact the maintainers directly; never include live credentials in public reports.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT — see [LICENSES.md](LICENSES.md) for full license details, and run `pnpm licenses:check` for dependency compliance.
