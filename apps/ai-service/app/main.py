"""
Digital Twin FM — AI service main entrypoint.

Endpoints:
  GET  /health                      liveness
  POST /ai/copilot/query            (stub) chat over facility data
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import health, copilot

settings = get_settings()


def _resolve_cors_origins() -> list[str]:
    """Resolve the CORS allowlist from the AI_CORS_ORIGIN env var.

    Per Finding 13 (High): the previous implementation used `["*"]` with
    `allow_credentials=True` (which is CORS-invalid but accepted by some
    clients) and only narrowed to `["http://localhost:3000"]` if an
    OpenAI key happened to be set — a quirky and undocumented coupling.

    The new behavior:
      - If `AI_CORS_ORIGIN` is set, parse it as a comma-separated list.
      - If unset in production/staging → fail closed (empty list = no
        browser access; the api-gateway is the only legitimate caller
        and uses server-to-server HTTP, not the browser).
      - If unset in development → default to `["http://localhost:3000"]`.
      - Never combine `*` with `allow_credentials=True`.
    """
    raw = (os.getenv("AI_CORS_ORIGIN") or "").strip()
    if raw:
        origins = [o.strip() for o in raw.split(",") if o.strip()]
        if not origins:
            raise ValueError("AI_CORS_ORIGIN parsed to an empty list.")
        return origins

    env = (os.getenv("NODE_ENV") or "development").lower()
    if env in ("production", "staging"):
        # Fail closed: only the api-gateway should call this service in
        # production, and it doesn't go through the browser. An empty
        # list makes the browser reject all cross-origin requests.
        return []
    return ["http://localhost:3000"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: warm up vector store, LLM client, etc.
    yield
    # Shutdown: close clients cleanly


app = FastAPI(
    title="Digital Twin FM — AI Service",
    version="0.1.0",
    description="RAG, anomaly explanation, and predictive maintenance. MIT-licensed.",
    lifespan=lifespan,
)

# CORS — explicit allowlist, never wildcard with credentials.
# Per Finding 13 (High).
app.add_middleware(
    CORSMiddleware,
    allow_origins=_resolve_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=600,
)

app.include_router(health.router, tags=["health"])
app.include_router(copilot.router, prefix="/ai", tags=["copilot"])


if __name__ == "__main__":
    import uvicorn
    # Per Finding 13: bind to 127.0.0.1 by default. The api-gateway
    # reaches this service over the Docker network / a private VPC.
    host = os.getenv("AI_HOST") or "127.0.0.1"
    uvicorn.run("app.main:app", host=host, port=settings.port, reload=True)
