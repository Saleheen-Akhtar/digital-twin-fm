# Dev image for the ai-service — runs `uvicorn app.main:app --reload`.
# Self-contained: full workspace deps installed (incl. py3-pip for uvicorn);
# source bind-mounted by docker-compose.dev.yml.

FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
# Python tooling for the FastAPI dev server.
RUN apk add --no-cache python3 py3-pip
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

WORKDIR /app/apps/ai-service
EXPOSE 8000
CMD ["pnpm", "dev"]
