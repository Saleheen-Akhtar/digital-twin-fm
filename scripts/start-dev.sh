#!/usr/bin/env bash
# =========================================================================
# Digital Twin FM — single startup script
# Starts everything: infra → DB → full stack (incl. AI service)
# =========================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/.hermes/startup.log"
mkdir -p "$(dirname "$LOG")"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { printf "${CYAN}[INFO]${NC}  %s\n" "$*"; }
ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$*"; }
fail()  { printf "${RED}[FAIL]${NC}  %s\n" "$*"; }

# ── Kill stale processes ───────────────────────────────────────────────────
info "Killing stale node/uvicorn processes..."
pkill -f "node.*digital-twin" 2>/dev/null || true
pkill -f uvicorn 2>/dev/null || true
sleep 2
ok "Stale processes cleared"

# ── 1. Docker infra ────────────────────────────────────────────────────────
info "Starting Docker infra (Postgres + Valkey)..."
cd "$ROOT"
docker rm -f dtfm-valkey 2>/dev/null || true
docker compose up -d 2>&1 | tee -a "$LOG" || true

info "Waiting for Postgres..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U dtfm_user -d dtfm_db &>/dev/null; then
    ok "Postgres ready"
    break
  fi
  [ "$i" -eq 30 ] && { fail "Postgres timeout"; exit 1; }
  sleep 1
done

# ── 2. Database ────────────────────────────────────────────────────────────
info "Running DB migrations..."
pnpm db:migrate 2>&1 | tee -a "$LOG" || fail "Migration failed (may already be applied)"
ok "Migrations done"

# ── 3. Load env vars ───────────────────────────────────────────────────────
info "Loading env vars from .env..."
set -a; source <(grep -v '^#' "$ROOT/.env" | grep '='); set +a 2>/dev/null || true

# ── 4. Full stack (via Turborepo — includes ai-service, web, gateway, ingestion) ──
cd "$ROOT"
info "Starting full stack (web :3000 + api-gateway :4000 + ai-service :8000 + ingestion :4001)..."
pnpm dev 2>&1 &
STACK_PID=$!

# Wait for services
for i in $(seq 1 45); do
  web=0; ai=0
  curl -sf http://localhost:3000 >/dev/null 2>&1 && web=1
  curl -sf http://localhost:8000/health >/dev/null 2>&1 && ai=1
  [ "$web" -eq 1 ] && [ "$ai" -eq 1 ] && break
  sleep 1
done

# ── Ready ──────────────────────────────────────────────────────────────────
printf "\n${GREEN}══════════════════════════════════════════════════════════════${NC}\n"
printf "${GREEN}  🚀 Digital Twin FM is RUNNING!${NC}\n"
printf "${GREEN}══════════════════════════════════════════════════════════════${NC}\n"
printf "  Web:         ${CYAN}http://localhost:3000${NC}\n"
printf "  AI Copilot:  ${CYAN}http://localhost:3000/dashboard/copilot${NC}\n"
printf "  AI Service:  ${CYAN}http://localhost:8000${NC}\n"
printf "  API Gateway: ${CYAN}http://localhost:4000${NC}\n"
printf "  Ingestion:   ${CYAN}http://localhost:4001${NC}\n"
printf "\n  ${CYAN}Press Ctrl+C to stop everything${NC}\n"
printf "${GREEN}────────────────────────────────────────────────────────────${NC}\n"

wait "$STACK_PID"
