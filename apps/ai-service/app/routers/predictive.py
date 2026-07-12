"""Predictive Maintenance router — heuristic health scoring & anomaly detection.

Architecture:
  frontend → api-gateway → ai-service (this router) → api-gateway (data access)

The router fetches sensor reading history from the api-gateway's public
sensor-data endpoint, computes trend-based health scores, and flags anomalies.
No ML model — uses rule-based heuristics suitable for the simulated demo.
"""

import logging
import statistics
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from httpx import AsyncClient
from pydantic import BaseModel
from typing import Any

from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai/predictive", tags=["predictive"])

# ── Response models ──────────────────────────────────────────────────


class HealthScore(BaseModel):
    assetId: str
    assetName: str
    assetType: str
    floorLevel: int | None = None
    score: int  # 0-100
    trend: str  # "rising" | "stable" | "declining" | "critical"
    topRisks: list[str] = []
    lastUpdated: str


class HealthScoresResponse(BaseModel):
    scores: list[HealthScore]
    generatedAt: str


class Anomaly(BaseModel):
    id: str
    assetId: str
    assetName: str
    sensorType: str
    value: float
    unit: str
    severity: str  # "low" | "medium" | "high"
    description: str
    detectedAt: str


class AnomaliesResponse(BaseModel):
    anomalies: list[Anomaly]
    total: int


class AssetTrendPoint(BaseModel):
    timestamp: str
    value: float


class AssetTrendDetail(BaseModel):
    sensorType: str
    unit: str
    values: list[AssetTrendPoint]
    baseline: float
    currentAvg: float
    slope: float  # trend per hour
    healthy: bool


class AssetHealthDetail(BaseModel):
    assetId: str
    assetName: str
    assetType: str
    floorLevel: int | None = None
    score: int
    trend: str
    topRisks: list[str]
    trends: list[AssetTrendDetail]
    lastUpdated: str


# ── Data fetching ────────────────────────────────────────────────────


async def _fetch_json(url: str) -> Any:
    """Helper to GET JSON from the api-gateway."""
    async with AsyncClient(timeout=15.0) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            logger.warning("fetch %s returned %s", url, resp.status_code)
            return None
        return resp.json()


async def _fetch_assets() -> list[dict] | None:
    """Fetch all assets from the api-gateway public endpoint."""
    settings = get_settings()
    base = settings.api_gateway_url.rstrip("/")
    return await _fetch_json(f"{base}/predictive/assets")


async def _fetch_sensor_readings(asset_id: str, hours: int = 2) -> list[dict] | None:
    """Fetch sensor readings for an asset from the api-gateway public endpoint."""
    settings = get_settings()
    base = settings.api_gateway_url.rstrip("/")
    return await _fetch_json(f"{base}/predictive/sensor-readings/{asset_id}?hours={hours}")


# ── Health scoring logic ─────────────────────────────────────────────


SENSOR_RISK_MAP: dict[str, tuple[str, int]] = {
    "vibration": ("Bearing wear / mechanical looseness", 30),
    "temperature": ("Overheating risk", 25),
    "power": ("Energy inefficiency / electrical fault", 20),
    "pressure": ("Pressure irregularity", 15),
    "flow": ("Flow rate anomaly", 10),
    "humidity": ("Humidity imbalance", 5),
}


def _compute_trend_slope(values: list[float]) -> float:
    """Simple linear regression slope. Positive = rising, negative = declining."""
    n = len(values)
    if n < 3:
        return 0.0
    xs = list(range(n))
    mean_x = statistics.mean(xs)
    mean_y = statistics.mean(values)
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, values))
    den = sum((x - mean_x) ** 2 for x in xs)
    return num / den if den != 0 else 0.0


def _compute_health_score(
    trends: dict[str, dict],
) -> tuple[int, str, list[str]]:
    """Compute a 0-100 health score from sensor trends.

    Penalises:
      - Rapid upward drift (vibration, temp, power, humidity)
      - Rapid downward drift (any sensor — overcooling, pressure loss, etc.)
      - Deviation from historical baseline
    """
    score = 100
    risks: list[str] = []
    instabilities: list[float] = []  # per-sensor severity for trend label

    for sensor_type, data in trends.items():
        values = data.get("values", [])
        if len(values) < 3:
            continue

        baseline = data.get("baseline", 0) or 1
        current_avg = statistics.mean(values[-5:]) if len(values) >= 5 else statistics.mean(values)
        slope = data.get("slope", 0)

        risk_label, max_penalty = SENSOR_RISK_MAP.get(sensor_type, ("Unknown risk", 10))

        # Normalised slope: fraction of baseline per hour
        rel_slope = slope / baseline

        # --- 1. Penalty from rapid POSITIVE trends (any sensor) ---
        if slope > 0 and rel_slope > 0.02:
            # 0.02 = 2%/h minimal, 0.25 = 25%/h full penalty
            severity = min(rel_slope / 0.25, 1.0)
            penalty = int(severity * max_penalty * 0.8)
            score -= penalty
            instabilities.append(severity * 1.5)

        # --- 2. Penalty from rapid NEGATIVE trends (any sensor) ---
        elif slope < 0 and abs(rel_slope) > 0.02:
            severity = min(abs(rel_slope) / 0.25, 1.0)
            penalty = int(severity * max_penalty * 0.6)
            score -= penalty
            instabilities.append(severity * 1.2)

        # --- 3. Deviation from baseline (>10%) ---
        deviation = abs(current_avg - baseline) / baseline
        if deviation > 0.10:
            dev_severity = min((deviation - 0.10) / 0.40, 1.0)
            dev_penalty = int(dev_severity * max_penalty * 0.5)
            score -= dev_penalty

        # --- 4. Risk descriptions ---
        if abs(rel_slope) > 0.05:
            direction = "surge" if slope > 0 else "drop"
            risks.append(
                f"{risk_label} ({abs(slope):.1f}/h {direction}, "
                f"{current_avg:.1f} vs baseline {baseline:.1f})"
            )
        elif deviation > 0.20:
            risks.append(
                f"{risk_label} — {current_avg:.1f} ({deviation*100:.0f}% off "
                f"{baseline:.1f} baseline)"
            )

    # Clamp
    score = max(0, min(100, score))

    # --- Trend classification based on weighted instability ---
    avg_inst = sum(instabilities) / max(len(instabilities), 1)

    if score < 30:
        trend = "critical"
    elif score < 55:
        trend = "declining" if avg_inst > 0.3 else "stable"
    elif avg_inst > 0.5:
        trend = "declining"
    else:
        trend = "stable"

    return score, trend, risks


# ── Endpoints ────────────────────────────────────────────────────────


@router.get("/health-scores", response_model=HealthScoresResponse)
async def get_health_scores():
    """Compute health scores for all assets."""
    assets = await _fetch_assets()
    if not assets:
        raise HTTPException(500, "Failed to fetch assets from api-gateway")

    scores: list[HealthScore] = []
    now = datetime.now(timezone.utc).isoformat()

    for asset in assets[:]:  # process all
        asset_id = asset["id"]
        readings = await _fetch_sensor_readings(asset_id)
        if not readings:
            # No data yet → healthy by default
            scores.append(HealthScore(
                assetId=asset_id,
                assetName=asset.get("name", "Unknown"),
                assetType=asset.get("type", "unknown"),
                floorLevel=asset.get("floorLevel"),
                score=85,
                trend="stable",
                topRisks=["Insufficient data"],
                lastUpdated=now,
            ))
            continue

        # Group readings by sensor type
        type_groups: dict[str, dict] = {}
        for r in readings:
            stype = r.get("type", "unknown")
            if stype not in type_groups:
                type_groups[stype] = {
                    "values": [],
                    "baseline": 0,
                    "slope": 0,
                }
            val = r.get("value")
            if val is not None:
                type_groups[stype]["values"].append(val)

        # Enrich with baseline and slope
        for stype, data in type_groups.items():
            vals = data["values"]
            if vals:
                data["baseline"] = statistics.mean(vals[:10]) if len(vals) >= 10 else statistics.mean(vals)
                data["slope"] = _compute_trend_slope(vals)
                data["currentAvg"] = statistics.mean(vals[-5:]) if len(vals) >= 5 else statistics.mean(vals)

        score_val, trend, risks = _compute_health_score(type_groups)

        scores.append(HealthScore(
            assetId=asset_id,
            assetName=asset.get("name", "Unknown"),
            assetType=asset.get("type", "unknown"),
            floorLevel=asset.get("floorLevel"),
            score=score_val,
            trend=trend,
            topRisks=risks[:3],
            lastUpdated=now,
        ))

    return HealthScoresResponse(scores=scores, generatedAt=now)


@router.get("/health-scores/{asset_id}", response_model=AssetHealthDetail)
async def get_asset_health_detail(asset_id: str):
    """Detailed health score with trend data for one asset."""
    assets = await _fetch_assets()
    if not assets:
        raise HTTPException(500, "Failed to fetch assets")
    asset = next((a for a in assets if a.get("id") == asset_id), None)
    if not asset:
        raise HTTPException(404, f"Asset {asset_id} not found")

    readings = await _fetch_sensor_readings(asset_id)
    if not readings:
        raise HTTPException(404, "No sensor readings found for this asset")

    # Group readings by sensor type
    type_groups: dict[str, dict] = {}
    for r in readings:
        stype = r.get("type", "unknown")
        if stype not in type_groups:
            type_groups[stype] = {"values": [], "baseline": 0, "slope": 0, "unit": r.get("unit", ""), "timestamps": []}
        val = r.get("value")
        ts = r.get("timestamp")
        if val is not None:
            type_groups[stype]["values"].append(val)
            if ts:
                type_groups[stype]["timestamps"].append(ts)

    trends_list: list[AssetTrendDetail] = []
    for stype, data in type_groups.items():
        vals = data["values"]
        if len(vals) < 3:
            continue
        baseline = statistics.mean(vals[:10]) if len(vals) >= 10 else statistics.mean(vals)
        slope = _compute_trend_slope(vals)
        cur_avg = statistics.mean(vals[-5:]) if len(vals) >= 5 else statistics.mean(vals)
        timestamps = data.get("timestamps", [])
        if not timestamps:
            timestamps = [""] * len(vals)

        # Store computed values back into type_groups for _compute_health_score
        data["baseline"] = baseline
        data["slope"] = slope
        data["currentAvg"] = cur_avg

        trends_list.append(AssetTrendDetail(
            sensorType=stype,
            unit=data.get("unit", ""),
            values=[AssetTrendPoint(timestamp=timestamps[i] if i < len(timestamps) else "", value=v)
                    for i, v in enumerate(vals)],
            baseline=baseline,
            currentAvg=cur_avg,
            slope=slope,
            healthy=abs(slope) < 0.5,
        ))

    score_val, trend, risks = _compute_health_score(type_groups)
    now = datetime.now(timezone.utc).isoformat()

    return AssetHealthDetail(
        assetId=asset_id,
        assetName=asset.get("name", "Unknown"),
        assetType=asset.get("type", "unknown"),
        floorLevel=asset.get("floorLevel"),
        score=score_val,
        trend=trend,
        topRisks=risks[:3],
        trends=trends_list,
        lastUpdated=now,
    )
