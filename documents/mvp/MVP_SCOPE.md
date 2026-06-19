# MVP Scope — Digital Twin FM

## Purpose

Define strict boundaries for the Singapore MVP. Focus on Digital Twin and AI demo impact.

## Included in MVP

### Core Platform
- Turborepo + pnpm workspace.
- Next.js web app.
- NestJS API gateway.
- Python FastAPI AI service.
- PostgreSQL + TimescaleDB + Redis.
- Infisical for secrets.

### Domain Features
- Building Hierarchy (Site/Building/Floor/Zone/Asset)
- Basic Digital Twin Viewer (GLB/GLTF)
- Dashboard (Executive KPI view + Building Health Score)
- Realtime Sensor Monitoring (via Redis/WebSocket)
- Asset Registry
- Alert Engine
- AI Copilot (Core features: health summary, energy explanation, root-cause insights)

### Ingestion Strategy (Software-First)
- Sensor simulator script for development and demo reliability.
- Dual-mode ingestion service supporting `simulate` (internal timer) and `live` (MQTT/REST) modes.
- This allows seamless swap to real IoT gateway (e.g., Node-RED, Industrial PC) post-MVP without backend changes.

## Deferred to Phase 2/3

- Full Maintenance/CMMS (Work Orders, Technicians, Assignments, Logs)
- Multi-building/Multi-site management
- Mobile app / PWA offline support
- BACnet/Modbus/OPC-UA direct connectors
- Predictive maintenance deep-learning models
- Audit logging (full enterprise)
- SSO/SAML integration (Phase 3+)

