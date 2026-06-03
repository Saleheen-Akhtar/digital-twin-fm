# Monorepo File System Structure

Based on the 9-step scaffolding plan and the microservices architecture, the Turborepo monorepo will follow this detailed directory structure:

```text
root/
├── .github/                   # GitHub Actions (CI/CD)
│   └── workflows/
│       └── ci.yml             # Lint and typecheck on every PR
├── apps/                      # Applications and deployable services
│   ├── web/                   # Next.js Frontend Application
│   │   ├── src/
│   │   │   ├── app/           # App Router (pages, layouts, api routes)
│   │   │   ├── components/    # App-specific UI components
│   │   │   ├── lib/           # App-specific utilities
│   │   │   └── store/         # Zustand global state
│   │   ├── public/            # Static assets
│   │   ├── next.config.js
│   │   └── package.json
│   ├── api-gateway/           # Node.js API Gateway & WebSockets
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── websockets/    # Redis Pub/Sub integration
│   │   └── package.json
│   ├── ai-service/            # Python FastAPI Service
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── models/        # ML Models / LLM integration
│   │   │   └── main.py
│   │   └── requirements.txt
│   └── ingestion-service/     # High-throughput IoT data ingestion
│       ├── src/
│       └── package.json
├── packages/                  # Shared libraries and internal dependencies
│   ├── ui/                    # Design System & UI Components
│   │   ├── src/
│   │   │   ├── components/    # Reusable shadcn/ui components
│   │   │   ├── tokens.ts      # Design tokens (colors, spacing, status)
│   │   │   └── index.ts
│   │   ├── tailwind.config.js # Shared Tailwind configuration
│   │   └── package.json
│   ├── db/                    # Shared database models and Prisma/Drizzle schema
│   │   ├── schema/
│   │   ├── migrations/
│   │   ├── index.ts
│   │   └── package.json
│   ├── config/                # Shared configurations
│   │   ├── eslint-config/     # Unified ESLint rules
│   │   ├── typescript-config/ # Global tsconfig.json base
│   │   └── prettier-config/
│   └── types/                 # Shared TypeScript interfaces (e.g., Asset definitions)
├── documents/                 # Project Documentation
│   ├── TECHNICAL_PRD.md       # Technical Requirements
│   └── FILE_STRUCTURE.md      # Detailed Monorepo Structure (This file)
├── .env.example               # Example environment variables
├── .gitignore                 # Global gitignore
├── docker-compose.yml         # Local Docker environment (Postgres, Redis, APIs)
├── package.json               # Root monorepo package.json
├── pnpm-workspace.yaml        # pnpm workspace definition
└── turbo.json                 # Turborepo task runner configuration
```

### Key Structural Decisions
- **`apps/` vs. `packages/`:** Deployable applications live in `apps/`. Shared, reusable logic and components that are consumed by multiple applications live in `packages/`.
- **`packages/db/`:** Centralizing the database schema ensures that all Node.js services interact with the database using identical types and models.
- **`packages/ui/`:** As requested, the robust design system is isolated. This allows the Next.js `web` app to import components cleanly (e.g., `import { Button } from '@repo/ui'`) and ensures future frontends remain visually consistent.
