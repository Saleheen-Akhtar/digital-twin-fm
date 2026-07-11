# Dev image for the ingestion-service — runs `tsx watch src/index.ts`.
# Self-contained: full workspace deps installed; source bind-mounted by
# docker-compose.dev.yml.

FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/ingestion-service/package.json apps/ingestion-service/
COPY apps/ai-service/package.json apps/ai-service/

RUN pnpm install -r --frozen-lockfile

WORKDIR /app/apps/ingestion-service
EXPOSE 4100
CMD ["pnpm", "dev"]
