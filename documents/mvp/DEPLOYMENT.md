# Deployment — Digital Twin FM

> Covers local, staging, and production deployment. Read [ARCHITECTURE.md](./ARCHITECTURE.md) first to understand service boundaries before deploying.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Docker](#docker)
- [Staging](#staging)
- [Production](#production)
- [CI/CD Pipeline](#cicd-pipeline)
- [Database Migrations](#database-migrations)
- [Health Checks](#health-checks)
- [Rollback](#rollback)
- [Troubleshooting](#troubleshooting)

---

## Overview

| Environment | Infrastructure | Deploy trigger |
|---|---|---|
| Local | Docker Compose (postgres + redis) + pnpm dev | Manual |
| Staging | Single VM — Docker Compose (all services) | Auto on merge to `dev` |
| Production | Single VM — Docker Compose (all services) | Manual approval in GitHub Actions |

> **Post-MVP:** Kubernetes + Helm charts will replace Docker Compose for production. Placeholder in `infra/README.md`.

---

## Prerequisites

- Docker + Docker Compose v2
- pnpm 9+
- Node.js 20+
- Python 3.11+ (ai-service only)
- Access to the container registry (GitHub Packages or Docker Hub)
- `.env` file populated — see [Environment Variables](#environment-variables)

---

## Environment Variables

Copy `.env.example` to the appropriate env file and fill in all values:

```bash
cp .env.example .env          # local
cp .env.example .env.staging  # staging
cp .env.example .env.prod     # production
```

### Required variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/digitaltwin` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Secret for signing JWTs — min 32 chars | `your-secret-here` |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | `your-refresh-secret` |
| `OPENAI_API_KEY` | LLM provider key (or Anthropic) | `sk-...` |
| `NEXT_PUBLIC_API_URL` | API gateway base URL | `http://localhost:4000` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `ws://localhost:4000` |
| `MQTT_BROKER_URL` | MQTT broker for ingestion-service | `mqtt://localhost:1883` |
| `AI_SERVICE_URL` | Internal URL of ai-service | `http://ai-service:8001` |
| `NODE_ENV` | Environment | `development` / `production` |

See `.env.example` for the full list including optional variables.

---

## Local Development

### One-command setup

```bash
bash scripts/setup-local.sh
```

### Manual setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure only
docker-compose up -d postgres redis

# 3. Run migrations
pnpm migrate

# 4. Seed demo data
pnpm seed

# 5. Start all services with hot reload
pnpm dev
```

### Service URLs (local)

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:4000 |
| AI Service | http://localhost:8001 |
| Ingestion Service | http://localhost:5000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Stopping local services

```bash
# Stop all Docker services
docker-compose down

# Stop and remove volumes (wipes database)
docker-compose down -v
```

---

## Docker

Each service has its own `Dockerfile`. Images are built and tagged with the git SHA in CI.

### Build all images locally

```bash
docker-compose build
```

### Build a single service

```bash
docker-compose build web
docker-compose build api-gateway
docker-compose build ai-service
docker-compose build ingestion-service
```

### Run everything via Docker Compose

```bash
# Start all services including the app (not just infra)
docker-compose --profile app up -d

# View logs
docker-compose logs -f

# View logs for a specific service
docker-compose logs -f api-gateway
```

### Image naming convention

```
ghcr.io/<org>/digital-twin-<service>:<git-sha>

ghcr.io/your-org/digital-twin-web:a1b2c3d
ghcr.io/your-org/digital-twin-api-gateway:a1b2c3d
ghcr.io/your-org/digital-twin-ai-service:a1b2c3d
ghcr.io/your-org/digital-twin-ingestion-service:a1b2c3d
```

---

## Staging

Staging auto-deploys on every merge to `dev` via the `deploy-staging.yml` GitHub Actions workflow.

### What the workflow does

```
1. Run full CI (lint + typecheck + tests + build)
2. Build Docker images for all 4 services
3. Push images to container registry tagged with git SHA
4. SSH into staging VM
5. Pull new images
6. Run docker-compose up -d (rolling restart)
7. Run database migrations
8. Run smoke tests
```

### Manual deploy to staging

If you need to deploy manually (e.g. hotfix):

```bash
# SSH into staging VM
ssh deploy@staging.your-domain.com

# Pull latest images
docker-compose pull

# Restart services
docker-compose up -d

# Run migrations
docker-compose exec api-gateway pnpm migrate
```

### Staging URL

`https://staging.your-domain.com`

---

## Production

Production deploys require **manual approval** in the GitHub Actions UI from a team lead.

### Deploy process

```
1. Go to GitHub Actions → deploy-prod.yml → Run workflow
2. Team lead reviews and approves in the Actions UI
3. Workflow runs:
   a. Full CI
   b. Build + push images tagged with git SHA
   c. SSH into production VM
   d. Pull new images
   e. Run migrations
   f. docker-compose up -d (rolling restart)
   g. Health check — abort and rollback if any service fails
```

### Pre-deploy checklist

Before triggering a production deploy:

- [ ] All changes merged and tested on staging
- [ ] No pending migrations that haven't been reviewed
- [ ] Team lead aware of the deploy window
- [ ] `.env.prod` up to date on the production VM

### Production VM setup (first time)

```bash
# On the production VM
mkdir -p /opt/digital-twin
cd /opt/digital-twin

# Copy docker-compose.yml and .env.prod
scp docker-compose.yml deploy@prod.your-domain.com:/opt/digital-twin/
scp .env.prod deploy@prod.your-domain.com:/opt/digital-twin/.env

# Login to container registry
docker login ghcr.io

# Pull and start
docker-compose pull
docker-compose up -d

# Run migrations
docker-compose exec api-gateway pnpm migrate
```

---

## CI/CD Pipeline

Three GitHub Actions workflows — defined in `.github/workflows/`:

### `ci.yml` — every PR

```
pnpm install (Turborepo cache)
  → ESLint (all packages)
  → TypeScript typecheck (strict)
  → Unit tests — Jest + Pytest
  → turbo build (verify all packages compile)
```

### `deploy-staging.yml` — merge to `dev`

```
ci.yml (full)
  → Docker build (web, api-gateway, ai-service, ingestion-service)
  → Push to registry
  → Deploy to staging VM
  → Smoke tests
```

### `deploy-prod.yml` — manual trigger + approval

```
Manual trigger in GitHub Actions UI
  → Team lead approval
  → ci.yml (full)
  → Docker build + push (tagged with git SHA)
  → Deploy to production VM
  → Health checks
  → Rollback on failure
```

### Turborepo CI optimisation

```bash
# CI uses frozen lockfile — never installs unexpected versions
pnpm install --frozen-lockfile

# Turborepo skips unchanged packages using remote cache
turbo run build test lint --parallel
```

---

## Database Migrations

Migrations are managed by Drizzle ORM in `packages/db/migrations/`.

### Generate a migration

```bash
# After editing schema files in packages/db/schema/
pnpm --filter @repo/db generate
```

### Run migrations

```bash
# Local
pnpm migrate

# On a running Docker service
docker-compose exec api-gateway pnpm migrate
```

### Migration rules

- Never edit an existing migration file — create a new one
- Always review generated SQL before committing
- Migrations run automatically as part of staging and production deploys
- TimescaleDB hypertable setup is handled in a raw SQL migration — do not modify it

---

## Health Checks

Each service exposes a health endpoint:

| Service | Endpoint | Expected response |
|---|---|---|
| api-gateway | `GET /health` | `{ status: "ok" }` |
| ai-service | `GET /health` | `{ status: "ok" }` |
| ingestion-service | `GET /health` | `{ status: "ok" }` |
| web | `GET /api/health` | `{ status: "ok" }` |

Docker Compose is configured with `healthcheck` on each service. A service is only marked healthy after its health endpoint returns 200.

### Manual health check

```bash
curl http://localhost:4000/health
curl http://localhost:8001/health
curl http://localhost:5000/health
curl http://localhost:3000/api/health
```

---

## Rollback

### Rollback via Docker Compose (staging or prod)

```bash
# SSH into the VM
ssh deploy@your-domain.com
cd /opt/digital-twin

# Set the previous image tag
export PREVIOUS_SHA=a1b2c3d   # git SHA of last known good deploy

# Pull and restart with previous images
IMAGE_TAG=$PREVIOUS_SHA docker-compose up -d

# Verify health
curl http://localhost:4000/health
```

### Rollback a migration

Drizzle does not auto-generate down migrations. To roll back:

1. Write a new migration that reverts the schema change
2. Deploy the new migration with the rollback code

---

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs -f <service-name>

# Check if ports are already in use
lsof -i :3000
lsof -i :4000
```

### Database connection errors

```bash
# Verify postgres is running
docker-compose ps postgres

# Check DATABASE_URL in .env matches docker-compose.yml service name
# Should be: postgresql://user:pass@postgres:5432/digitaltwin (not localhost inside Docker)
```

### WebSocket not connecting

- Confirm `NEXT_PUBLIC_WS_URL` in `.env` points to the correct api-gateway host/port
- Check api-gateway logs for WebSocket upgrade errors
- Ensure Redis is running — api-gateway subscribes to Redis on startup

### TimescaleDB extension missing

```bash
# Connect to postgres and install extension manually
docker-compose exec postgres psql -U user -d digitaltwin
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### pnpm install fails in CI

```bash
# Clear Turborepo cache and retry
turbo daemon stop
rm -rf .turbo
pnpm install --frozen-lockfile
```
