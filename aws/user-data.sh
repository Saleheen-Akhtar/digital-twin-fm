#!/bin/bash
# EC2 user-data bootstrap for Digital Twin FM (AWS Free Tier, t3.micro)
# Paste this as the "User data" when launching the instance, OR run it
# manually over SSH after the instance is up. It installs Docker, clones
# the repo, and starts the full stack via Docker Compose.
#
# Free-tier notes:
#  - t3.micro = 1 GB RAM. web + api + postgres + valkey fit; the Python
#    ai-service + ingestion add memory pressure. Keep them OFF on free tier
#    (comment their services in docker-compose.yml) or expect swapping.
#  - Postgres/Valkey run IN-CONTAINER (not RDS/ElastiCache) to stay $0.
#    Data persists on the instance EBS volume (default gp3 8–30 GB free).
#  - Your company LLM key goes in /opt/digital-twin/.env (AI_SERVICE_URL
#    points at the local ai-service container) — no third-party LLM bill.
set -euo pipefail

# 1. Install Docker + Compose plugin (Ubuntu 22.04/24.04)
apt-get update -y
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
usermod -aG docker ubuntu

# 2. Fetch the app
mkdir -p /opt/digital-twin
cd /opt/digital-twin
git clone --depth 1 https://github.com/Saleheen-Akhtar/digital-twin-fm.git . || true

# 3. Env file — FILL THESE. On free tier, point AI at your company key.
cp .env.example .env
# Edit .env manually (or via SSM/Secrets Manager in production):
#   POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
#   MVP_ADMIN_PASSWORD  -> strong, unique
#   NODE_ENV=production
#   NEXT_PUBLIC_API_URL=https://dtfm.your-domain.com/api
#   CORS_ORIGIN=https://dtfm.your-domain.com
#   OPENAI_API_KEY / ANTHROPIC_API_KEY / LITELLM_* -> your company key
# On free tier, comment out the `ai`, `ingestion`, `simulator` services in
# docker-compose.yml unless you have RAM headroom.

# 4. Build + run
docker compose build
docker compose up -d

# 5. Enable Caddy TLS reverse proxy (after DNS A-record points here)
# docker compose up -d caddy

echo "Bootstrap complete. Web: localhost:3000 (or your domain once Caddy is up)."
