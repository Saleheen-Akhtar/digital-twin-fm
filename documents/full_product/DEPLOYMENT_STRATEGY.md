# Deployment Strategy — Digital Twin FM

## Purpose

This document defines the post-MVP deployment direction for Digital Twin FM across demo, pilot, production, enterprise cloud, and possible on-prem environments.

## Deployment stages

### Stage 1 — Local development

- Docker Compose for PostgreSQL/TimescaleDB and Redis.
- `pnpm dev` for Node/Next services.
- FastAPI dev server for AI service.
- Seed/demo data.

### Stage 2 — Expo/demo

- Single reproducible demo environment.
- Docker Compose or simple VM deployment.
- Stable seed data and simulator.
- Backup copy of demo database.
- Offline fallback/demo recording if network fails.

### Stage 3 — Pilot production

- Single VM or small VM setup.
- Managed PostgreSQL/TimescaleDB preferred.
- Managed Redis preferred.
- Caddy/Nginx reverse proxy with HTTPS.
- Automated daily backups.
- Basic observability.
- Staging and production environments.

### Stage 4 — Enterprise production

Options depend on customer needs:

1. SaaS/private cloud.
2. Customer private cloud.
3. On-prem Docker Compose.
4. On-prem Kubernetes.

## Recommended early production architecture

```text
Caddy/Nginx
  -> web
  -> api-gateway
  -> ingestion-service
  -> ai-service
Managed PostgreSQL/TimescaleDB
Managed Redis
Object storage for model/docs/uploads
```

Prefer managed database services when possible to reduce operational burden.

## Kubernetes guidance

Kubernetes should not be introduced just for appearance.

Use Kubernetes when:
- multiple customers/environments require repeatability,
- horizontal scaling is needed,
- service isolation matters,
- operations team can manage it,
- Helm/GitOps deployment brings real benefit.

If Kubernetes is used, provide:
- Helm charts,
- ingress config,
- secret integration,
- readiness/liveness probes,
- resource requests/limits,
- migration job pattern,
- backup integration.

## On-prem deployment

Some facility customers may require on-prem deployment.

On-prem package should include:
- Docker Compose or Helm manifests,
- installation guide,
- environment variable template,
- backup/restore scripts,
- upgrade procedure,
- offline-friendly AI option if external LLM use is not allowed,
- network port documentation.

## Environments

Minimum environments:

| Environment | Purpose |
|---|---|
| local | developer machine |
| staging | pre-production validation |
| production | customer-facing |
| demo | stable demo environment if needed |

## CI/CD

Pipeline should include:
- install dependencies,
- lint,
- typecheck,
- unit tests,
- integration tests where possible,
- build apps/packages,
- Docker image build,
- vulnerability scan later,
- deploy to staging,
- smoke tests,
- manual approval for production.

## Database migrations

Rules:
- Migrations are forward-only.
- Review generated SQL.
- Run migrations before or during deploy with clear ordering.
- Avoid long locks on production tables.
- Back up before high-risk migrations.
- Never manually edit already-applied migrations.

## Rollback strategy

Rollback has two parts:

1. Application rollback: deploy previous image/version.
2. Database rollback: usually forward-fix with a new migration.

Because database down migrations are risky, production deploys should be designed for backward compatibility:
- add columns before using them,
- deploy code that supports old/new schema,
- remove old columns only after safe window.

## Disaster recovery

Define:
- RPO: recovery point objective.
- RTO: recovery time objective.
- backup frequency,
- backup storage location,
- restore owner,
- restore test cadence.

## Secrets and configuration

Do not store production secrets in Git.

Use:
- cloud secret manager,
- encrypted CI secrets,
- Kubernetes external secrets,
- secure on-prem secret procedure.

## Acceptance criteria

- Deployment is repeatable.
- Rollback is documented.
- Backups are automated.
- Restore is tested.
- Health checks exist.
- Production secrets are not committed.
- Staging mirrors production enough to catch deploy issues.
