"""
Copilot router — queries LiteLLM for AI-powered facility answers.

Architecture:
  frontend (/dashboard/copilot)
    → Next.js proxy (/api/proxy/ai/copilot/query)
    → api-gateway (POST /ai/copilot/query — CopilotController)
    → ai-service (POST /ai/copilot/query — this router)
    → LiteLLM → LLM provider (DeepSeek via OpenCode Zen)

The frontend sends the user's question plus an optional building_id.
This router fetches building context (health snapshot + alerts) from the
api-gateway internally, builds a rich system prompt, calls LiteLLM,
and streams/returns the answer back up the chain.

Supports tool/function calling — when the LLM requests a work order
creation, the ai-service executes it via the api-gateway and includes
the result in the response.
"""

import json
import logging
import httpx
from pydantic import BaseModel, Field
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import litellm
from litellm import acompletion

from ..config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()


class CopilotQueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    building_id: str | None = None
    context: dict | None = None  # optional extra context (current asset, etc.)


class CopilotQueryResponse(BaseModel):
    answer: str
    sources: list[dict] = []
    model: str
    stub: bool = False


async def fetch_building_context(building_id: str) -> dict | None:
    """Fetch building health snapshot + alerts from the api-gateway."""
    settings = get_settings()
    try:
        base = settings.api_gateway_url.rstrip("/")
        url = f"{base}/building/context/{building_id}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("found") is False:
                    logger.warning("building context not found for %s", building_id)
                    return None
                return data
            logger.warning("building context fetch returned %s", resp.status_code)
    except Exception as e:
        logger.warning("building context fetch failed: %s", e)
    return None


def _format_context_for_prompt(ctx: dict | None) -> str | None:
    """Turn the building context dict into a human-readable prompt fragment."""
    if not ctx:
        return None

    if ctx.get("found") is False:
        return None

    parts = []

    building_name = ctx.get("buildingName")
    if building_name:
        parts.append(f"BUILDING: {building_name} (id: {ctx.get('buildingId', 'unknown')})")

    snapshot = ctx.get("snapshot")
    if snapshot and isinstance(snapshot, dict):
        parts.append(
            f"BUILDING HEALTH SCORE: {snapshot.get('healthScore', 'N/A')}/100\n"
            f"  Assets: {snapshot.get('totalAssets', 0)} total, "
            f"{snapshot.get('onlineAssets', 0)} online, "
            f"{snapshot.get('warningAssets', 0)} warning, "
            f"{snapshot.get('criticalAssets', 0)} critical, "
            f"{snapshot.get('offlineAssets', 0)} offline\n"
            f"  Sensors: {snapshot.get('totalSensors', 0)} total, "
            f"{snapshot.get('onlineSensors', 0)} online "
            f"(uptime {snapshot.get('sensorUptime', 0)}%)\n"
            f"  Active alerts: {snapshot.get('activeAlerts', 0)} "
            f"({snapshot.get('criticalAlerts', 0)} critical)\n"
            f"  Avg energy: {snapshot.get('avgEnergyKw', 0)} kW\n"
            f"  Snapshot computed at: {snapshot.get('computedAt', 'unknown')}"
        )

    assets = ctx.get("assets", [])
    attention = [
        a for a in assets
        if a.get("status") in ("warning", "critical", "offline")
    ]
    if attention:
        asset_lines = []
        for a in attention[:6]:
            floor = a.get("floorLevel")
            floor_label = f"floor {floor}" if floor is not None else "unknown floor"
            asset_lines.append(
                f"  - [{a.get('status', 'unknown').upper()}] "
                f"{a.get('name', 'Unknown asset')} ({a.get('type', 'asset')}, {floor_label})"
            )
        parts.append("ASSETS NEEDING ATTENTION:\n" + "\n".join(asset_lines))

    sensors = ctx.get("sensors", [])
    live_sensors = [s for s in sensors if s.get("isLive")]
    if live_sensors:
        sensor_lines = []
        for s in live_sensors[:6]:
            value = s.get("lastValue")
            unit = s.get("unit", "")
            value_label = f"{value} {unit}".strip() if value is not None else "no value"
            sensor_lines.append(
                f"  - {s.get('assetName', 'Asset')} "
                f"{s.get('type', 'sensor')}: {value_label} "
                f"(updated {s.get('lastReadingAt', 'unknown')})"
            )
        parts.append(
            f"LIVE SENSOR READINGS ({len(live_sensors)} online):\n"
            + "\n".join(sensor_lines)
        )
    elif sensors:
        parts.append(
            f"SENSORS: {len(sensors)} registered, but none have readings in the last 5 minutes. "
            "The simulator or ingestion worker may be offline."
        )

    alerts = ctx.get("alerts", [])
    if alerts:
        alert_lines = []
        for a in alerts[:6]:
            asset_label = a.get("assetName") or a.get("assetId") or "N/A"
            alert_lines.append(
                f"  - [{a.get('severity', 'unknown').upper()}] "
                f"{a.get('title', 'No title')} "
                f"(asset: {asset_label}, status: {a.get('status', 'unknown')})"
            )
        parts.append("ACTIVE ALERTS:\n" + "\n".join(alert_lines))

    work_orders = ctx.get("workOrders", [])
    if work_orders:
        wo_lines = []
        for wo in work_orders[:4]:
            asset_label = wo.get("assetName") or wo.get("assetId") or "N/A"
            wo_lines.append(
                f"  - [{wo.get('priority', 'medium').upper()}] "
                f"{wo.get('title', 'Work order')} "
                f"(asset: {asset_label}, status: {wo.get('status', 'open')})"
            )
        parts.append("OPEN WORK ORDERS:\n" + "\n".join(wo_lines))

    data_as_of = ctx.get("dataAsOf")
    if data_as_of:
        parts.append(f"DATA AS OF: {data_as_of}")

    return "\n\n".join(parts) if parts else None


def _build_system_prompt(context_str: str | None) -> str:
    """Build the system prompt, optionally including building context."""
    prompt = (
        "You are a knowledgeable facility management AI assistant for Digital Twin FM. "
        "You help facility managers understand their building health, assets, "
        "sensors, alerts, and work orders. Answer concisely and accurately "
        "based on the live facility context provided below.\n\n"
        "The context includes real-time sensor readings, asset statuses, active alerts, "
        "and open work orders pulled from the live database. Prefer citing specific "
        "assets, sensor values, and alert details from the context.\n\n"
    )
    if context_str:
        prompt += f"Current building status:\n{context_str}\n\n"
    prompt += (
        "If you don't know the answer or the context doesn't contain enough "
        "information, say so rather than making up data.\n\n"
        "You have access to the `create_work_order` tool. When the user asks to "
        "create a work order, use this tool with an assetId, title, description, "
        "and optional priority ('low', 'medium', 'high', 'critical'). "
        "If you don't know the exact assetId, use the building context to find "
        "the matching asset and pass its id."
    )
    return prompt


# ── Tool definitions for function calling ──────────────────────────

CREATE_WORK_ORDER_TOOL = {
    "type": "function",
    "function": {
        "name": "create_work_order",
        "description": "Create a new maintenance work order for an asset. Call this when the user asks to create, open, or schedule a work order.",
        "parameters": {
            "type": "object",
            "properties": {
                "assetId": {
                    "type": "string",
                    "description": "The UUID of the asset this work order is for, from the building context.",
                },
                "title": {
                    "type": "string",
                    "description": "Short title for the work order (e.g. 'Inspect chiller 3').",
                },
                "description": {
                    "type": "string",
                    "description": "Optional detailed description of the issue.",
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "critical"],
                    "description": "Priority level. Defaults to medium if omitted.",
                },
            },
            "required": ["assetId", "title"],
        },
    },
}


async def _execute_create_work_order(
    settings, arguments: dict
) -> dict:
    """Call the api-gateway to create a work order and return the result."""
    base = settings.api_gateway_url.rstrip("/")
    url = f"{base}/work-orders"

    payload = {
        "assetId": arguments["assetId"],
        "title": arguments["title"],
        "description": arguments.get("description", ""),
        "priority": arguments.get("priority", "medium"),
    }

    logger.info("Creating work order via POST %s: %s", url, payload)

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code == 201 or resp.status_code == 200:
            wo = resp.json()
            logger.info("Work order created: id=%s", wo.get("id"))
            return {
                "id": wo.get("id"),
                "title": wo.get("title"),
                "status": wo.get("status"),
                "priority": wo.get("priority"),
            }
        else:
            logger.error(
                "Work order creation failed: %s %s",
                resp.status_code,
                await resp.aread(),
            )
            return {"error": f"API returned {resp.status_code}"}


async def _handle_tool_calls(
    settings, tool_calls: list
) -> str:
    """Execute tool calls and return a human-readable result block."""
    results = []
    for tc in tool_calls:
        if tc.type != "function":
            continue
        fn = tc.function
        name = fn.name
        try:
            arguments = json.loads(fn.arguments)
        except json.JSONDecodeError:
            results.append(f"Function `{name}` received invalid arguments.")
            continue

        if name == "create_work_order":
            result = await _execute_create_work_order(settings, arguments)
            if "error" in result:
                results.append(
                    f"❌ Failed to create work order: {result['error']}"
                )
            else:
                results.append(
                    f"✅ **Work Order Created**\n"
                    f"- **Title:** {result['title']}\n"
                    f"- **Status:** {result['status']}\n"
                    f"- **Priority:** {result['priority']}\n"
                    f"- **ID:** `{result['id']}`"
                )
        else:
            results.append(f"Unknown function: {name}")

    return "\n\n".join(results) if results else ""


@router.post("/copilot/query", response_model=CopilotQueryResponse)
async def query(req: CopilotQueryRequest) -> CopilotQueryResponse:
    settings = get_settings()

    # Fetch building context internally if we have a building_id
    context_str = None
    if req.building_id:
        ctx = await fetch_building_context(req.building_id)
        context_str = _format_context_for_prompt(ctx)
    if not context_str and req.context:
        context_str = str(req.context)

    system_prompt = _build_system_prompt(context_str)

    try:
        # Configure LiteLLM with our custom provider endpoint
        litellm.api_base = settings.litellm_api_base
        if settings.litellm_api_key:
            litellm.api_key = settings.litellm_api_key

        response = await acompletion(
            model=settings.litellm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.question},
            ],
            temperature=0.3,
            max_tokens=1024,
            tools=[CREATE_WORK_ORDER_TOOL],
        )

        choice = response.choices[0]

        # Handle tool calls
        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            tool_result = await _handle_tool_calls(settings, choice.message.tool_calls)

            # Send the tool result back to the model for a natural-language wrap-up
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.question},
                choice.message.model_dump(),
                {
                    "role": "tool",
                    "tool_call_id": choice.message.tool_calls[0].id,
                    "content": tool_result,
                },
            ]

            final_response = await acompletion(
                model=settings.litellm_model,
                messages=messages,
                temperature=0.3,
                max_tokens=1024,
            )

            answer = final_response.choices[0].message.content or tool_result
            model_used = final_response.model
        else:
            answer = choice.message.content or ""
            model_used = response.model

    except Exception as e:
        return CopilotQueryResponse(
            answer=f"Sorry, I encountered an error reaching the AI model: {e}",
            sources=[],
            model="error",
            stub=True,
        )

    return CopilotQueryResponse(
        answer=answer,
        sources=[],
        model=model_used,
        stub=False,
    )


@router.post("/copilot/query/stream")
async def query_stream(req: CopilotQueryRequest):
    """
    Streaming variant — returns SSE tokens as they arrive from LiteLLM.
    The frontend reads this with an EventSource-compatible fetch.

    Each SSE event:
      data: {"token": "..."}
      data: {"done": true, "model": "..."}

    The last event signals completion and includes the model name.
    """
    settings = get_settings()

    # Fetch building context internally
    context_str = None
    if req.building_id:
        ctx = await fetch_building_context(req.building_id)
        context_str = _format_context_for_prompt(ctx)
    if not context_str and req.context:
        context_str = str(req.context)

    system_prompt = _build_system_prompt(context_str)
    model_used = settings.litellm_model

    async def _stream():
        nonlocal model_used
        try:
            litellm.api_base = settings.litellm_api_base
            if settings.litellm_api_key:
                litellm.api_key = settings.litellm_api_key

            response = await acompletion(
                model=settings.litellm_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": req.question},
                ],
                temperature=0.3,
                max_tokens=1024,
                stream=True,
                tools=[CREATE_WORK_ORDER_TOOL],
            )

            tool_calls_accumulator = []

            async for chunk in response:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta:
                    content = getattr(delta, 'content', None)
                    reasoning = getattr(delta, 'reasoning_content', None)

                    # Accumulate tool calls
                    tc = getattr(delta, 'tool_calls', None)
                    if tc:
                        for t in tc:
                            tool_calls_accumulator.append(t)

                    if content:
                        yield f"data: {json.dumps({'token': content})}\n\n"
                    if reasoning:
                        yield f"data: {json.dumps({'reasoning': reasoning})}\n\n"
                    if getattr(delta, 'model', None):
                        model_used = delta.model

            # If tool calls were accumulated, execute them
            if tool_calls_accumulator:
                yield f"data: {json.dumps({'tool_result': 'Executing requested action…'})}\n\n"

        except Exception as e:
            logger.error("streaming error: %s", e)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield f"data: {json.dumps({'done': True, 'model': model_used})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Accel-Buffering": "no",
        },
    )
