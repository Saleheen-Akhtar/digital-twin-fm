# Secrets and Database Strategy — MVP

## Purpose

This document defines how Digital Twin FM should handle secrets and database decisions during the MVP phase.

The goal is to keep the MVP fast to build while avoiding choices that block the full product later.

## Key decision

For the MVP, Digital Twin FM should **not replace the planned backend/database architecture with SereniBase yet**.

Recommended MVP decision:

```text
Primary app database: PostgreSQL 16
Time-series sensor database: PostgreSQL + TimescaleDB
ORM/migrations: Drizzle ORM
Secrets management: Infisical or OpenBao/Vault-style secret manager
Local development fallback: .env files only for local machine use
```

SereniBase can be evaluated as a post-MVP candidate for backend platform capabilities, but it should not become the MVP foundation until we validate its fit with time-series data, Drizzle migrations, NestJS service ownership, and long-term digital-twin requirements.

## SereniBase evaluation

Repository reviewed:

```text
https://github.com/aptlogica/sereni-base
```

SereniBase describes itself as a self-hosted backend platform built around:

- PostgreSQL
- automatic REST APIs from database tables
- JWT authentication
- S3/MinIO storage
- ClamAV malware scanning
- SMTP/email service
- multi-tenant workspaces
- Swagger/OpenAPI documentation
- Docker Compose deployment

This is useful, but it is more than just a database. It is a backend platform that can overlap with the planned Digital Twin FM backend.

## What SereniBase is good for

SereniBase may be useful for:

- quickly exposing database tables as REST APIs,
- self-hosted backend/admin workflows,
- JWT auth experiments,
- storage service with MinIO/S3,
- file malware scanning via ClamAV,
- internal admin tooling,
- backend prototyping,
- avoiding vendor lock-in.

## Why SereniBase should not replace the MVP backend yet

Digital Twin FM already needs a domain-specific backend:

```text
apps/api-gateway       NestJS API, auth guards, DTOs, WebSockets
apps/ingestion-service Sensor ingestion and normalization
apps/ai-service        Python FastAPI AI/RAG/anomaly service
packages/db            Drizzle schema/migrations
```

SereniBase automatically exposes REST APIs from tables. That is useful for generic CRUD, but Digital Twin FM needs controlled domain APIs, such as:

- alert lifecycle rules,
- work order assignment permissions,
- realtime WebSocket event publishing,
- sensor ingestion validation,
- AI context scoping,
- asset health calculations,
- multi-site resource scoping,
- audit-sensitive maintenance workflows.

These rules should live in our NestJS domain services, not only in auto-generated CRUD endpoints.

## Time-series concern

The MVP and full product require sensor time-series data.

Digital Twin FM needs:

- high-volume sensor readings,
- time-bucketed aggregations,
- retention policies,
- compression,
- continuous aggregates,
- efficient historical charts.

TimescaleDB is designed for this. SereniBase uses PostgreSQL, but we should not assume it gives us the complete TimescaleDB workflow without a dedicated proof of concept.

## Secrets-manager strategy

The user does not want the security strategy to rely only on `.env` files.

Recommended secrets strategy:

```text
Local development: .env allowed only as local fallback and never committed
Team development: Infisical recommended for ease of use
Enterprise/full product: OpenBao or HashiCorp Vault compatible workflow
CI/CD: GitHub Actions secrets or external secret manager integration
Production: no plaintext secrets in repo, images, or logs
```

## Recommended MVP secrets manager

Use **Infisical** for MVP/team development if the team wants an open-source secrets manager with a simpler developer experience.

Why Infisical fits MVP:

- open source,
- easier team onboarding than Vault,
- supports environment-scoped secrets,
- works well with Node.js/Python apps,
- can inject secrets into local development and CI/CD,
- easier for small teams to operate.

## Full-product secrets manager direction

For the full product, evaluate:

```text
Infisical
OpenBao
HashiCorp Vault-compatible deployment
Cloud provider secret managers if deployed to a specific cloud
```

OpenBao/Vault-style systems are stronger for enterprise deployments but add operational complexity.

## Required secret categories

The project will eventually need secrets for:

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

Integrations:
  MQTT_USERNAME
  MQTT_PASSWORD
  BACNET_GATEWAY_TOKEN
  OPCUA_CLIENT_CERT
  OPCUA_CLIENT_KEY

Monitoring:
  SENTRY_DSN
  OTEL_EXPORTER_OTLP_ENDPOINT
  GRAFANA_TOKEN
```

## `.env` policy

Even if a secrets manager is used, local `.env` files can still be useful for developer convenience.

Rules:

- `.env` is local only.
- `.env` must never be committed.
- `.env.example` may be committed only with empty or fake values.
- Production secrets must come from a secret manager or deployment platform secrets.
- Agents must never print real secrets in logs or documentation.

## MVP recommendation

Do this:

```text
1. Keep PostgreSQL + TimescaleDB as the official MVP database plan.
2. Add Infisical as the preferred MVP/team secrets manager.
3. Keep .env only as a local fallback, not as the real secrets strategy.
4. Evaluate SereniBase after core MVP docs/code are stable.
5. Do not let SereniBase auto-CRUD replace NestJS domain APIs unless a POC proves it fits.
```

## SereniBase POC criteria

Before adopting SereniBase, validate:

- Can it work cleanly with our existing NestJS API gateway?
- Can it support TimescaleDB extension usage and hypertables?
- Can Drizzle migrations remain the source of truth?
- Can auto-generated APIs be safely restricted by RBAC/resource scopes?
- Can it support multi-site and future multi-tenant data boundaries?
- Can it run without conflicting with our Redis/WebSocket realtime layer?
- Can it be operated securely with an external secrets manager?

## Decision status

```text
Decision: Do not adopt SereniBase as the MVP database/backend foundation yet.
Status: Candidate for post-MVP proof of concept.
Secrets manager: Infisical recommended for MVP/team workflow; OpenBao/Vault-style approach for enterprise evaluation.
```
