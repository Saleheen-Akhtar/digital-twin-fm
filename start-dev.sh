#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  start-dev.sh  —  Digital Twin FM full stack
# ──────────────────────────────────────────────
cd "$(dirname "$0")"
PROJECT_ROOT="$(pwd)"
LOGDIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOGDIR"

echo "=== Digital Twin FM — starting all services ==="

# 1. Source .env (optional)
if [ -f .env ]; then
  set -a; source .env; set +a
fi

# 2. Start infra dependencies (Docker containers)
echo "  [infra] Starting PostgreSQL, Valkey, Mosquitto…"
if docker info &>/dev/null; then
  docker compose up -d postgres valkey mosquitto 2>&1 | sed 's/^/     /'
  echo "  [infra] Waiting for PostgreSQL to be healthy…"
  for i in $(seq 1 30); do
    if docker inspect --format='{{.State.Health.Status}}' dtfm-postgres 2>/dev/null | grep -q healthy; then
      echo "  [infra] PostgreSQL healthy"
      break
    fi
    sleep 1
  done
  echo "  [infra] Waiting for Valkey to be healthy…"
  for i in $(seq 1 15); do
    if docker inspect --format='{{.State.Health.Status}}' dtfm-valkey 2>/dev/null | grep -q healthy; then
      echo "  [infra] Valkey healthy"
      break
    fi
    sleep 1
  done
  # Run DB migration
  echo "  [infra] Running DB migrations…"
  docker compose run --rm db-migrate 2>&1 | sed 's/^/     /' || true
else
  echo "  [WARN] Docker not available — infra services must be running manually"
  echo "         Start them with:  docker compose up -d postgres valkey mosquitto"
  echo "         Or open Docker Desktop first."
fi

# 3. Export overrides (per‑service only)
export AI_SERVICE_URL=${AI_SERVICE_URL:-http://localhost:8011}

# 4. Start each service in background, logs to .logs/
echo "  [start] ai-service          → port 8011"
cd "$PROJECT_ROOT/apps/ai-service"
uvicorn app.main:app --reload --port 8011 > "$LOGDIR/ai-service.log" 2>&1 &
AI_PID=$!

cd "$PROJECT_ROOT"
echo "  [start] web                 → port 3000"
pnpm --filter @digital-twin-fm/web dev > "$LOGDIR/web.log" 2>&1 &
WEB_PID=$!

echo "  [start] api-gateway         → port 4000"
AI_SERVICE_URL=http://localhost:8010 PORT=4000 pnpm --filter @digital-twin-fm/api-gateway dev > "$LOGDIR/api-gateway.log" 2>&1 &
API_PID=$!

echo "  [start] ingestion-service   → port 4100"
pnpm --filter @digital-twin-fm/ingestion-service dev > "$LOGDIR/ingestion-service.log" 2>&1 &
INGEST_PID=$!

# Worker + simulator need a moment for Redis/DB to settle
sleep 4

echo "  [start] worker              → sensor processing"
pnpm --filter @digital-twin-fm/ingestion-service worker > "$LOGDIR/worker.log" 2>&1 &
WORKER_PID=$!

echo "  [start] simulator           → generates readings"
pnpm --filter @digital-twin-fm/ingestion-service simulator > "$LOGDIR/simulator.log" 2>&1 &
SIM_PID=$!

# 5. Wait for health checks
echo ""
echo "=== Waiting for services to become healthy ==="

wait_for() {
  local name=$1 url=$2 pid=$3
  local waited=0
  while [ $waited -lt 30 ]; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "  [FAIL] $name — process exited early (see .logs/${name}.log)"
      return 1
    fi
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      echo "  [ OK ] $name  ← $url"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  echo "  [WARN] $name — not responding after 30s (check .logs/${name}.log)"
  return 1
}

wait_for "ai-service"    "http://localhost:8010/health"    $AI_PID
wait_for "web"           "http://localhost:3000/"          $WEB_PID
wait_for "api-gateway"   "http://localhost:4000/health"    $API_PID
wait_for "ingestion"     "http://localhost:4100/health"    $INGEST_PID

echo ""
echo "=== All services started ==="
echo "  web:              http://localhost:3000"
echo "  api-gateway:      http://localhost:4000"
echo "  ai-service:       http://localhost:8010"
echo "  ingestion:        http://localhost:4100"
echo "  worker:           running (PID $WORKER_PID)"
echo "  simulator:        running (PID $SIM_PID)"
echo ""
echo "  Logs: $LOGDIR/"
echo "  Stop all: kill $AI_PID $WEB_PID $API_PID $INGEST_PID $WORKER_PID $SIM_PID"
echo ""

# Keep script alive — Ctrl+C kills everything
trap 'echo "Shutting down..."; kill $AI_PID $WEB_PID $API_PID $INGEST_PID $WORKER_PID $SIM_PID 2>/dev/null; exit' INT TERM
wait
