# Implemented Features — Digital Twin FM

> Audit date: June 27, 2026
> Total implemented: **69 features** across **14 modules**

---

## 1. Dashboard & Executive Overview (6/9)

- [x] **Building Health Score** — Weighted formula (assets 50pts, sensors 20pts, status penalties) displayed in `DashboardMetricsLive` component
- [x] **Live KPI Dashboard** — Real-time metric cards (temperature, power, alerts, occupancy, energy) polling `/building/snapshot`
- [x] **Energy Consumption Overview** — `avgEnergyKw` in building snapshot, power consumption chart on monitoring page
- [x] **Asset Status Summary** — Summary cards (total / ok / warning / offline) on `/dashboard/assets`
- [x] **Active Alerts** — Alert count badge on sidebar, full alert feed on main dashboard
- [x] **Open Work Orders** — Listed on main dashboard with status filter, full page at `/dashboard/work-orders`
- [x] **Occupancy Overview** — CO₂ / occupancy sensors visible in monitoring charts
- [x] **Building Performance Trends** — `buildingSnapshots` history table with sparkline charts, 24h trend queries via API

## 2. Digital Twin Module (10/10)

- [x] **3D Building Visualization** — Three.js viewer with orbital controls, floor groups, asset markers
- [x] **Multi-floor Navigation** — Floor toggle in viewer, floor selector panel
- [x] **Building Hierarchy** — Full DB schema: `buildings → floors → rooms → assets → sensors`
- [x] **Room Navigation** — Rooms FK to floors in schema, positionable in 3D space
- [x] **Asset Visualization** — 3D markers sized by asset type, colored by operational status
- [x] **Real-time Asset Status** — WebSocket via `useRealtime` hook pushing live status changes
- [x] **Equipment Health Indicators** — Color-coded dots (green / amber / red / neutral) per asset
- [x] **Color-coded Asset Health** — `STATUS_COLOR` mapping in `asset-detail-panel.tsx`
- [x] **Digital Twin Scene Management** — Zustand store for scene state, floor visibility toggling
- [x] **Asset Relationship Mapping** — FKs: assets → floors, assets → rooms, sensors → assets

## 3. Asset Management (6/9)

- [x] **Asset Inventory** — `/dashboard/assets` page with full list, status cards, and API-backed CRUD
- [x] **Asset Registration** — Schema fields: name, type, manufacturer, model, serial number, install date
- [x] **Asset Health Score** — Per-asset status model (ok / warning / critical / offline)
- [x] **Equipment Details** — `AssetDetailPanel` shows live sensor readings, recent alerts, location
- [x] **Asset Location Mapping** — `floorId`, `roomId`, 3D `positionX/Y/Z` in schema
- [x] **Asset History** — `maintenanceLogs` table tracking every action per asset
- [x] **Maintenance History** — Full work-order-linked log of maintenance actions
- [x] **Asset Lifecycle Tracking** — `installedAt`, `createdAt`, `updatedAt`, status transitions

## 4. IoT Monitoring (7/11)

- [x] **Live Sensor Data** — WebSocket streaming via Valkey pub/sub with `useSensorRealtime` hook
- [x] **Temperature Monitoring** — Dedicated chart on `/dashboard/monitoring`
- [x] **Humidity Monitoring** — Chart on monitoring page
- [x] **Occupancy Monitoring** — CO₂ / presence sensor dashboard
- [x] **HVAC Monitoring** — Simulator chiller / AHU failure scenarios, asset types for chillers, boilers, AHUs, fans
- [x] **Energy Meter Monitoring** — Real-time power (kW) chart
- [x] **Air Quality Monitoring** — CO₂ and VOC sensor types in simulator

## 5. AI Copilot (7/7)

- [x] **Natural Language Queries** — Chat UI at `/dashboard/copilot` with streaming SSE and markdown rendering
- [x] **Root Cause Analysis** — AI receives full building context (sensors, alerts, assets) for grounded reasoning
- [x] **Asset Search** — AI can query asset registry through the context pipeline
- [x] **Knowledge Search** — Building-aware RAG over regulations / manuals
- [x] **Building Q&A** — Questions answered from live data, not static docs
- [x] **Report Generation** — AI can compose weekly/monthly/incident reports
- [x] **Recommendation Engine** — Energy savings, maintenance priorities, operational improvements

## 6. Alert Management (5/9)

- [x] **Real-time Alerts** — Worker publishes alerts to Valkey pub/sub; frontend receives via WebSocket
- [x] **Critical Alerts** — Severity levels: low, medium, high, critical
- [x] **Warning Alerts** — Medium-severity threshold alerts
- [x] **Alert History** — All alerts persisted in `alerts` table, retrievable via API
- [x] **Alert Acknowledgment** — Acknowledge / resolve actions in `/dashboard/alerts`

## 7. Work Order Management (4/7)

- [x] **Create Work Orders** — Full create modal with title, description, asset, priority, due date
- [x] **Assign Technician** — `assignedTo` FK in schema, status workflow (open → in_progress → completed)
- [x] **Maintenance Scheduling** — `dueAt`, `startedAt`, `completedAt` timestamp fields
- [x] **Task Tracking** — Filter by status, search by title/asset, per-asset work-order view

## 8. Energy Management (3/8)

- [x] **Energy Dashboard** — Power consumption and energy metrics on main dashboard KPI strip
- [x] **Real-time Power Consumption** — Live kW chart on monitoring page
- [x] **AI Energy Recommendations** — AI Copilot can produce energy-saving suggestions

## 9. Building Operations (4/7)

- [x] **Floor Monitoring** — Floor selector panel with per-floor status indicator
- [x] **Occupancy Dashboard** — Occupancy metrics on main dashboard
- [x] **Environmental Monitoring** — Temperature, humidity, CO₂, pressure sensors tracked
- [x] **Comfort Indicators** — Floor/zone-level status derived from sensor aggregates

## 10. User & Tenant Management (3/6)

- [x] **Role-Based Access Control** — 4 roles: admin, facility_manager, technician, viewer
- [x] **User Management** — JWT-based auth with login endpoint, configurable admin account
- [x] **Permission Management** — `JwtAuthGuard` + `RolesGuard` decorators on controllers

## 11. Integration Module (1/10)

- [x] **REST API Integration** — Full NestJS REST API with versioned endpoints, Swagger-ready controllers

## 12. AI Analytics (4/8)

- [x] **Trend Analysis** — `buildingSnapshots` time-series data with 24h / 7d aggregation
- [x] **Root Cause Analysis** — AI Copilot with full sensor context
- [x] **Building Performance Analysis** — Health score computed from asset, sensor, and alert state
- [x] **Occupancy Analytics** — Occupancy sensor readings queryable over time

## 13. Physical Demo Control (3/7)

- [x] **Simulate HVAC Failure** — `chiller_failure` scenario in sensor simulator
- [x] **Simulate Energy Spike** — `power_surge_floor_3` scenario
- [x] **One-click Demo Scenarios** — Scenario switching with immediate effect on all simulated sensors

## 14. Administration (4/7)

- [x] **Building Configuration** — `GET /buildings`, `GET /buildings/:id` endpoints
- [x] **Floor Configuration** — Floor schema with building FK, unique per-building level constraint
- [x] **Asset Configuration** — Full asset CRUD in API and UI
- [x] **Sensor Configuration** — Sensor schema with FK to asset, type, unit, thresholds
- [x] **Threshold Management** — `thresholdLow` / `thresholdHigh` per sensor, enforced by ingestion worker

---

## Architecture Notes

| Layer | Technology | Details |
|-------|-----------|---------|
| **Frontend** | Next.js 15 + React 19 | 7 dashboard pages, landing page, Three.js viewer |
| **API Gateway** | NestJS 11 + Node.js 22 | REST controllers for buildings, assets, sensors, alerts, work-orders, auth |
| **AI Service** | FastAPI + LiteLLM | RAG copilot, context injection, SSE streaming |
| **Ingestion** | Node.js worker | Valkey pub/sub consumer, threshold checks, alert creation |
| **Simulator** | Node.js service | Generates realistic sensor data with failure scenarios |
| **Database** | PostgreSQL 17 + TimescaleDB | Hypertable for `sensor_readings`, 13 tables total |
| **Cache / Events** | Valkey (Redis fork) | Pub/sub for sensor readings and asset updates |
| **Auth** | JWT + argon2 | Access + refresh tokens, role-based guards |
