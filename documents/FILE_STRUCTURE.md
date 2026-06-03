# Digital Twin FM — File Structure

```
digital-twin-fm/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                        # lint + typecheck on every PR
│       ├── deploy-staging.yml            # auto deploy on merge to dev
│       └── deploy-prod.yml               # manual approval → prod
│
├── apps/
│   │
│   ├── web/                              # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/                      # Next.js App Router
│   │   │   │   ├── (auth)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── buildings/
│   │   │   │   │   └── [id]/
│   │   │   │   ├── alerts/
│   │   │   │   ├── maintenance/
│   │   │   │   ├── api/                  # Next.js API routes (BFF)
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── features/                 # domain-driven vertical slices
│   │   │   │   ├── building-overview/    # owner: Akshay
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   ├── services/
│   │   │   │   │   ├── store/
│   │   │   │   │   ├── types/
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── digital-twin/         # owner: Akshay
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   ├── services/
│   │   │   │   │   ├── store/
│   │   │   │   │   ├── types/
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── monitoring/           # owner: Sumanth
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   ├── services/
│   │   │   │   │   ├── store/
│   │   │   │   │   ├── types/
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── alerts/               # owner: Sumanth
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   ├── services/
│   │   │   │   │   ├── store/
│   │   │   │   │   ├── types/
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── maintenance/          # owner: Sahil
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   ├── services/
│   │   │   │   │   ├── store/
│   │   │   │   │   ├── types/
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── ai-copilot/           # owner: Sudhanva
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   ├── services/
│   │   │   │   │   ├── store/
│   │   │   │   │   ├── types/
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   └── executive-dashboard/  # owner: shared
│   │   │   │       ├── components/
│   │   │   │       ├── hooks/
│   │   │   │       ├── services/
│   │   │   │       ├── store/
│   │   │   │       ├── types/
│   │   │   │       └── index.ts
│   │   │   │
│   │   │   ├── shared/                   # cross-feature only
│   │   │   │   ├── components/           # layout, navbar, wrappers
│   │   │   │   ├── hooks/                # useWebSocket, useAuth, etc.
│   │   │   │   ├── lib/                  # api client, formatters, utils
│   │   │   │   └── store/                # global auth + session store
│   │   │   │
│   │   │   └── assets/                   # fonts, images, icons
│   │   │
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── api-gateway/                      # Node.js + WebSocket
│   │   ├── src/
│   │   │   ├── domains/                  # domain-driven
│   │   │   │   ├── buildings/
│   │   │   │   │   ├── buildings.controller.ts
│   │   │   │   │   ├── buildings.routes.ts
│   │   │   │   │   ├── buildings.service.ts
│   │   │   │   │   └── buildings.dto.ts
│   │   │   │   ├── twins/
│   │   │   │   │   ├── twins.controller.ts
│   │   │   │   │   ├── twins.routes.ts
│   │   │   │   │   ├── twins.service.ts
│   │   │   │   │   └── twins.dto.ts
│   │   │   │   ├── monitoring/
│   │   │   │   │   ├── monitoring.controller.ts
│   │   │   │   │   ├── monitoring.routes.ts
│   │   │   │   │   ├── monitoring.service.ts
│   │   │   │   │   └── monitoring.dto.ts
│   │   │   │   ├── alerts/
│   │   │   │   │   ├── alerts.controller.ts
│   │   │   │   │   ├── alerts.routes.ts
│   │   │   │   │   ├── alerts.service.ts
│   │   │   │   │   └── alerts.dto.ts
│   │   │   │   ├── maintenance/
│   │   │   │   │   ├── maintenance.controller.ts
│   │   │   │   │   ├── maintenance.routes.ts
│   │   │   │   │   ├── maintenance.service.ts
│   │   │   │   │   └── maintenance.dto.ts
│   │   │   │   ├── ai-copilot/
│   │   │   │   │   ├── ai-copilot.controller.ts
│   │   │   │   │   ├── ai-copilot.routes.ts
│   │   │   │   │   ├── ai-copilot.service.ts
│   │   │   │   │   └── ai-copilot.dto.ts
│   │   │   │   ├── reporting/
│   │   │   │   │   ├── reporting.controller.ts
│   │   │   │   │   ├── reporting.routes.ts
│   │   │   │   │   ├── reporting.service.ts
│   │   │   │   │   └── reporting.dto.ts
│   │   │   │   └── users/
│   │   │   │       ├── users.controller.ts
│   │   │   │       ├── users.routes.ts
│   │   │   │       ├── users.service.ts
│   │   │   │       └── users.dto.ts
│   │   │   │
│   │   │   ├── shared/
│   │   │   │   ├── middleware/           # auth, rate-limit, error handler
│   │   │   │   ├── websockets/           # Redis pub/sub → WS broadcast
│   │   │   │   └── lib/                  # db client, redis client, logger
│   │   │   │
│   │   │   └── main.ts
│   │   │
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── ai-service/                       # Python FastAPI
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── copilot.py
│   │   │   │   ├── predictions.py
│   │   │   │   └── anomaly.py
│   │   │   ├── models/
│   │   │   │   ├── anomaly_detector.py
│   │   │   │   └── maintenance_predictor.py
│   │   │   ├── db/                       # SQLAlchemy — mirrors Drizzle schema
│   │   │   │   └── models.py
│   │   │   ├── rag/                      # AI copilot context retrieval
│   │   │   │   ├── embeddings.py
│   │   │   │   └── retriever.py
│   │   │   └── main.py
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   └── ingestion-service/                # IoT sensor data intake
│       ├── src/
│       │   ├── connectors/
│       │   │   ├── mqtt.connector.ts     # BMS / IoT sensors
│       │   │   └── http.connector.ts     # HTTP polling fallback
│       │   ├── processors/
│       │   │   └── sensor.processor.ts   # normalize + validate
│       │   ├── publishers/
│       │   │   ├── redis.publisher.ts    # pub/sub → api-gateway
│       │   │   └── db.publisher.ts       # persist to TimescaleDB
│       │   └── main.ts
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   │
│   ├── ui/                               # design system
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── AlertBadge.tsx        # ok / warn / crit
│   │   │   │   ├── SensorCard.tsx
│   │   │   │   ├── MetricChart.tsx
│   │   │   │   └── BuildingSelector.tsx
│   │   │   ├── tokens.ts                 # colors, spacing, status tokens
│   │   │   └── index.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   ├── db/                               # Drizzle ORM schema + migrations
│   │   ├── schema/
│   │   │   ├── buildings.ts
│   │   │   ├── assets.ts
│   │   │   ├── sensors.ts                # TimescaleDB hypertable
│   │   │   ├── alerts.ts
│   │   │   └── users.ts
│   │   ├── migrations/
│   │   ├── index.ts                      # exports db client + schema
│   │   └── package.json
│   │
│   ├── types/                            # shared TypeScript interfaces
│   │   ├── sensor.types.ts
│   │   ├── building.types.ts
│   │   ├── alert.types.ts
│   │   └── index.ts
│   │
│   └── config/
│       ├── eslint-config/
│       ├── typescript-config/            # base tsconfig.json
│       └── prettier-config/
│
├── scripts/
│   ├── seed.ts                           # seed database
│   ├── migrate.ts                        # run Drizzle migrations
│   └── setup-local.sh                    # one-command local dev setup
│
├── infra/
│   └── README.md                         # placeholder — add Terraform/K8s when needed
│
├── documents/
│   └── TECHNICAL_PRD.md
│
├── docker-compose.yml                    # local: postgres + redis + all services
├── .env.example
├── .gitignore
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Team Ownership

| Domain | Owner |
|---|---|
| `building-overview/` | Akshay |
| `digital-twin/` | Akshay |
| `monitoring/` | Sumanth |
| `alerts/` | Sumanth |
| `maintenance/` | Sahil |
| `ai-copilot/` | Sudhanva |
| `executive-dashboard/` | Shared |
