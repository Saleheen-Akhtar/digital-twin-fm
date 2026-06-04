# Database and Secrets Strategy — Full Product

## Purpose

This document defines the full-product database and secrets-management direction for Digital Twin FM.

The project will keep the originally selected database architecture and use Infisical as the preferred secrets manager.

## Final database direction

Use PostgreSQL with TimescaleDB.

```text
Primary relational database: PostgreSQL 16+
Time-series extension: TimescaleDB
ORM and migrations: Drizzle ORM
Cache/realtime coordination: Redis
```

This is the strongest fit for Digital Twin FM because the product needs both relational facility data and high-volume time-series sensor data.

## Why PostgreSQL + TimescaleDB

Digital Twin FM needs to store:

- organizations,
- sites,
- buildings,
- floors,
- zones,
- assets,
- sensors,
- alerts,
- work orders,
- maintenance logs,
- users and roles,
- sensor readings,
- AI/copilot interaction history,
- audit logs.

PostgreSQL is strong for relational facility and business data.

TimescaleDB is strong for sensor data because it supports:

- hypertables,
- time partitioning,
- high-volume writes,
- compression,
- retention policies,
- continuous aggregates,
- fast historical queries.

## Data ownership

Recommended ownership:

```text
packages/db:
  Drizzle schema and migrations

apps/api-gateway:
  business APIs and domain rules

apps/ingestion-service:
  sensor ingestion, validation, normalization

apps/ai-service:
  AI workflows and scoped context retrieval
```

The database schema should be explicit and migration-controlled. Dynamic or auto-generated database ownership should not replace Drizzle migrations.

## MVP database deployment

For MVP, use one of these:

```text
Option A: Docker Compose PostgreSQL + TimescaleDB locally
Option B: managed PostgreSQL/TimescaleDB if deployment speed matters
```

Recommended for local development:

```text
Docker Compose PostgreSQL + TimescaleDB
Redis
Drizzle migrations
Seed scripts
```

## Full-product database deployment

For pilot and production:

```text
PostgreSQL + TimescaleDB with backups
Redis with persistence where required
object storage for uploads/models/reports
separate read/query tuning for analytics as needed
```

For enterprise scale, evaluate:

- managed Timescale service,
- self-hosted TimescaleDB,
- high availability,
- point-in-time recovery,
- read replicas,
- connection pooling,
- backup restore testing,
- data retention policies,
- continuous aggregates.

## Time-series retention direction

Initial full-product direction:

```text
Raw high-frequency readings: short retention window
1-minute aggregates: medium retention
1-hour aggregates: long retention
Daily aggregates: long-term reporting
```

Exact retention periods should be finalized after sensor frequency and customer requirements are known.

## Secrets-management direction

Use Infisical as the default secrets manager.

```text
MVP/team default: Infisical
AWS deployment option: AWS Systems Manager Parameter Store or AWS Secrets Manager
Enterprise/on-prem option: OpenBao/Vault-style workflow if required
```

## Why Infisical

Infisical is preferred because it is:

- open source,
- team-friendly,
- easier than Vault/OpenBao for MVP,
- suitable for local, staging, and production environments,
- compatible with Node.js, Python, Docker, and CI/CD,
- flexible enough before final cloud/on-prem deployment decisions are made.

## Secret categories

The full product will require secrets for:

```text
Database:
  DATABASE_URL
  POSTGRES_USER
  POSTGRES_PASSWORD

Redis:
  REDIS_URL
  REDIS_PASSWORD

Authentication:
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
  PASSWORD_HASH_PEPPER
  OIDC_CLIENT_SECRET
  SAML_PRIVATE_KEY

AI providers:
  OPENAI_API_KEY
  ANTHROPIC_API_KEY
  OTHER_MODEL_PROVIDER_API_KEY

Storage:
  S3_ENDPOINT
  S3_ACCESS_KEY_ID
  S3_SECRET_ACCESS_KEY
  S3_BUCKET

Email:
  SMTP_HOST
  SMTP_PORT
  SMTP_USER
  SMTP_PASSWORD

IoT integrations:
  MQTT_USERNAME
  MQTT_PASSWORD
  BACNET_GATEWAY_TOKEN
  OPCUA_CLIENT_CERT
  OPCUA_CLIENT_KEY

Observability:
  SENTRY_DSN
  OTEL_EXPORTER_OTLP_ENDPOINT
  GRAFANA_TOKEN
```

## Secret rotation

The full product should support rotation for:

- database credentials,
- Redis credentials,
- JWT secrets,
- AI provider keys,
- storage credentials,
- SMTP credentials,
- IoT device credentials,
- OPC-UA certificates,
- monitoring tokens.

## Secret access boundaries

- Frontend receives only public runtime config.
- API gateway receives app/database/auth secrets.
- Ingestion service receives only ingestion-related credentials.
- AI service receives only AI provider keys and scoped backend credentials.
- CI/CD receives only environment-specific deployment secrets.
- Logs must redact all secret-like values.

## AWS option

If Digital Twin FM is deployed on AWS:

```text
MVP/simple AWS: AWS Systems Manager Parameter Store
Production AWS: AWS Secrets Manager for sensitive rotating secrets
```

AWS is a deployment-specific option, not the default product-wide secrets strategy.

## Enterprise/on-prem option

For on-prem or compliance-heavy customers, evaluate:

```text
OpenBao
HashiCorp Vault-compatible workflows
customer-managed secret stores
```

This should only be adopted if customer requirements justify the operational complexity.

## Decision status

```text
Database: PostgreSQL + TimescaleDB
ORM/migrations: Drizzle ORM
Secrets manager: Infisical
AWS option: Parameter Store / Secrets Manager if deployed on AWS
Enterprise option: OpenBao/Vault-style workflow if needed later
```

## Infisical integration pattern in NestJS (MVP reference)

The `apps/api-gateway` service implements the canonical Infisical wiring pattern that all other services should follow. The pattern lives in `apps/api-gateway/src/config/`:

- **`infisical.loader.ts`** exports `loadInfisicalOrEnvSync()`, a synchronous function that:
  - In `development` and `test`, reads a local `.env` file from `process.cwd()` and returns parsed key/value pairs.
  - In `staging` / `production`, returns an empty object — the Infisical CLI is expected to have already injected secrets into `process.env` (via a sidecar / init container / machine identity).
- **`config.module.ts`** is a `@Global()` NestJS module that wraps `@nestjs/config` and exposes a typed `database`, `redis`, and `jwt` namespace derived from environment variables.

### How to use the same pattern in a new service

1. Copy `apps/api-gateway/src/config/` into `apps/<new-service>/src/config/`.
2. In the new service's `main.ts`, do **not** change anything — the loader runs at module init.
3. The service reads secrets via `@nestjs/config`'s `ConfigService` (e.g. `config.get<string>('jwt.accessSecret')`).
4. In dev, the new service will pick up a local `.env`. In production, run the Infisical CLI on the host or sidecar before starting the process so secrets are present in `process.env`.

This same pattern will be reused for `apps/ingestion-service` and `apps/ai-service` in subsequent plans.
