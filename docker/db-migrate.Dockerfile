# Dedicated migration runner.
# The api-gateway image is a pruned `pnpm --prod deploy` artifact that does
# NOT contain the @digital-twin-fm/db workspace package, so reusing it for
# `node node_modules/@digital-twin-fm/db/migrate.mjs` fails with
# MODULE_NOT_FOUND. This image performs a full (non-pruned) install and runs
# the Drizzle migration script directly from packages/db.
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

FROM deps AS build
WORKDIR /app
COPY . .
# Full install (no --prod) so @digital-twin-fm/db + its deps are present.
RUN pnpm install -r --offline
# Build the db package so types resolve (migrate.mjs itself needs only runtime deps).
RUN pnpm --filter @digital-twin-fm/db run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
WORKDIR /app/packages/db
CMD ["node", "migrate.mjs"]
