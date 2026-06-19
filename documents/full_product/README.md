# Full Product Documentation — Digital Twin FM

## Purpose

This folder defines the **post-MVP / full commercial product** direction for Digital Twin FM.

The MVP documents in `documents/` explain what must be built first for the demo milestone. The files in this folder explain how the platform should mature after that into a real facility-management product suitable for pilots, enterprise customers, and production deployments.

## Guiding principle

Do not overbuild the MVP. However, every MVP decision should keep a clean migration path toward the full product.

```text
MVP: prove value and architecture with simulated/seeded data.
Full product: run safely, securely, and reliably against real facilities.
```

## Document map

| Document | Purpose |
|---|---|
|| [FULL_PRODUCT_ROADMAP.md](./FULL_PRODUCT_ROADMAP.md) | Phased path from MVP to enterprise-grade platform |
| [POST_MVP_ARCHITECTURE.md](./POST_MVP_ARCHITECTURE.md) | How architecture evolves after MVP without rewriting everything |
| [ENTERPRISE_REQUIREMENTS.md](./ENTERPRISE_REQUIREMENTS.md) | Requirements for real customers: organizations, sites, SLAs, audit, support |
| [IOT_INTEGRATION_STRATEGY.md](./IOT_INTEGRATION_STRATEGY.md) | BMS/IoT connector strategy, device registry, mapping, reliability |
| [DIGITAL_TWIN_VIEWER_SPEC.md](./DIGITAL_TWIN_VIEWER_SPEC.md) | Full 2D/3D/BIM viewer requirements and model lifecycle |
| [AI_SERVICE_SPEC.md](./AI_SERVICE_SPEC.md) | Full AI copilot, RAG, anomaly, predictive maintenance, governance |
| [DATA_RETENTION.md](./DATA_RETENTION.md) | Sensor data retention, aggregation, compression, backups, restore |
| [DATABASE_AND_SECRETS_STRATEGY.md](./DATABASE_AND_SECRETS_STRATEGY.md) | Full-product PostgreSQL/TimescaleDB direction and Infisical secrets-management strategy |
| [OBSERVABILITY.md](./OBSERVABILITY.md) | Logs, metrics, traces, dashboards, alerting, incident response |
| [SECURITY_EXPANSION.md](./SECURITY_EXPANSION.md) | Enterprise security beyond MVP JWT/RBAC |
| [DEPLOYMENT_STRATEGY.md](./DEPLOYMENT_STRATEGY.md) | Cloud, single-VM, Kubernetes, on-prem, rollback, DR |
| [MOBILE_PWA_STRATEGY.md](./MOBILE_PWA_STRATEGY.md) | Technician mobile/PWA strategy, QR flows, offline direction |
| [REPORTING_ANALYTICS.md](./REPORTING_ANALYTICS.md) | Reporting, exports, executive dashboards, scheduled analytics |

## Relationship to MVP docs

- MVP architecture: `../mvp/ARCHITECTURE.md`
- Execution plan: `../mvp/EXECUTION_PLAN.md`
- MVP scope: `../mvp/MVP_SCOPE.md`
- MVP database: `../mvp/DATABASE_SCHEMA.md`
- MVP API contracts: `../mvp/API_CONTRACTS.md`
- MVP security: `../mvp/SECURITY.md`
- MVP roadmap: `../mvp/ROADMAP.md`

## Full product quality bar

The full product must be:

- secure by default,
- observable in production,
- recoverable after failures,
- scalable across multiple facilities,
- capable of real IoT/BMS integrations,
- able to support enterprise identity and audit requirements,
- maintainable by multiple engineering teams,
- useful for facility managers, technicians, executives, and operators.
