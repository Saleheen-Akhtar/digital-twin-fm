#!/usr/bin/env bash
# =========================================================================
# Digital Twin FM — Demo Reset Script
# =========================================================================
# Resets demo state to a clean baseline for reliable live playback:
#   1. Resets database (clears alerts, work orders, readings, resets statuses)
#   2. Resets simulator scenario to normal
#   3. Prints summary
#
# Usage:
#   ./scripts/demo-reset.sh                  # full reset
#   ./scripts/demo-reset.sh --seed           # reseed (wipe + full seed)
#   ./scripts/demo-reset.sh --scenario-only  # just reset simulator scenario
# =========================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_GATEWAY="http://localhost:4000"
DEMO_API="${API_GATEWAY}/demo"
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { printf "${CYAN}[INFO]${NC}  %s\n" "$*"; }
ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$*"; }
fail()  { printf "${RED}[FAIL]${NC}  %s\n" "$*"; }

MODE="${1:-full}"

printf "\n${CYAN}════════════════════════════════════════════════${NC}\n"
printf "${CYAN}  Digital Twin FM — Demo Reset${NC}\n"
printf "${CYAN}════════════════════════════════════════════════${NC}\n\n"

# ── Step 1: Reset simulator scenario to normal ──────────────────────────────
# Try via Redis CLI first (local infra), fall back to curl against api-gateway
info "Resetting simulator scenario to normal..."

if command -v redis-cli &>/dev/null; then
  redis-cli PUBLISH simulator.control '{"scenario":"normal"}' 2>/dev/null && \
    ok "Simulator scenario reset via Redis CLI" || \
    info "Redis CLI unavailable, trying API..."
elif curl -sf -X POST "${DEMO_API}/scenario" \
  -H "Content-Type: application/json" \
  -d '{"scenario":"normal"}' >/dev/null 2>&1; then
  ok "Simulator scenario reset via API"
else
  info "Simulator not reachable — start it with: pnpm --filter @digital-twin-fm/ingestion-service dev:simulator"
fi

# ── Step 2: Reset database ──────────────────────────────────────────────────
if [ "$MODE" = "--seed" ]; then
  info "Full reseed: wiping DB and seeding fresh demo data..."
  cd "$ROOT" && pnpm db:seed
  ok "Database reseeded"
elif [ "$MODE" != "--scenario-only" ]; then
  info "Resetting database (clear alerts, readings, work orders)..."
  cd "$ROOT" && pnpm db:reset
  ok "Database reset complete"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
printf "\n${GREEN}════════════════════════════════════════════════${NC}\n"
printf "${GREEN}  ✅ Demo state reset${NC}\n"
printf "${GREEN}════════════════════════════════════════════════${NC}\n"
echo ""
echo "  Simulator scenario: normal"
echo "  Dashboard:          http://localhost:3000/dashboard"
echo "  API Gateway:        http://localhost:4000"
echo ""
echo "  To start the simulator (if not running):"
echo "    pnpm --filter @digital-twin-fm/ingestion-service dev:simulator"
echo ""

