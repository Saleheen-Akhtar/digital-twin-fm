"""
Copilot router — MVP stub.

In production this would:
  1. Embed the user's question
  2. Retrieve relevant docs (building, asset, sensor, work order history) from
     the vector store + the api-gateway
  3. Send a prompt to LiteLLM with citations
  4. Return answer + sources

For MVP we return a stub so the frontend can wire the UI.
"""
from pydantic import BaseModel, Field
from fastapi import APIRouter

router = APIRouter()


class CopilotQueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    building_id: str | None = None
    context: dict | None = None  # optional extra context (current asset, etc.)


class CopilotQueryResponse(BaseModel):
    answer: str
    sources: list[dict] = []
    model: str
    stub: bool = True


@router.post("/copilot/query", response_model=CopilotQueryResponse)
async def query(req: CopilotQueryRequest) -> CopilotQueryResponse:
    return CopilotQueryResponse(
        answer=(
            f"[MVP stub] I received your question: \"{req.question}\". "
            "RAG over building/asset documents will be wired in week 4."
        ),
        sources=[],
        model="stub",
        stub=True,
    )
