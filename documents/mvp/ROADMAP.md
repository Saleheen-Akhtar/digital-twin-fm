# Roadmap — Digital Twin FM

## Roadmap decision

The architecture remains the same, but the execution order is revised for higher demo impact and lower MVP risk.

The MVP must prove **Digital Twin + Live Sensors + AI Insight** before building a full CMMS/work-order product.

```text
Foundation
  -> Dashboard
  -> Digital Twin Viewer
  -> Realtime Sensors
  -> Alerts
  -> AI Copilot
  -> Maintenance / CMMS later
```

## Why the roadmap changed

The original roadmap was technically strong but put too much weight on maintenance/work orders before the digital twin and AI experience.

For the Singapore Expo and early customer validation, the memorable product is:

```text
3D/spatial building view
+ live sensor state
+ alert context
+ AI explanation
+ executive health score
```

Most facility-management products already have maintenance/work orders. Digital Twin FM should first differentiate with the digital twin and AI layer, then add deeper maintenance workflows around it.

## Phase 0 — Documentation and foundation decisions

Goal: lock the decisions that reduce rework.

Deliverables:

- Finalize MVP scope.
- Finalize architecture decisions.
- Finalize PostgreSQL + TimescaleDB database direction.
- Finalize Infisical secrets-management direction.
- Finalize API/realtime/event contracts.
- Finalize Digital Twin + AI first execution order.

Exit criteria:

- Docs clearly distinguish Expo MVP from full commercial product.
- Maintenance/CMMS is marked as post-MVP except asset registry and asset health summary.
- Digital Twin and AI are early phases, not late phases.

## Phase 1 — Monorepo and platform foundation

Goal: create the runnable technical foundation.

Deliverables:

- Scaffold pnpm workspace + Turborepo.
- Add `apps/web`, `apps/api-gateway`, `apps/ingestion-service`, `apps/ai-service`.
- Add `packages/ui`, `packages/db`, `packages/types`, `packages/config`.
- Add Docker Compose for PostgreSQL/TimescaleDB and Redis.
- Add Infisical integration plan / local fallback secret loading.
- Add CI workflow.
- Add seed data command.

Exit criteria:

- `pnpm install` succeeds.
- `docker compose up` starts PostgreSQL/TimescaleDB and Redis.
- Services can start locally.
- Seed data can create one demo facility.

## Phase 2 — Dashboard + building hierarchy

Goal: make the product visually understandable quickly.

Deliverables:

- Login/mock-auth flow.
- Dashboard shell.
- Building/floor/zone navigation.
- Executive overview cards.
- Building Health Score placeholder.
- Asset registry list.
- Asset detail page with location/status/latest readings placeholders.

Exit criteria:

- A user can open the dashboard and understand the building hierarchy.
- At least one seeded building, floor, zone, asset, and sensor appears in the UI.
- Asset registry exists, but work-order workflows are not required yet.

## Phase 3 — Digital Twin Viewer MVP

Goal: make the product feel like a digital twin, not only a dashboard.

Deliverables:

- Basic 3D or spatial viewer using React Three Fiber / Three.js.
- GLB/GLTF or simplified model support.
- Floor/zone selection.
- Asset markers.
- Sensor/status overlays.
- Click marker -> asset detail panel.
- Alert color/status badges on assets or zones.

Exit criteria:

- Demo user can visually inspect a building/floor/zone.
- Asset markers map to real seeded assets.
- Sensor/alert status can be shown spatially.

## Phase 4 — Realtime monitoring and alerts

Goal: make the system feel alive.

Deliverables:

- HTTP sensor simulator.
- Ingestion validation and normalization.
- TimescaleDB `sensor_readings` writes.
- Redis Pub/Sub events.
- NestJS WebSocket gateway.
- Live monitoring cards/charts.
- Threshold alert creation.
- Alert list/detail.
- Alert acknowledge/resolve.
- Alert overlays in dashboard and digital twin viewer.

Exit criteria:

- A simulated sensor reading appears in the frontend without page refresh.
- A threshold breach creates an alert.
- Alert state updates are visible in realtime.
- Digital twin view reflects asset/zone alert status.

## Phase 5 — AI Copilot hero layer

Goal: make AI the memorable demo feature.

Deliverables:

- FastAPI AI service health endpoint.
- Copilot endpoint through NestJS API gateway.
- Building status summary.
- Energy/anomaly explanation using deterministic rules first.
- Alert explanation.
- Asset health explanation.
- Building Health Score explanation.
- Suggested next actions.
- Provider abstraction for OpenAI/Anthropic/local models.

Example demo prompts:

```text
Why is Floor 3 consuming more energy today?
Which assets need attention right now?
Summarize the building health in 3 bullets.
What should the facility manager check first?
Why did this alert trigger?
```

Exit criteria:

- AI can explain at least one alert using sensor + asset context.
- AI can summarize current building health.
- AI returns evidence/suggested actions rather than generic chat output.
- AI is permission-scoped through the API gateway.

## Phase 6 — Expo hardening and demo packaging

Goal: make the demo reliable and repeatable.

Deliverables:

- Demo data reset script.
- Scenario script for presenter.
- Seeded sensor playback profiles.
- Error boundaries and loading states.
- Basic observability/logging.
- Deployment instructions for demo environment.
- Screenshot/video backup if live network fails.

Exit criteria:

- Demo can run end-to-end without manual database edits.
- Presenter can trigger known alert/anomaly scenarios.
- Team can reset demo state quickly.
- Demo works on the target machine/environment.

## Phase 7 — Maintenance / CMMS after MVP

Goal: turn the digital twin demo into an operational FM product after validation.

Deferred deliverables:

- Work orders.
- Technician assignment.
- Work order status flow.
- Maintenance logs.
- Comments/attachments.
- Create work order from alert.
- Technician workflow.
- Maintenance history.

Exit criteria:

- Work orders are added only after the Digital Twin + AI value proposition is proven.
- Maintenance workflows integrate with alerts/assets without bloating the Expo MVP.

## Post-MVP / full product

The full commercial product direction is documented in [`../full_product/`](../full_product/README.md), including:

- enterprise architecture,
- real IoT/BMS integration,
- BIM/IFC digital twin viewer,
- AI service maturity,
- observability,
- data retention,
- enterprise security,
- deployment strategy,
- mobile/PWA strategy,
- reporting and analytics,
- full maintenance/CMMS workflows.
