# Dev image for the Next.js web app — runs `next dev` with hot reload.
#
# Self-contained dev build (no cross-file base stage): installs the FULL
# workspace incl. @digital-twin-fm/db|types|ui from source so the pnpm
# workspace symlinks resolve. Source is bind-mounted by docker-compose.dev.yml,
# so `next dev` picks up edits without rebuilding.

FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Install deps from the lockfile first (cached layer).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/ingestion-service/package.json apps/ingestion-service/
COPY apps/ai-service/package.json apps/ai-service/

RUN pnpm install -r --frozen-lockfile

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "dev"]
