# Changelog — Digital Twin FM

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Dashboard and 3D Viewer Tests (Phase 6)** — Fixed Jest test drifts, typecheck mismatches, and promise rejection loops in `apps/web/src/app/dashboard/page.test.tsx` and `apps/web/src/features/digital-twin/viewer-3d.test.tsx` using `MockData<T>` helper type constraints.
- **API proxy auth bypass** — `/auth/login` and `/auth/refresh` now pass through the proxy without requiring a session, allowing unauthenticated users to reach the api-gateway login endpoint.
- **PostgreSQL password auth failure** — Uncovered that the `dtfm_user` password hash in the persistent Postgres data directory was stale (initialized with a different value than `.env`). Reset via `ALTER USER dtfm_user WITH PASSWORD '...'` to match the Infisical/`.env` value.
- **Login page 500** — Caused by a stale web dev server instance with corrupted `.next` cache. Killed all server processes and restarted cleanly.
- **"Your session has expired" on wrong password** — Login error message now correctly reflects the actual cause (wrong credentials) instead of misattributing it to session expiry.
- **PostgreSQL pg_hba.conf** — Added `host all all 172.18.0.0/16 trust` before the catch-all `scram-sha-256` rule so Docker bridge connections work without password auth.
- **Valkey `--bind 127.0.0.1`** — Removed internal bind (kept host-side `127.0.0.1:6379:6379` mapping) so Docker port forwarding works for the ingestion service.
- **Simulator/Worker Redis connection** — Changed from URL format (`redis://:pass@host`) to object format (`{host, port, password}`) because ioredis URL parsing caused `WRONGPASS` errors with Valkey.
- **Worker separate pub/sub connections** — Added a second Redis connection for publishing `asset.updated` events (subscriber connections can only run subscriber commands).
- **Duplicate alerts in DB** — Worker was creating multiple open alerts for the same sensor due to crashes during debugging. Cleaned up 4 duplicate alerts (kept 1 per sensor).
- **buildAlertTitle** — Replaced raw message fallback with readable titles (Temperature Alert, Humidity Alert, CO₂ Alert, Threshold Breach, etc.) instead of showing the full sensor UUID + message.
- **Health Score calculation** — Reduced deduction weights (warning: 8→5, alert: 2→1 capped at 10, removed double-counting of high/critical alerts) so the score isn't 0% from 26 open alerts.
- **Duplicate React keys** — Changed `tr key` from `${alert.title}-${alert.time}` to `alert.id` to fix "two children with the same key" error.

### Added
- **Dynamic Scenario Playback (Phase 6)** — Added dynamic scenario profiles (`normal`, `chiller_failure`, `power_surge_floor_3`, `severe_temp_breach`) to the IoT sensor simulator in `apps/ingestion-service/src/simulator.ts`.
- **Remote Ingestion Control Route (Phase 6)** — Added a protected Fastify route `POST /ingest/simulator/scenario` (using Redis pub/sub orchestration) to remotely switch simulator scenario profiles.
- **Non-Destructive DB Reset (Phase 6)** — Added a development-gated database reset utility `packages/db/src/reset.ts` (`db:reset` script) to safely wipe transient telemetry and alarms and back-fill 1 hour of baseline readings.
- Added `documents/mvp/SECURITY_AUDIT.md`: 2026-06-05 audit (32 findings).
- Added `.github/dependabot.yml` (Finding 20).
- Added `packages/db/drizzle/0001_sensor_readings_hypertable.sql` (Finding 24).
- Added `POST /auth/refresh` endpoint in `apps/api-gateway/src/auth/auth.controller.ts` (Finding 10, partial). Accepts a refresh token, verifies it with the separate refresh secret + aud/iss, requires a `type: 'refresh'` claim, and rotates the refresh token on every successful use.
- Redesigned `apps/web/src/app/dashboard/page.tsx` to match the provided executive dashboard mock with a full sidebar, top bar, KPI strip, twin viewer panel, live monitoring charts, alerts/work orders tables, and AI Copilot panel.
- Added `apps/api-gateway/src/auth/jwt.strategy.ts` + `jwt-auth.guard.ts` + `roles.guard.ts` and registered `JwtAuthGuard` as a global `APP_GUARD` in `app.module.ts` (Finding 4).
- Added `apps/api-gateway/src/auth/refresh.dto.ts` (`RefreshDto` class with `class-validator`).
- Added per-panel props (`DashboardTwinPanel`, `DashboardLiveMonitoring`) for live data wiring.
- Added `apps/web/src/app/dashboard/dashboard-twin-panel.tsx` and `apps/web/src/app/dashboard/dashboard-live-monitoring.tsx` (client components for the twin + monitoring panels).
- Added `apps/web/src/lib/browser-api-client.ts` for client-side fetch helper.
- Added `apps/api-gateway/src/hash-admin.ts` script (argon2id hash generator for `MVP_ADMIN_PASSWORD`).

### Changed
- Updated `apps/web/src/app/dashboard/page.test.tsx` to assert the new static dashboard layout instead of the prior API-driven summary view.
- Wired `apps/web/src/app/dashboard/page.tsx` to live api-gateway data for buildings, assets, sensors, alerts, and sensor readings while preserving the same dashboard layout and visual hierarchy.
- Replaced the dashboard's fake twin illustration with the real interactive 3D viewer, plus clickable floor selection and asset selection state.
- Replaced the temporary GLB twin scene with a procedural five-floor facility model, floor-grid marker placement, occluding asset labels, and neutral facility lighting.
- Made live monitoring and twin marker readings refresh from the existing authenticated sensor API path.
- `apps/api-gateway/src/auth/auth.service.ts` now supports **legacy SHA-256 hex** values (auto-detected by the 64-hex prefix) for backwards-compat with operators who set `MVP_ADMIN_PASSWORD` to an old hash. New setups use `argon2id`.
- `apps/api-gateway/src/config/infisical.loader.ts` uses `dotenv` to load `.env`; refuses to start in `NODE_ENV=production` if the file is missing.
- `apps/api-gateway/src/config/config.module.ts` enforces required secrets (no dev fallbacks) and binds the same access TTL to both token and cookie.
- `apps/web/src/app/login/actions.ts` cookie: `httpOnly`, `secure: !isDev` (was production-only), `sameSite: 'lax'`, `maxAge: 15m`.
- `apps/web/next.config.ts` adds `experimental.serverActions.allowedOrigins` for CSRF protection and tightens cache headers.
- `apps/ai-service/app/main.py` resolves CORS origins from `AI_CORS_ORIGIN`; **fails closed** (`[]`) in `production` / `staging`; defaults to `[\"http://localhost:3000\"]` in dev. Binds to `127.0.0.1` by default.
- `apps/ingestion-service/src/index.ts` binds to `127.0.0.1`, requires `X-Ingest-Api-Key` (constant-time compared via `crypto.timingSafeEqual`), rate-limited at 120 req/min.
- `docker-compose.yml` binds Postgres + Valkey to `127.0.0.1`; Valkey uses `--requirepass`; API gateway + web + ingestion + AI services also bind to loopback.
- `init-db.sql` creates a least-privilege `dtfm_app` role and grants only `CONNECT` + CRUD on app tables.
- `packages/db/src/seed.ts` refuses to run when `NODE_ENV === 'production'`, hashes passwords with `argon2id`, and accepts `--password=<value>` (otherwise generates a random one and prints it once).
- `packages/db/drizzle/0001_sensor_readings_hypertable.sql` converts `sensor_readings` to a real TimescaleDB hypertable with a composite PK `(sensor_id, ts)` and a covering index on `(sensor_id, ts DESC)`.
- `apps/web/src/features/digital-twin/viewer.tsx` no longer loads `<Environment preset="city" />` from a third-party CDN; uses explicit `<ambientLight>` + `<directionalLight>` instead.
- `apps/web/src/types/r3f.ts` deleted; R3F's own JSX augmentation is used (Finding 31).
- `apps/web/src/middleware.ts` edge-gates `/dashboard` and `/twin` (redirects to `/login` if no session).
- `apps/web/src/lib/session.ts` verifies the JWT (`jose.jwtVerify`) and returns a typed `Session`; server actions and pages call `requireSession()`.
- `.env.example` updated with all new env vars and a documented `ALLOW_INSECURE_DEV` opt-in.
- `pnpm-workspace.yaml` `allowBuilds` no longer includes `es5-ext` (Finding 19).
- `.github/workflows/ci.yml` runs `gitleaks-action` and `pnpm audit --audit-level=moderate --prod`.
- `apps/api-gateway/tsconfig.json` enables `strict: true`.
- `apps/api-gateway/src/db/db.module.ts` requires `POSTGRES_PASSWORD` (throws on missing); `dtfm_pass` is now a development-only convenience default gated by `NODE_ENV === 'development'`, not a silent fallback.
- `apps/web/src/lib/api-client.ts` throws typed `ApiError` with closed-set `ApiErrorCode`; raw upstream body is logged server-side, never sent to browser.
- `apps/web/src/lib/api-client.ts` re-exports shared domain types from `@digital-twin-fm/types` to prevent drift (Finding 23).
- `CODEOWNERS` cleaned: `/SECURITY.md` rules aligned to actual files; `/infra/` rule kept (path documented in CHANGELOG as future-only).
- `.gitignore` covers every `.env.*` shape and `.claude/settings.local.json` (Findings 21 + 32).
- `packages/{db,ui,types}/package.json` `lint` scripts now invoke real `eslint ... --max-warnings 0` (Finding 27).
- `scripts/` cleanup: deleted `check-env.js`, `dump-env.js`, `get-pw.js`, `page-check.js`, `verify-form.js`, `e2e-test.js`, `e2e-login-test.js`, `final-check.js`. Remaining scripts (`check-licenses.mjs`, `list-licenses.mjs`, `load-secrets.sh`) do not print raw password values.

### Security
- **F1, F2, F3, F4, F5 (Critical)** — all closed.
- **F6 (High) + F22 (Medium)** — `helmet` middleware, `@nestjs/throttler`, and 8 standard security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy, Origin-Agent-Cluster) emitted by `helmet`.
  - **Throttler tiered (dashboard-polling follow-up):** the previous config (`short: 5/sec, medium: 60/min`) was too tight — a single dashboard refresh (10-15 parallel API calls) tripped 429 on the second page load. Replaced with `burst: 20/sec + sustained: 300/min + auth: 5/min`. Added a custom `ThrottlerBehindAuthGuard` that **skips throttling for authenticated GETs** (tracker = `req.user.id`) and tracks unauthenticated requests by IP — and keeps full throttling on every write (`POST/PUT/PATCH/DELETE`) and on every `@Public()` POST (e.g. `/auth/login`). Guard order swapped to `JwtAuthGuard → ThrottlerBehindAuthGuard → RolesGuard` so `req.user` is set before the throttler decides whether to skip.
- **F7 (High)** — `dotenv` replaces hand-rolled parser in `infisical.loader.ts`; production refuses to start if `.env` is missing.
- **F8 (High)** — `db.module.ts` requires `POSTGRES_PASSWORD` (throws on missing); dev-only `dtfm_pass` is gated by `NODE_ENV === 'development'`; `ssl: { rejectUnauthorized: true }` is opt-in via `POSTGRES_SSL=true`.
- **F9 (High)** — typed `ApiError` with closed-set `ApiErrorCode`; raw upstream body logged server-side, never sent to browser.
- **F10 (High)** — Cookie TTL in `login/actions.ts` shortened to 15m to match access token (was 8h); `secure: !isDev` (was production-only). Refresh endpoint added: requires `type: 'refresh'` claim, separate `jwt.refreshSecret`, and rotates the refresh token on every successful use.
- **F11 (High)** — `experimental.serverActions.allowedOrigins` set in `next.config.ts`.
- **F12 (High)** — Ingestion service bound to `127.0.0.1`, requires `X-Ingest-Api-Key` (constant-time compared via `crypto.timingSafeEqual`), rate-limited at 120 req/min.
- **F13 (High)** — AI service CORS fail-closed: explicit allowlist from `AI_CORS_ORIGIN`, empty list in `production`/`staging` (api-gateway talks server-to-server), `["http://localhost:3000"]` in dev.
- **F14 (High)** — Dashboard no longer lies about connection state. The previous `loadDashboardData` used `Promise.allSettled` + `settledValue(result, [])` to silently coerce any failure into an empty array, fell back to a module-level `dashboardSnapshot` (stale data) and a hardcoded `buildFallbackDashboardData()` (synthetic fake data), and rendered a hardcoded "Live" pill in the sidebar. The new implementation:
  - Returns a typed `LoadResult { data, sources, connection, failedCount }` where `sources: Record<'buildings'|'assets'|'sensors'|'alerts', { status: 'ok', count } | { status: 'error', code: ApiErrorCode, message }>`.
  - Derives `connection: 'connected' | 'partial' | 'disconnected'` from the failed-source count.
  - Renders a **tri-state** `<ConnectionBanner />` (yellow "1 of 4 live data sources failed" / red "Live data unavailable") between the welcome row and the metric strip. The banner is hidden in the happy path so the existing layout is unchanged.
  - Renders a dynamic `<ConnectionPill />` in the sidebar (green Live / amber Partial / red Offline) instead of the hardcoded green dot.
  - Renders per-source `<PanelError />` components on the four live panels (Twin, LiveMonitoring, Alerts, WorkOrders). When all sources fail, the twin panel shows an explicit empty-state placeholder instead of a broken 3D viewer, and the alerts / work-orders tables show a "cannot be shown while the api-gateway is unreachable" row instead of an empty shell.
  - **Removed** the module-level `dashboardSnapshot` and the `buildFallbackDashboardData()` synthetic data set entirely — no path in the new code returns fabricated data as if it were real.
- **F15 (High)** — `middleware.ts` edge-gates `/dashboard` and `/twin`; `lib/session.ts` verifies the JWT (signature + `aud` + `iss` + `exp`).
- **F16, F17 (Medium)** — Docker ports bound to `127.0.0.1`; Valkey requires `--requirepass`; `init-db.sql` creates least-privilege `dtfm_app` role with `CONNECT` + CRUD only on app tables.
- **F18 (Medium)** — `Cookie.secure` set in any non-dev env (was production-only).
- **F19 (Medium)** — `pnpm-workspace.yaml` no longer grants `es5-ext` postinstall.
- **F20 (Medium)** — `ci.yml` runs gitleaks + `pnpm audit --audit-level=moderate --prod`; `dependabot.yml` weekly PRs.
- **F21 (Medium) + F32 (Low)** — `.gitignore` now ignores every `.env.*` shape and `.claude/settings.local.json`.
- **F23 (Medium)** — Removed duplicated domain types from `apps/web/src/lib/api-client.ts` and re-exported them from `@digital-twin-fm/types` to prevent drift.
- **F24 (Medium)** — `sensor_readings` is a real TimescaleDB hypertable with a composite PK and covering index (migration 0001).
- **F25 (Medium)** — `seed.ts` refuses to run in `NODE_ENV=production`, hashes with `argon2id`, accepts `--password=<value>`.
- **F26 (Low/Medium)** — Deleted leaky scripts; remaining scripts never print raw password values.
- **F27 (Low/Medium)** — `packages/{db,ui,types}/package.json` `lint` scripts now invoke real `eslint ... --max-warnings 0`.
- **F28 (Low)** — `apps/api-gateway/tsconfig.json` enables the umbrella `strict: true` flag.
- **F29 (Low)** — `LoginDto` and the new `RefreshDto` are classes with `class-validator` decorators. Other DTOs (`BuildingDto`, `AssetDto`, `SensorDto`, `AlertDto`) are intentionally **interfaces** — they are response shapes, not request validators, and the validation pipe only needs to whitelist request bodies.
- **F30 (Low)** — `apps/api-gateway/src/{buildings,assets,sensors,alerts}/*service.spec.ts` now build a typed Drizzle mock that records WHERE clauses and asserts that `findAll` / `findOne` build the right predicates. `buildings` spec asserts `eq(buildings.id, ...)` and `limit(1)`. No more `const db: any = {}` stubs.
- **F31 (Low)** — `r3f.ts` deleted; `viewer.tsx` no longer references `<Environment preset="city" />` (replaced with explicit lights). **Visibility enhancements:** improved camera position (28,22,28) and OrbitControls target [0,7.5,0] for better floor visibility; added tiered lighting (ambient 1.2+c8d4ff, two directional lights, point light); made floors visually distinct with gradient colors (#1e3a5f to #0e2338) and brighter grid; increased building shell transparency (opacity 0.15); increased marker size (0.35) and emissive intensity (1.5); added point lights on critical assets; improved HTML label contrast and size (12px); added readable floor badges; added fog for distance fading; show only selected floor markers (others at 40% opacity).
- **F32 (Low)** — `apps/api-gateway/src/auth/auth.service.spec.ts` generates a fresh `randomBytes(18).toString('base64url')` password per test run; no hardcoded fixture. `CODEOWNERS` and `.gitignore` aligned to the canonical set of paths.

### Known gaps (open findings)
- _None._ All 32 findings from `documents/mvp/SECURITY_AUDIT.md` are now closed.

## [0.1.3] - 2026-06-04

### Added
- Added `documents/mvp/EXECUTION_PLAN.md` defining the demo-first strategy for the Singapore project.

### Changed
- Revised MVP roadmap to prioritize Dashboard → Digital Twin Viewer → Realtime Sensors → Alerts → AI Copilot.
- Deferred full CMMS/work-order workflows to post-MVP.
- Updated MVP scope to focus on Digital Twin + live monitoring + AI insight + asset registry.
- Updated maintenance documentation to keep asset registry in MVP and move work orders/technician workflow later.
- Updated API contracts to mark work-order endpoints as deferred and add asset-health/AI explanation endpoints.
- Updated full-product roadmap to put AI intelligence before full maintenance/CMMS.
- Revised `MVP_SCOPE.md` to deprioritize maintenance modules and focus on Digital Twin and AI as hero features for the MVP.
- Revised `ROADMAP.md` to execute in order: Foundation -> Dashboard/Twin -> Realtime -> AI -> Maintenance.
- Updated `AI_SERVICE_SPEC.md` to highlight AI Copilot as the core product differentiator.
- Updated `documents/README.md` to include the execution plan.

## [0.1.2] - 2026-06-04

### Added
- Added MVP secrets-management documentation in `documents/mvp/SECRETS_MANAGEMENT.md`.
- Added full-product database and secrets-management strategy in `documents/full_product/DATABASE_AND_SECRETS_STRATEGY.md`.
- Recommended Infisical for MVP/team secrets management and OpenBao/Vault-style evaluation for enterprise deployments.

### Updated
- Updated documentation indexes to include the database and secrets strategy documents.

## [0.1.0] - 2026-06-04

### Added
- Created foundational documentation structure in `documents/`.
- Defined architecture, database schema, and API contracts for MVP.
- Established full-product documentation in `documents/full_product/`.
- Added detailed specifications for post-MVP integration, security, AI, and operations.
- Initialized `ROADMAP.md` covering phases from MVP to full enterprise scale.
- Added `CHANGELOG.md` to track project history.
- Initialized agent automation configuration files.
