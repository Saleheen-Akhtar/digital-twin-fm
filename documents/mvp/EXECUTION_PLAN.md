# Execution Plan — Digital Twin FM

## Purpose

This document outlines the focused execution plan for the Singapore MVP. It prioritizes impactful demo features over building a complete facility management system initially.

## Core Philosophy: Software-First & Demo Impact

For the Singapore project, we are prioritizing a **Software-First** approach.

- **Simulation First:** We will build the system against a simulated sensor stream. This ensures development speed and robustness.
- **Hardware Abstraction:** The `ingestion-service` will be built with a "Dual-Mode" interface (Simulator vs. Live IoT Gateway), allowing us to swap in real sensors later without changing the backend code.
- **Demo Impact:** Digital Twin + AI features are prioritized to capture attention.
- **Maintenance Deferral:** Full CMMS workflows are post-MVP to keep the project agile.

## Execution Phases for MVP

### Phase 0: Foundation (Technical Setup)

**Goal:** Establish a runnable technical base.

- **Monorepo Setup:** Turborepo + pnpm workspace.
- **Core Services:** `apps/web`, `apps/api-gateway`, `apps/ingestion-service`, `apps/ai-service`.
- **Shared Packages:** `packages/ui`, `packages/db`, `packages/types`, `packages/config`.
- **Database/Cache:** Docker Compose for PostgreSQL/TimescaleDB and Redis.
- **Secrets Management:** Infisical integration plan / local fallback secret loading.
- **CI/CD:** Basic GitHub Actions workflow.
- **Data Seeding:** Command to populate one demo facility with hierarchy, assets, and initial sensor data.

### Phase 1: Digital Twin Demo Foundation (Visuals & Hierarchy)

**Goal:** Make the product visually understandable and feel like a digital twin.

- **Login/Authentication:** Basic user login flow.
- **Dashboard Shell:** Layout for executive overview.
- **Building Hierarchy:** UI for navigating sites, buildings, floors, zones, and assets.
- **Basic Digital Twin Viewer:** Integrated 3D viewer (GLB/GLTF or simplified model) showing spatial context.
- **Asset Markers:** Display assets within the 3D viewer with basic status overlays.
- **Executive KPI View:** Placeholder for key performance indicators and a Building Health Score.
- **Asset Registry:** List of assets with basic details (type, location, status).
- **Simulated Sensors:** Generation of realistic, streaming sensor data for one demo facility.

### Phase 2: Realtime Monitoring & Alerts (Live Data & Responsiveness)

**Goal:** Make the system feel alive with dynamic data and immediate notifications.

- **Sensor Ingestion:** Process simulated sensor data through the ingestion service.
- **TimescaleDB Storage:** Store sensor readings efficiently in TimescaleDB.
- **Realtime Events:** Publish sensor updates and alerts via Redis Pub/Sub.
- **WebSocket Gateway:** Stream realtime data to the frontend via NestJS WebSocket.
- **Live Monitoring Charts:** Display critical sensor metrics and trends on the dashboard.
- **Threshold-Based Alerts:** Configure and trigger alerts based on sensor data thresholds.
- **Alert List & Detail:** UI for viewing active and historical alerts.
- **Alert Overlays:** Visually highlight alerted assets/zones in the Digital Twin Viewer.

### Phase 3: AI Copilot Hero Layer (Intelligent Insights)

**Goal:** Demonstrate the unique value of AI for facility operations.

- **AI Copilot Endpoint:** Integrate FastAPI AI service with NestJS API gateway.
- **Building Status Summary:** AI provides natural language summaries of overall building health.
- **Energy/Anomaly Explanation:** AI explains unusual energy consumption or anomalies based on sensor data and operational context (deterministic rules first).
- **Alert Explanation:** AI provides context and potential root causes for triggered alerts.
- **Asset Health Explanation:** AI summarizes the health status of individual assets.
- **Building Health Score Explanation:** AI explains the factors contributing to the overall Building Health Score.
- **Suggested Actions:** AI recommends next steps for facility managers based on current data and alerts.
- **Provider Abstraction:** Design for easy swapping of AI models (OpenAI, Anthropic, local).

### Phase 4: Demo Hardening & Packaging

**Goal:** Ensure a reliable, repeatable, and impressive demo experience.

- **Demo Reset Script:** Quickly reset the database and application state for multiple demos.
- **Scenario Playback:** Scripted sensor data playback profiles for consistent demo scenarios.
- **Presenter Guide:** Documentation for demo scripts and key talking points.
- **Error Handling & Loading States:** Robust UI/UX for a smooth demo.
- **Observability:** Basic logging and monitoring for demo environment.
- **Deployment Instructions:** Clear steps for deploying the demo environment.
- **Offline Mode (Limited):** Considerations for offline playback if live network is unreliable.

## Deferred Features (Post-MVP / Phase 5+)

- **Full Maintenance/CMMS:** Work orders, technician assignments, status workflows, maintenance logs, comments, attachments.
- **Multi-building/Multi-site Management:** Full enterprise architecture for managing multiple distinct facilities.
- **Mobile App / PWA:** Dedicated mobile experience for field technicians.
- **Direct IoT/BMS Connectors:** Native integrations with BACnet, Modbus, OPC-UA, MQTT brokers.
- **Advanced Predictive Models:** Deep learning for equipment failure prediction.
- **Enterprise Security:** SSO/SAML, ABAC, advanced audit logging.
- **BIM/IFC Full Integration:** Comprehensive parsing and interaction with complex BIM/IFC models.

## Rationale for this plan

This plan optimizes for maximum impact at the Singapore project by focusing resources on the most compelling features: the visual Digital Twin, live monitoring, and intelligent AI insights. Building a full CMMS is a significant effort that can obscure the core innovation for early audiences and is better deferred until the core value proposition is validated.
