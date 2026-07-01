# ── base: Python slim ──────────────────────────────────────────
FROM python:3.12-slim AS base

# ── deps: install requirements ─────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY apps/ai-service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ── runner: minimal production image ───────────────────────────
FROM deps AS runner
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PORT=8000

# Copy only the app source (no pytest, caches, or dev artifacts)
COPY apps/ai-service/app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
