# Full Product Roadmap — Digital Twin FM

## Roadmap intent

This roadmap describes the path from MVP to a complete commercial-grade product.

The key product decision is:

```text
Build Digital Twin + AI value first.
Add deeper Facility Management / CMMS workflows after validation.
```

The architecture remains scalable, but the execution order prioritizes the product experience customers will remember.

## Phase 1 — MVP: Digital Twin + AI demo

Goal: demonstrate the product vision with a working, believable, high-impact platform.

Deliverables:

- Turborepo/pnpm monorepo scaffold.
- Next.js dashboard.
- NestJS API gateway.
- Node.js ingestion service with HTTP simulator input.
- Python FastAPI AI service.
- PostgreSQL + TimescaleDB + Redis.
- Infisical secrets-management convention.
- Seeded building/floor/zone/asset/sensor data.
- Basic digital twin viewer with asset markers.
- Live sensor updates via WebSocket.
- Alerts list, acknowledge, resolve.
- Executive Building Health Score.
- AI Copilot hero scenarios:
  - building health summary,
  - energy/anomaly explanation,
  - alert explanation,
  - asset health explanation,
  - suggested next actions.
- Asset registry and asset detail.

Explicitly deferred:

- full work-order lifecycle,
- technician assignment,
- maintenance history/logs,
- full CMMS workflow.

Success criteria:

- Demo can run end-to-end without manual database edits.
- Sensor simulator can trigger live UI updates.
- Alerts update dashboard and digital twin status.
- AI can explain at least one alert/anomaly using building/asset/sensor context.
- Building Health Score gives executives a single KPI.
- Demo deployment can be reproduced by the team.

## Phase 2 — Pilot-ready product foundation

Goal: make the Digital Twin + AI foundation safe and reliable enough for a controlled real-facility pilot.

Deliverables:

- Real authentication flow with expiring sessions.
- Role-based and resource-scoped authorization.
- More complete database schema with organizations/sites.
- Basic audit logs.
- Production-like deployment environment.
- Automated backups and restore test procedure.
- Structured logging with request IDs.
- Service health dashboards.
- Improved seed/import tooling for facility setup.
- Better asset-to-twin mapping workflow.
- Data quality flags for sensor readings.
- Admin UI for users, assets, and sensor mapping.

Exit criteria:

- A pilot facility can be onboarded without changing source code.
- Facility-specific setup data can be imported.
- Every operational write is attributable to a user or service.
- Basic recovery from service/database failure is documented and tested.

## Phase 3 — AI intelligence and operational insights

Goal: make AI a real operational differentiator, not just a demo chat box.

Deliverables:

- RAG over facility documents and manuals.
- Root-cause analysis workflows.
- Energy optimization recommendations.
- Alert summarization.
- Asset health explanation.
- Building Health Score explanation.
- Citation and source tracking.
- AI evaluation dataset.
- Human approval gates for operational actions.
- Provider abstraction for OpenAI/Anthropic/local models.
- Cost, latency, and quality monitoring.

Exit criteria:

- AI answers are permission-scoped and cite sources when appropriate.
- AI recommendations can be evaluated against known incidents.
- AI explains operational context using sensor + asset + alert data.
- AI never performs critical actions without human approval.

## Phase 4 — Maintenance / CMMS module

Goal: add structured facility-management workflows around the validated digital twin platform.

Deliverables:

- Work orders.
- Technician assignment.
- Work order status flow.
- Maintenance logs.
- Comments/attachments.
- Create work order from alert.
- Technician workflow.
- Maintenance history.
- AI-drafted work order descriptions.
- SLA/reporting hooks.

Exit criteria:

- Facility manager can create and assign work orders.
- Technician can update assigned work order status.
- Work order history is linked to assets and alerts.
- AI can draft suggestions but cannot complete operational actions automatically.

## Phase 5 — Real facility integration

Goal: connect to real facility systems and make ingestion reliable.

Deliverables:

- MQTT connector.
- BACnet connector or integration plan.
- Modbus connector or integration plan.
- OPC-UA connector or integration plan.
- Vendor REST API connector framework.
- Device registry.
- Sensor-to-asset mapping UI.
- Connector health dashboard.
- Raw payload storage for troubleshooting.
- Dead-letter handling for invalid messages.
- Retry and idempotency rules.
- Unit normalization and calibration metadata.

Exit criteria:

- At least one real facility data source streams into the system.
- Bad/unknown readings are safely rejected or quarantined.
- Operators can see connector status and ingestion lag.
- Sensor readings can be traced back to source connector/device.

## Phase 6 — Enterprise digital twin

Goal: evolve from simple 3D/spatial view into a true enterprise facility digital twin.

Deliverables:

- Multi-building and multi-site navigation.
- GLB/GLTF production support.
- IFC/BIM import strategy.
- Model versioning.
- Asset-to-model-object mapping.
- Floor and zone isolation.
- Sensor overlays on 2D/3D views.
- Status heatmaps.
- Spatial search and object selection.
- Performance budgets for large models.

Exit criteria:

- Facility teams can locate assets spatially.
- Model updates do not break historical asset references.
- Viewer remains responsive with realistic building models.

## Phase 7 — Enterprise scale

Goal: support real enterprise customers and long-term operations.

Deliverables:

- SSO/OIDC/SAML.
- SCIM or IdP-driven user provisioning.
- Multi-organization support.
- Tenant isolation strategy if offered as SaaS.
- Advanced audit logs.
- Data retention policies.
- Disaster recovery plan.
- OpenTelemetry tracing.
- Prometheus/Grafana dashboards.
- Sentry or equivalent error tracking.
- Kubernetes/Helm if operationally justified.
- On-prem deployment package if required.

Exit criteria:

- Enterprise customer security review can be passed.
- Production incidents can be diagnosed from logs/metrics/traces.
- Backups are tested and restore time is known.
- Deployment and rollback are repeatable.

## Product maturity checklist

Before calling the product complete, verify:

- [ ] Digital twin viewer supports realistic facility use cases.
- [ ] Live sensor data flows reliably into the UI.
- [ ] AI is permission-scoped and evaluated.
- [ ] Real device ingestion works.
- [ ] Multi-site data model exists.
- [ ] Full maintenance/work-order workflows exist.
- [ ] SSO is supported.
- [ ] Audit trail covers critical actions.
- [ ] Backups and restores are tested.
- [ ] Observability dashboards exist.
- [ ] Role/resource permissions are enforced server-side.
- [ ] Reporting and exports support management workflows.
- [ ] Deployment supports target customer environment.
