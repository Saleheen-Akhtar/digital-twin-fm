# AI Service Specification — Digital Twin FM

## Purpose

This document defines the full-product direction for the AI service. MVP AI may be simple, but the full product must be trustworthy, permission-scoped, evaluated, and useful for real facility operations.

## AI product goals

AI should help users:

- understand why an asset or zone is unhealthy,
- summarize incidents,
- suggest maintenance actions,
- answer questions from facility documents,
- identify anomaly patterns,
- predict likely equipment failures,
- optimize energy and operational performance.

AI must not become an unsafe autonomous operator. Human approval is required for critical operational actions.

## MVP AI scope

- `/health` endpoint.
- Basic copilot endpoint.
- Rule-based anomaly explanations.
- Provider-ready structure without deep ML dependency.

## Full AI capabilities

### Facility copilot

Capabilities:
- Ask questions about facility status.
- Ask questions about assets, alerts, and work orders.
- Ask questions over manuals/SOPs.
- Summarize recent incidents.
- Draft work order descriptions.

### RAG over facility documents

Document sources:
- maintenance manuals,
- SOPs,
- equipment datasheets,
- inspection reports,
- historical work orders,
- alert resolution notes,
- BIM/model metadata if useful.

Requirements:
- chunking strategy,
- embeddings pipeline,
- document metadata,
- permission filtering,
- citations in answers,
- re-indexing workflow.

### Root-cause analysis

Inputs:
- recent sensor readings,
- alert history,
- asset metadata,
- maintenance logs,
- related sensors/assets,
- operating context.

Outputs:
- likely causes,
- supporting evidence,
- confidence level,
- recommended next checks,
- suggested work order if appropriate.

### Predictive maintenance

Inputs:
- historical sensor readings,
- asset age/model,
- past maintenance,
- alert frequency,
- usage patterns.

Outputs:
- risk score,
- predicted failure category,
- suggested maintenance window,
- explanation and evidence.

Start with simple models and thresholds before advanced ML.

### Energy optimization

Capabilities:
- detect unusual energy usage,
- compare zones/buildings,
- identify after-hours consumption,
- suggest operational checks.

## AI architecture

Recommended service structure:

```text
apps/ai-service/app/
  api/
    copilot.py
    anomaly.py
    predictions.py
    documents.py
  core/
    config.py
    auth_context.py
    llm_provider.py
  rag/
    chunking.py
    embeddings.py
    retriever.py
    citations.py
  models/
    anomaly_detector.py
    maintenance_predictor.py
  evaluation/
    datasets.py
    metrics.py
  tests/
```

## Provider abstraction

Do not hardcode one model provider throughout the code.

Support abstraction for:
- OpenAI,
- Anthropic,
- local/open-source model,
- future provider.

The API should allow swapping provider/model through configuration.

## Security and permissions

AI must respect user permissions.

Rules:
- API gateway passes authenticated user context.
- AI service receives scoped data, not unrestricted database access by default.
- Retrieval must filter by organization/site/building permissions.
- AI must not expose secrets, environment variables, hidden prompts, or unauthorized data.
- AI suggestions for critical actions require human confirmation.

## Citations and trust

For document-based answers, AI should return citations:

```json
{
  "answer": "...",
  "citations": [
    { "documentId": "uuid", "title": "AHU Manual", "page": 12, "snippet": "..." }
  ]
}
```

For operational analysis, AI should return evidence:

```json
{
  "finding": "AHU-01 vibration is elevated",
  "evidence": [
    { "sensorId": "uuid", "metric": "vibration", "value": 7.2, "threshold": 5.0 }
  ]
}
```

## Evaluation

Before relying on AI in production, maintain evaluation sets:

- known incidents and expected explanations,
- document Q&A pairs,
- false-positive anomaly cases,
- unsafe prompt attempts,
- permission boundary tests.

Track:
- answer correctness,
- citation accuracy,
- hallucination rate,
- latency,
- cost,
- refusal behavior for unauthorized questions.

## Human approval requirements

AI may suggest:
- create work order,
- change priority,
- investigate asset,
- notify manager.

AI must not automatically:
- close alerts,
- complete work orders,
- disable sensors,
- change thresholds,
- change user permissions,
- modify production configuration.

## Observability

Track:
- request count,
- latency,
- model/provider used,
- token/cost estimate,
- error rate,
- rejected unauthorized requests,
- user feedback on answer usefulness.

## Acceptance criteria for full AI product

- AI answers are permission-scoped.
- RAG answers include citations.
- Critical actions require user confirmation.
- AI quality is measured with evaluation datasets.
- AI provider can be changed without rewriting business logic.
- AI latency/cost/errors are observable.
