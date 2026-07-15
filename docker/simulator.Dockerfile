# ── base: pnpm + node ───────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ── deps: fetch + install the db workspace package (brings tsx) ──
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
RUN pnpm fetch

# ── build: install db package (incl. devDeps for tsx) ──────────
FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm install -r --offline

# ── runner ─────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
# Run the sensor simulator continuously so sensor_readings stay fresh.
CMD ["sh", "-c", "corepack enable && pnpm --filter @digital-twin-fm/db exec tsx src/simulator.ts run"]
