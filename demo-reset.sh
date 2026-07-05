#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────
#  demo-reset.sh  —  one-command demo state reset
# ──────────────────────────────────────────────────────
# Resets the Digital Twin FM demo to a clean baseline:
#   ✓ Clears alerts, work orders, sensor readings, logs
#   ✓ Resets asset / sensor statuses to 'ok'
#   ✓ Generates 1 hour of fresh baseline sensor readings
#   ✓ Keeps buildings, rooms, assets, and sensors intact
# ──────────────────────────────────────────────────────

cd "$(dirname "$0")"
PROJECT_ROOT="$(pwd)"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Digital Twin FM — Demo Reset                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Source .env ──────────────────────────────────
if [ -f .env ]; then
  set -a; source .env; set +a
fi

# ── 2. Ensure Docker infra is up ────────────────────
echo "  [1/5] Checking Docker infrastructure…"
if docker info &>/dev/null; then
  docker compose up -d postgres valkey mqtt 2>&1 | sed 's/^/        /'
  echo "  [1/5] Waiting for PostgreSQL…"
  for i in $(seq 1 30); do
    if docker inspect --format='{{.State.Health.Status}}' dtfm-postgres 2>/dev/null | grep -q healthy; then
      echo "  [1/5] ✓ PostgreSQL healthy"
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "  [FAIL] PostgreSQL not healthy after 30s"
      echo "         Try: docker compose logs postgres"
      exit 1
    fi
    sleep 1
  done
  for i in $(seq 1 15); do
    if docker inspect --format='{{.State.Health.Status}}' dtfm-valkey 2>/dev/null | grep -q healthy; then
      echo "  [1/5] ✓ Valkey healthy"
      break
    fi
    if [ "$i" -eq 15 ]; then
      echo "  [WARN] Valkey not healthy — continuing anyway"
    fi
    sleep 1
  done
else
  echo "  [WARN] Docker not available."
  echo "         Start infra manually: docker compose up -d postgres valkey mqtt"
  read -rp "         Press Enter once PostgreSQL is reachable, or Ctrl+C to abort…"
fi

# ── 3. Run DB migration (if pending) ─────────────────
echo "  [2/5] Running pending DB migrations…"
docker compose run --rm db-migrate 2>&1 | sed 's/^/        /' || true

# ── 4. Destroy mutable data + regenerate baselines ──
echo "  [3/5] Resetting demo state…"
pnpm --filter @digital-twin-fm/db reset 2>&1 | sed 's/^/        /'

# ── 5. Re-seed (ensures latest seed data is applied) ─
echo "  [4/5] Re-seeding database…"
pnpm --filter @digital-twin-fm/db seed 2>&1 | sed 's/^/        /'

# ── 6. Summary ──────────────────────────────────────
echo "  [5/5] Verifying state…"
# Quick count of key entities
DB_COUNTS=$(docker compose exec -T postgres psql -U dtfm_user -d dtfm_db -tAc "
  SELECT
    (SELECT count(*) FROM buildings)          AS buildings,
    (SELECT count(*) FROM floors)             AS floors,
    (SELECT count(*) FROM rooms)              AS rooms,
    (SELECT count(*) FROM assets)            AS assets,
    (SELECT count(*) FROM sensors)           AS sensors,
    (SELECT count(*) FROM sensor_readings)   AS readings;
" 2>/dev/null || echo "—")

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Demo reset complete!                           ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  DB Counts: $DB_COUNTS"
echo "║                                                  ║"
echo "║  Start services with:   ./start-dev.sh           ║"
echo "║  (Or restart existing processes)                 ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
