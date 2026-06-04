# Secrets Management — MVP

## Purpose

This document defines the MVP secrets-management strategy for Digital Twin FM.

The goal is to avoid committing or exposing credentials while keeping local and team development simple.

## Decision

Use **Infisical** as the preferred secrets manager for MVP and team development.

```text
Secrets manager: Infisical
Local fallback: .env only for individual local development
Production principle: no plaintext secrets in Git, Docker images, logs, or documentation
```

## Why Infisical

Infisical is the best fit for the current stage because it is:

- open source,
- free/self-hostable for project needs,
- easier to operate than Vault/OpenBao,
- friendly for small teams,
- suitable for Node.js, Python, Docker, and CI/CD,
- capable of managing separate environments such as local, development, staging, and production.

## Environment structure

Recommended Infisical environments:

```text
local
preview
development
staging
production
```

Each environment should keep separate values for database, Redis, JWT, AI provider, storage, email, and observability secrets.

## Required MVP secrets

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

AI provider:
  OPENAI_API_KEY
  ANTHROPIC_API_KEY

Frontend public config:
  NEXT_PUBLIC_API_URL
  NEXT_PUBLIC_WS_URL

Observability:
  SENTRY_DSN
```

## Local development policy

Local `.env` files are allowed only as a fallback for individual machines.

Rules:

- `.env` must never be committed.
- `.env.local` must never be committed.
- `.env.example` may be committed with empty placeholders only.
- Real secrets must come from Infisical when team development begins.
- Agents must never print, summarize, or preserve real secret values.

## CI/CD policy

For GitHub Actions:

```text
Preferred: inject secrets from Infisical into CI jobs.
Fallback: use GitHub Actions secrets for minimal early workflows.
```

CI/CD secrets must be scoped by environment.

Do not reuse local/dev secrets in staging or production.

## Production policy

Production must use managed secret injection.

Accepted options:

```text
Primary: Infisical
AWS deployment option: AWS Secrets Manager or AWS Systems Manager Parameter Store
Enterprise/on-prem option: OpenBao/Vault-style workflow if required
```

## Secret access rules

- `apps/web` receives only public frontend config values.
- `apps/api-gateway` receives database, Redis, auth, and app integration secrets.
- `apps/ingestion-service` receives ingestion/device integration secrets only.
- `apps/ai-service` receives AI provider keys and scoped API credentials only.
- No service should receive secrets it does not need.
- Logs must redact tokens, passwords, API keys, and connection strings.

## Rotation expectations

The MVP should support manual rotation for:

- JWT secrets,
- database password,
- Redis password,
- AI provider keys,
- SMTP credentials if email is added.

Full automation can come later, but the code must not hardcode secrets anywhere.

## Decision status

```text
Decision: Use Infisical for MVP/team secrets management.
Local fallback: .env files only for individual development, never committed.
AWS option: Parameter Store or Secrets Manager only if deployed on AWS.
Enterprise option: evaluate OpenBao/Vault later if required.
```
