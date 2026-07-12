# Predictive Maintenance Implementation Plan

**Goal:** Add ML-free heuristic predictive maintenance — health scoring, anomaly detection, auto-work-order creation — across ai-service, api-gateway, and web frontend.

**Architecture:** Rule-based analytics engine in the ai-service (Python) analyzes sensor trends (vibration, temperature, power), computes health scores per asset, flags anomalies. Api-gateway proxies. Web frontend shows health dashboard + anomaly list + auto-WO.

**Tech Stack:** FastAPI, NestJS, Next.js, Recharts (charts)

---

## Tasks

### Task 1: Predictive router in ai-service

**Files:**
- Create: `apps/ai-service/app/routers/predictive.py`
- Modify: `apps/ai-service/app/main.py` (register router)

**Endpoints:**
- `GET /ai/predictive/health-scores` — all assets health scores
- `GET /ai/predictive/health-scores/{assetId}` — single asset detail with trend data
- `GET /ai/predictive/anomalies` — active anomalies

**Health scoring logic:**
- Fetch last 100 readings per sensor per asset
- Compute moving average slope for vibration, temperature, power
- Score = 100 - (weighted penalty based on trend severity)
- Vibration rising → bearing wear penalty (−0–30)
- Temperature rising → overheating penalty (−0–25)
- Power spikes → inefficiency penalty (−0–20)
- Anomaly when score drops >10 points in 5 minutes

### Task 2: Predictive proxy in api-gateway

**Files:**
- Create: `apps/api-gateway/src/predictive/predictive.module.ts`
- Create: `apps/api-gateway/src/predictive/predictive.controller.ts`
- Modify: `apps/api-gateway/src/app.module.ts`

**Endpoints:**
- `GET /predictive/health-scores`
- `GET /predictive/health-scores/:assetId`
- `GET /predictive/anomalies`

### Task 3: Predictive maintenance frontend page

**Files:**
- Create: `apps/web/src/app/dashboard/predictive/page.tsx`
- Create: `apps/web/src/features/predictive/health-score-card.tsx`
- Create: `apps/web/src/features/predictive/anomaly-list.tsx`
- Create: `apps/web/src/features/predictive/predictive-context.tsx`

**Components:**
- HealthScoreCard — asset name, score (0-100), color bar, trend arrow
- AnomalyList — table of anomalies: asset, sensor, value, severity, timestamp
- Main page — grid of health cards + anomaly list below

**Sidebar:** Add `/dashboard/predictive` link
