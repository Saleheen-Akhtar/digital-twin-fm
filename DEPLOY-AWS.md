# Deploy Digital Twin FM on AWS Free Tier (low cost)

Target: **one `t3.micro` EC2 instance** (750 hrs/mo free for 12 months, ~1 GB
RAM) running the full stack via Docker Compose, with **your company LLM key**
for the AI service (no third-party LLM bill). Postgres + Valkey run
**in-container** (not RDS/ElastiCache) to stay $0.

> This reuses the existing `docker-compose.yml`. No Kubernetes, no ECS — just
> one VM with Docker, the same pattern as `DEPLOY-VM.md`.

---

## 1. Launch EC2 (Free Tier)

- AMI: Ubuntu 24.04 LTS (free tier eligible)
- Instance: **t3.micro** (1 vCPU, 1 GB) — *must* be t3.micro/t2.micro for free
- Storage: gp3 **30 GB** (free tier covers 30 GB SSD)
- Security Group — inbound:
  - `22/tcp` (SSH) — your IP only
  - `80/tcp` + `443/tcp` — `0.0.0.0/0` (for Caddy/TLS + Let's Encrypt)
  - `3000/4000` — optional, only if you skip Caddy and expose directly
- Key pair: create one, save the `.pem`
- **User data**: paste `aws/user-data.sh` (auto-installs Docker + boots stack)

> t3.micro has 1 GB RAM. The Python `ai-service` + `ingestion` + `simulator`
> add pressure. On free tier, **comment those three services** in
> `docker-compose.yml` unless you accept swapping. The web + api + postgres +
> valkey fit comfortably.

## 2. DNS

Create an A-record `dtfm.your-domain.com → <EC2 public IP>`.

## 3. Configure env

SSH in (`ssh -i key.pem ubuntu@<public-ip>`):

```bash
cd /opt/digital-twin
nano .env
```

Required (fill all — compose uses `${VAR:?}` guards):
`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_ACCESS_SECRET` (32+ chars),
`JWT_REFRESH_SECRET` (32+ chars), `MVP_ADMIN_PASSWORD`.
Set: `NODE_ENV=production`, `NEXT_PUBLIC_API_URL=https://dtfm.your-domain.com/api`,
`CORS_ORIGIN=https://dtfm.your-domain.com`.
AI: put **your company key** in `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` /
`LITELLM_*`. `AI_SERVICE_URL` is already `http://ai:8000` inside compose.

## 4. Build + run

```bash
docker compose build
docker compose up -d
docker compose run --rm db-migrate   # apply migrations (TimescaleDB-coupled
                                     # migration now no-ops on plain PG)
docker compose ps                    # all Up / healthy
```

## 5. TLS reverse proxy (Caddy)

Uncomment the `caddy:` block in `docker-compose.yml` and ensure `Caddyfile`
exists at repo root (provided). Then:

```bash
docker compose up -d caddy
```

Caddy auto-issues Let's Encrypt certs for `dtfm.your-domain.com`.

## 6. Health + smoke test

```bash
curl https://dtfm.your-domain.com/api/health   # {status:"ok"}
curl https://dtfm.your-domain.com/api/health   # web health (via Caddy)
```

Open `https://dtfm.your-domain.com` → Digital Twin → All Floors. Confirm
markers show pole + ground disc and the elevator rides inside its shaft.

## 7. Cost reality (free tier, 12 months)

| Item | Cost |
|---|---|
| EC2 t3.micro | $0 (750 hrs/mo free) |
| EBS 30 GB gp3 | $0 (30 GB free) |
| Postgres (container) | $0 |
| Valkey (container) | $0 |
| Caddy (container) | $0 |
| **Total** | **$0** for 12 months, then ~$8–10/mo |

After free tier expires: t3.micro on-demand ≈ $0.0104/hr (~$7.50/mo if 24/7) +
EBS ≈ $2.40/mo. To cut cost post-free-tier, switch to **t3a.micro Spot**
(~70% off) or a Lightsail $3.50/mo plan.

> Not free but cheap alternative: **Render free tier** works too, but its
> Postgres expires in 90 days and free web services sleep after 15 min idle
> (cold start). AWS EC2 free tier is the more reliable "always-on" free option.

## Notes / gaps

- `db-migrate` previously failed (`MODULE_NOT_FOUND`) because it reused the
  pruned `dtfm-api` image — fixed by `docker/db-migrate.Dockerfile`.
- `simulator` previously clobbered the `dtfm-api` image tag — fixed by giving
  it its own `dtfm-simulator` image.
- TimescaleDB `create_hypertable` is now guarded to no-op on plain Postgres,
  so migrations succeed on RDS/container Postgres (predictive still works,
  just without time-partitioning).
- No GitHub Actions auto-deploy is wired (the workflows in DEPLOYMENT.md are
  not implemented). This runbook is the manual equivalent.
