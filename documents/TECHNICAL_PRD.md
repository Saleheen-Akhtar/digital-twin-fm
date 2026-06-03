# Technical Product Requirements Document (PRD)

## Digital Twin for Intelligent Facility Management

---

## 1. Introduction & Architecture Vision

This document translates the product vision for the **Digital Twin for Intelligent Facility Management** into a flexible, future-proof technical architecture. The system is designed to provide real-time virtual representations of physical facilities, monitor operations, and predict maintenance needs using AI.

To ensure long-term scalability, flexibility, and maintainability, the system will utilize a **Microservices-ready Monorepo Architecture**. This allows independent scaling of various domains (Asset Management, Real-Time Monitoring, AI Assistant) while maintaining a unified developer experience.

### 1.1 Core Technology Stack
- **Monorepo Management:** Turborepo (pnpm)
- **Frontend Framework:** Next.js (App Router, React 18+)
- **Backend Services:**
  - Node.js (TypeScript) for real-time data handling and API Gateway.
  - Python 3.11+ for AI processing, predictive analytics, and heavy data computations.
- **Databases:**
  - Relational: PostgreSQL (Asset metadata, user roles, system config).
  - In-Memory/Caching/PubSub: Redis (Real-time monitoring streams, session management).
  - Time-Series (Future/Recommended): InfluxDB or TimescaleDB for IoT sensor data.
- **Infrastructure & Containerization:** Docker Desktop (local), Docker Compose, Kubernetes (production target).

---

## 2. Initial Setup & Scaffolding Plan

The project will be initiated following a strict 9-step scaffolding protocol to ensure robust CI/CD, tooling, and repository management from day one.

1. **Install Prerequisites**
   - Ensure Node 20+, Python 3.11+, Docker Desktop, pnpm, and Git are installed on developer machines.
2. **Scaffold Monorepo**
   - Use `pnpm create turbo` to establish the monorepo structure.
   - Adopt an `apps/web` (Next.js) and `apps/api` (Node/Python) structure.
3. **Create GitHub Repo**
   - Initialize the repository with `main` and `dev` branches.
   - Enforce branch protection rules and add team members.
4. **Configure Tooling**
   - Setup unified ESLint, Prettier, and global `tsconfig.json`.
   - Create `.env.example` and standard `.gitignore`.
5. **Wire up CI**
   - Implement `.github/workflows/ci.yml`.
   - Enforce linting and typechecking on every Pull Request.
6. **Docker Compose locally**
   - Configure `docker-compose.yml` to spin up Postgres, Redis, API services, and Web services locally.
   - Ensure `docker compose up` works seamlessly for local dev.
7. **Create ZenTao Tasks**
   - Create one tracking task per step outlined here.
   - Assign initial setup to lead engineers and set Sprint 1.
8. **Define Design Tokens**
   - Establish `tokens.ts` defining colors, spacing, and status indicators (ok/warn/crit). (Detailed in section 4).
9. **First Commit + PR**
   - Push the skeleton code.
   - Ensure CI is green, merge the PR, and declare the project alive.

---

## 3. System Architecture & Components

### 3.1 Apps & Services Structure
Inside the Turborepo (`apps/` directory):
- `apps/web`: The Next.js frontend application (The Digital Twin Interface, Executive Dashboard, Incident Management).
- `apps/api-gateway`: Node.js/Express (or NestJS) service routing frontend requests and handling WebSockets for real-time monitoring.
- `apps/ai-service`: Python FastAPI service for the AI Facility Assistant, Root Cause Analysis, and Predictive Maintenance ML models.
- `apps/ingestion-service`: High-throughput service (Node or Python) dedicated to receiving and standardizing IoT/sensor data from the facility.

### 3.2 Real-Time Monitoring & IoT Data Flow
1. Sensors transmit data to the `ingestion-service`.
2. Data is immediately pushed to Redis Pub/Sub for real-time broadcasting.
3. `api-gateway` consumes Redis streams and pushes updates to the `apps/web` Next.js client via WebSockets.
4. Concurrently, data is persisted to the database (Postgres/Time-Series) for historical reporting and AI analysis.

---

## 4. Strong Design System & UI Architecture

A robust, scalable design system is critical for visualizing complex facility data effectively. The frontend will be built on Next.js using a highly structured component library approach.

### 4.1 Design System Stack
- **Styling:** Tailwind CSS for utility-first, rapid, and consistent styling.
- **Component Library Base:** Radix UI or shadcn/ui for accessible, unstyled primitives that can be heavily customized.
- **State Management:** Zustand (for global UI state) and React Query (for server state and data fetching).
- **Data Visualization:** Recharts or Visx for rendering energy usage, occupancy intelligence, and analytics dashboards.
- **3D / Digital Twin Rendering (Future-proofing):** React Three Fiber (Three.js) for rendering actual 3D facility models.

### 4.2 Design Tokens (`packages/ui/tokens.ts`)
As defined in the scaffolding step 8, the design system will be driven by centralized tokens shared across the monorepo:

- **Colors:** Primary, Secondary, Backgrounds, Surface.
- **Status Indicators (Crucial for Facility Management):**
  - `status.ok`: Green (System nominal)
  - `status.warn`: Yellow/Orange (Anomaly detected, degraded equipment)
  - `status.crit`: Red (Equipment failure, critical incident)
- **Typography:** Standardized scales for Executive Dashboards vs. dense Asset tables.
- **Spacing/Layout:** Standardized gaps and paddings for a cohesive grid.

### 4.3 UI Package Structure
The design system will live in `packages/ui` within the monorepo, allowing it to be consumed by `apps/web` or any future applications (e.g., a dedicated mobile app).

---

## 5. Mapping Product Requirements to Technical Implementation

| Product Requirement | Technical Approach |
| :--- | :--- |
| **Digital Twin Experience** | Next.js dynamic routing for facility hierarchy (Building -> Floor -> Room). React Three Fiber for 3D visualization. |
| **Asset Intelligence** | Postgres relational models linking Assets to locations, maintenance histories, and relationships (Foreign Keys & adjacency lists). |
| **Real-Time Monitoring** | Redis Pub/Sub + WebSockets in Node.js pushing live state to Next.js Zustand stores. |
| **Incident Detection / Alerts**| Node.js event listeners on incoming data streams evaluating thresholds. Push notifications via WebSocket or Email integrations. |
| **Predictive Maintenance** | Python AI service periodically querying historical Postgres/Time-Series data to run anomaly detection models, flagging `status.warn`. |
| **AI Facility Assistant** | Python FastAPI integrating with an LLM (e.g., OpenAI or local Llama). Context provided via Retrieval-Augmented Generation (RAG) using facility documentation. |
| **Reporting & Analytics** | React Query fetching aggregated data from Postgres, rendered using Recharts in Next.js Executive Dashboards. |

---

## 6. Future Proofing & Scalability

1. **API First:** All features will be exposed via RESTful or GraphQL APIs, ensuring that mobile apps or third-party integrations can be easily added later.
2. **Infrastructure as Code (IaC):** Ready for Kubernetes deployment using Helm charts.
3. **Event-Driven Architecture:** By utilizing Redis/PubSub for real-time events early on, we can easily transition to Kafka if data volume necessitates it in the future.
4. **LLM Agnosticism:** The AI Facility Assistant will be built with an abstraction layer over the LLM provider, allowing swapping between proprietary (OpenAI/Anthropic) and open-source models based on cost and privacy requirements.
