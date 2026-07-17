# Deploy Digital Twin FM — Full Stack on a Single VM (Docker Compose)

This runbook deploys the **entire stack** (web + api-gateway + ai-service +
ingestion-service + sensor simulator) with PostgreSQL/TimescaleDB, Valkey, and
Mosquitto, on one Linux VM using the existing `docker-compose.yml`. It does
**not** require the (currently unwritten) GitHub Actions workflows — it's a
manual deploy you run over SSH. This is the path described in
`documents/mvp/DEPLOYMENT.md` minus the CI automation.

> Prereq: a Linux VM (Hetzner CX31 / DigitalOcean Droplet 4GB+ recommended),
> Ubuntu 22.04/24.04, with a public IP and DNS A-record pointed at it
> (e.g. `dtfm.example.com`). You need Docker + Compose v2 on the VM.

---

## 1. Provision + base setup (on the VM)

```bash
# SSH in
ssh root@<VM_IP>

# Install Docker + Compose plugin (Ubuntu)
apt update && apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
docker compose version   # expect v2.x
```

## 2. Ship the app files

From **your machine** (repo root), copy the compose file, Dockerfiles, and app
source to the VM. The compose `build:` blocks build images *on the VM* from
source, so you only need to transfer the repo (excluding `node_modules`,
`.next`, local DB data).

```bash
# On your machine, from repo root:
rsync -avz --exclude node_modules --exclude '.next' --exclude '.turbo' \
  --exclude '.git' --exclude '*.log' \
  ./ root@<VM_IP>:/opt/digital-twin/
```

Then on the VM:

```bash
ssh root@<VM_IP>
mkdir -p /opt/digital-twin && cd /opt/digital-twin
```

## 3. Environment file

The compose reads `.env` from the project root. Copy the template and fill the
**required** values (compose uses `${VAR:?...}` guards, so a missing required
var fails fast):

```bash
cp .env.example .env
nano .env   # or vim
```

Minimum required (do NOT leave these as the example placeholders in prod):

| Var | Notes |
|---|---|
| `POSTGRES_PASSWORD` | required, strong |
| `REDIS_PASSWORD` | required, strong (Valkey) |
| `JWT_ACCESS_SECRET` | **32+ chars** — add to `.env` (not in example; compose doesn't require it but api-gateway needs it) |
| `JWT_REFRESH_SECRET` | **32+ chars** — add to `.env` |
| `MVP_ADMIN_PASSWORD` | admin login for the MVP |
| `CORS_ORIGIN` | e.g. `https://dtfm.example.com` (comma-separated, no spaces) |
| `NEXT_PUBLIC_API_URL` | **external** gateway URL, e.g. `https://dtfm.example.com/api` (must match the Caddy route you expose) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | for ai-service (optional if you don't need the copilot) |

`NODE_ENV` should be `production` on the VM. `POSTGRES_HOST`, `REDIS_HOST`,
`AI_SERVICE_URL`, `MQTT_URL` are overridden by compose's service-level
`environment:` to the internal Docker hostnames — **leave them as localhost in
`.env`**; compose corrects them.

## 4. Build + start

```bash
cd /opt/digital-twin
docker compose build            # builds all 5 service images on-VM
docker compose up -d            # starts infra + app services
docker compose ps              # verify all containers are "Up" / healthy
```

The `db-migrate` service runs migrations automatically (it's a
`restart: "no"` one-shot that `api-gateway` waits on). To re-run migrations
explicitly:

```bash
docker compose run --rm db-migrate
```

## 5. Health checks

```bash
curl http://localhost:4000/health     # api-gateway  -> {status:"ok"}
curl http://localhost:8000/health     # ai-service   -> {status:"ok"}
curl http://localhost:4100/health     # ingestion    -> {status:"ok"}
curl http://localhost:3000/api/health # web          -> {status:"ok"}
```

## 6. Expose it publicly (Caddy reverse proxy — already in compose, commented)

Uncomment the `caddy:` service block in `docker-compose.yml` and add a
`Caddyfile` at repo root:

```
# Caddyfile
dtfm.example.com {
    reverse_proxy /api/* localhost:4000
    reverse_proxy localhost:3000
}
```

Then:

```bash
docker compose up -d caddy
```

Caddy auto-provisions TLS via Let's Encrypt. Point your DNS A-record at the
VM IP first. Set `NEXT_PUBLIC_API_URL=https://dtfm.example.com/api` and
`CORS_ORIGIN=https://dtfm.example.com` in `.env`, then
`docker compose up -d` to apply.

## 7. Smoke test the change

Open `https://dtfm.example.com` → Digital Twin page → **All Floors** view:
- Floor-mounted markers (Chiller/Boiler/Pump): visible pole + ground disc.
- Ceiling-mounted (AHU/Fan/Lighting): pole + leader disc dropped to floor.
- Elevator: cab rides inside a translucent shaft, not a floating cube.

## 8. Operations

```bash
docker compose logs -f <service>   # tail logs
docker compose pull && docker compose up -d   # future updates (after git pull + rebuild)
docker compose down                 # stop (keeps volumes)
docker compose down -v              # stop + wipe DB (destroys data)
```

## Notes / gaps vs DEPLOYMENT.md

- The `deploy-staging.yml` / `deploy-prod.yml` GitHub Actions workflows
  referenced in `documents/mvp/DEPLOYMENT.md` **do not exist yet**. This
  runbook is the manual equivalent. To enable CI auto-deploy later, those
  workflows must be authored and a container registry + VM SSH deploy key
  configured.
- No Kubernetes/Helm — that's post-MVP per the architecture doc.
- Secrets here are plain `.env` on the VM. For managed secrets, wire Infisical
  (variables are already stubbed in `.env.example`).
