# Database Platform and Secrets Management — Full Product

## Purpose

This document defines the full-product direction for database platform choices and secrets management.

Digital Twin FM must remain secure, observable, migration-friendly, and capable of high-volume facility telemetry. Any backend platform or secrets tool must support those requirements.

## Full-product principle

The full product should separate three concerns:

```text
Database engine: stores operational and time-series data
Backend services: enforce business rules and API contracts
Secrets manager: stores and injects credentials securely
```

A tool that combines several of these can be useful, but it should not blur ownership of critical business logic.

## SereniBase as a candidate platform

SereniBase is an open-source self-hosted backend platform built around PostgreSQL with auto-generated REST APIs, JWT authentication, storage, email, and ClamAV scanning.

It may be valuable as:

- an internal admin backend,
- a prototype backend,
- a self-hosted alternative to backend-as-a-service platforms,
- a storage/email/security service bundle,
- a reference platform for self-hosted PostgreSQL-backed services.

## SereniBase adoption risks

Before adopting SereniBase for the full product, validate these risks:

### 1. API ownership

Digital Twin FM needs domain APIs with business logic, not only table APIs.

Examples:

- alert state transitions,
- maintenance assignment permissions,
- AI context filtering,
- sensor validation,
- asset-health calculations,
- audit events,
- resource-scoped permissions.

If auto-generated CRUD endpoints bypass these rules, the product becomes unsafe.

### 2. Migration ownership

The project intends to use Drizzle ORM and explicit migrations.

The full product must decide whether schema ownership lives in:

```text
packages/db Drizzle migrations
```

or in an external/dynamic backend platform.

The recommended full-product decision is:

```text
Drizzle migrations remain the source of truth.
```

### 3. Time-series support

Digital Twin FM needs TimescaleDB-grade telemetry support:

- hypertables,
- compression,
- retention policies,
- continuous aggregates,
- high-volume writes,
- chart-friendly historical queries.

Any database platform must support this cleanly.

### 4. Multi-site and tenancy boundaries

The product will likely support:

```text
organizations
sites
buildings
floors
zones
assets
sensors
users
roles
```

Backend/database decisions must support scoped access at every layer.

### 5. Operational complexity

SereniBase includes multiple services. The team must verify whether it simplifies operations or adds another platform to maintain.

## Recommended database platform direction

### MVP

```text
PostgreSQL + TimescaleDB
Drizzle migrations
NestJS domain APIs
Infisical for team secrets
.env only as local fallback
```

### Pilot-ready product

```text
Managed or self-hosted PostgreSQL + TimescaleDB
Redis
Object storage
Infisical or OpenBao for secrets
Dedicated backup/restore workflows
```

### Enterprise product

```text
PostgreSQL + TimescaleDB with HA/backup/restore
External secrets manager
Audit logging
Resource-scoped access control
Optional customer-managed/on-prem deployment
```

## Secrets manager recommendation

### Preferred MVP/team option: Infisical

Infisical is a strong fit for early team development because it is open-source and easier to operate than Vault-style systems.

Use it for:

- environment-scoped secrets,
- developer onboarding,
- CI/CD secret injection,
- service credentials,
- AI provider keys,
- database credentials,
- Redis credentials,
- storage credentials.

### Enterprise option: OpenBao/Vault-style workflow

OpenBao or Vault-style systems are better when the product needs:

- dynamic secrets,
- lease/rotation workflows,
- strict audit logs,
- PKI/certificate workflows,
- enterprise compliance requirements,
- customer-managed infrastructure.

They are more powerful but more complex.

## Secret rotation requirements

The full product should support rotation for:

- JWT signing secrets,
- database credentials,
- Redis credentials,
- object storage credentials,
- AI provider API keys,
- SMTP credentials,
- IoT device credentials,
- OPC-UA certificates,
- MQTT credentials.

## Secret access rules

- Services may only access secrets required for their own responsibility.
- The frontend must never receive server-only secrets.
- AI service must not receive unrelated infrastructure secrets.
- Logs must redact tokens, passwords, API keys, and connection strings.
- CI/CD must use scoped secrets per environment.
- Production deployments must not depend on plaintext files committed to Git.

## Deployment models

### Internal/staging

```text
Infisical or GitHub Actions secrets
Docker Compose or VM deployment
Managed Postgres/Timescale if available
```

### Enterprise cloud

```text
Cloud secret manager or OpenBao/Vault
Managed PostgreSQL/Timescale
Kubernetes optional only when needed
```

### On-prem customer deployment

```text
OpenBao or customer-approved secret manager
Self-hosted PostgreSQL/TimescaleDB
Offline-compatible installation package
Documented backup/restore
No external AI dependency unless approved
```

## Recommended decision

```text
Do not adopt SereniBase as the default full-product backend yet.
Keep SereniBase as a candidate for proof of concept or internal admin/backend tooling.
Keep PostgreSQL + TimescaleDB as the official data direction.
Use Infisical for MVP/team secrets management.
Evaluate OpenBao/Vault-style secrets management for enterprise/on-prem deployments.
```

## Required proof of concept before adopting SereniBase

A SereniBase POC must prove:

- compatibility with TimescaleDB extension and hypertables,
- compatibility with Drizzle migration ownership,
- safe RBAC/resource scoping,
- no bypass of NestJS business rules,
- integration with external secrets manager,
- ability to run in Docker Compose and future production deployment,
- acceptable operational complexity,
- clear ownership boundaries with API gateway and ingestion service.
