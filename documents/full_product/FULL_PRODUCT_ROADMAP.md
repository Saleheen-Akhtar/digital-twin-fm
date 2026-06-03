# Full Product Roadmap — Digital Twin FM

## Roadmap intent

This roadmap describes the path from the Expo MVP to a complete commercial-grade product. It intentionally separates what must be built now from what should be introduced after the MVP proves value.

## Phase 1 — Expo MVP

Goal: demonstrate the product vision with a working, believable platform.

Deliverables:
- Turborepo/pnpm monorepo scaffold.
- Next.js dashboard.
- NestJS API gateway.
- Node.js ingestion service with HTTP simulator input.
- Python FastAPI AI service skeleton.
- PostgreSQL + TimescaleDB + Redis.
- Seeded building/floor/room/asset/sensor data.
- Live sensor updates via WebSocket.
- Alerts list, acknowledge, resolve.
- Maintenance work orders and logs.
- Basic 3D or simplified digital twin view.
- Basic AI/copilot endpoint and anomaly explanation.

Success criteria:
- Demo can run end-to-end without manual database edits.
- Sensor simulator can trigger live UI updates.
- Alerts can create work orders.
- Work order lifecycle can be demonstrated.
- Demo deployment can be reproduced by the team.

## Phase 2 — Pilot-ready product

Goal: make the system safe and reliable enough for a controlled real-facility pilot.

Deliverables:
- Real authentication flow with expiring sessions.
- Role-based and resource-scoped authorization.
- More complete database schema with organizations/sites.
- Basic audit logs.
- Production-like deployment environment.
- Automated backups and restore test procedure.
- Structured logging with request IDs.
- Service health dashboards.
- Connector framework foundation for real devices.
- Data quality flags for sensor readings.
- Admin UI for users, assets, and sensor mapping.

Exit criteria:
- A pilot facility can be onboarded without changing source code.
- Facility-specific seed/setup data can be imported.
- Every operational write is attributable to a user or service.
- Basic recovery from service/database failure is documented and tested.

## Phase 3 — Real facility integration

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

## Phase 4 — Enterprise digital twin

Goal: evolve from dashboard + simple 3D into a true facility digital twin.

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

## Phase 5 — AI intelligence

Goal: turn AI from a demo feature into a trustworthy operational assistant.

Deliverables:
- RAG over facility documents and manuals.
- Root-cause analysis workflows.
- Predictive maintenance model pipeline.
- Energy optimization recommendations.
- Alert summarization.
- Work order draft generation.
- Citation and source tracking.
- AI evaluation dataset.
- Human approval gates for operational actions.
- Provider abstraction for OpenAI/Anthropic/local models.
- Cost, latency, and quality monitoring.

Exit criteria:
- AI answers are permission-scoped and cite sources when appropriate.
- AI recommendations can be evaluated against known incidents.
- AI never performs critical actions without human approval.

## Phase 6 — Enterprise scale

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

- [ ] Real device ingestion works.
- [ ] Multi-site data model exists.
- [ ] SSO is supported.
- [ ] Audit trail covers critical actions.
- [ ] Backups and restores are tested.
- [ ] Observability dashboards exist.
- [ ] Role/resource permissions are enforced server-side.
- [ ] AI is permission-scoped and evaluated.
- [ ] 3D/BIM viewer supports realistic facility use cases.
- [ ] Reporting and exports support management workflows.
- [ ] Deployment supports target customer environment.
