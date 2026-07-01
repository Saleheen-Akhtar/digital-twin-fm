# ── base: pnpm + node ───────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ── deps: fetch all packages to store ──────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

# ── build: install + compile ───────────────────────────────────
FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm install -r --offline
RUN pnpm --filter @digital-twin-fm/ingestion-service run build

# Deploy production-only bundle (strips devDeps, keeps workspace deps)
RUN pnpm --filter @digital-twin-fm/ingestion-service --prod deploy /deploy

# ── runner: minimal production image ───────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4100
COPY --from=build /deploy ./
EXPOSE 4100
CMD ["node", "dist/index.js"]
