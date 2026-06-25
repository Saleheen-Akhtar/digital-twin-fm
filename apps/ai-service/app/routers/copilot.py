"""
Copilot router — queries LiteLLM for AI-powered facility answers.

Architecture:
  frontend (/dashboard/copilot)
    → Next.js proxy (/api/proxy/ai/copilot/query)
    → api-gateway (POST /ai/copilot/query — CopilotController)
    → ai-service (POST /ai/copilot/query — this router)
    → LiteLLM → LLM provider (DeepSeek via OpenCode Zen)

The frontend sends the user's question plus a building context snapshot.
This router builds a system prompt with the snapshot data, calls LiteLLM,
and streams/returns the answer back up the chain.
"""

from pydantic import BaseModel, Field
from fastapi import APIRouter
import litellm
from litellm import acompletion

from ..config import get_settings

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


@router.post("/copilot/query", response_model=CopilotQueryResponse)
async def query(req: CopilotQueryRequest) -> CopilotQueryResponse:
    settings = get_settings()

    # Build the system prompt — include building context if we have it
    system_prompt = (
        "You are a knowledgeable facility management AI assistant for Digital Twin FM. "
        "You help facility managers understand their building health, assets, "
        "sensors, alerts, and work orders. Answer concisely and accurately "
        "based on the context provided.\n\n"
    )
    if req.context:
        system_prompt += f"Building context snapshot:\n{req.context}\n\n"
    system_prompt += (
        "If you don't know the answer or the context doesn't contain enough "
        "information, say so rather than making up data."
    )

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
            max_tokens=4096,
        )

        answer = response.choices[0].message.content or ""
        model_used = response.model

    except Exception as e:
        # Fallback: if LiteLLM call fails, return a descriptive error
        # so the frontend shows something useful instead of crashing
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
