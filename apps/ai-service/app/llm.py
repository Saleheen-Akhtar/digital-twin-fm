"""LiteLLM client — connects to OpenCode Zen (or any LiteLLM provider)."""

import logging
from typing import Any

from litellm import acompletion, RateLimitError

from .config import get_settings

logger = logging.getLogger(__name__)

# How long to wait for an LLM response before failing gracefully.
REQUEST_TIMEOUT_SEC = 30

# OpenCode Zen API base URL (OpenAI-compatible)
OPENCODE_ZEN_BASE_URL = "https://opencode.ai/zen/v1"


async def ask_llm(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> str:
    """Send a prompt to the LLM and return the text response.

    Uses LiteLLM under the hood — swap the provider by changing
    ``litellm_model`` in the settings / .env file.
    """
    settings = get_settings()

    kwargs: dict[str, Any] = {
        "model": settings.litellm_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "timeout": REQUEST_TIMEOUT_SEC,
    }

    # OpenCode Zen uses custom_openai provider — pass api_base + api_key
    if settings.opencode_zen_api_key:
        kwargs["api_key"] = settings.opencode_zen_api_key
        kwargs["api_base"] = OPENCODE_ZEN_BASE_URL
    else:
        logger.warning("OPENCODE_ZEN_API_KEY is not set — LLM calls will fail")

    try:
        response = await acompletion(**kwargs)
        text = response.choices[0].message.content or ""
        logger.info("LLM response received (model=%s, input_len=%d, output_len=%d)",
                     settings.litellm_model, len(user_prompt), len(text))
        return text
    except RateLimitError:
        logger.warning("LLM rate limited (model=%s)", settings.litellm_model)
        return _fallback_response(user_prompt, "rate_limited")
    except Exception as exc:
        logger.error("LLM call failed (model=%s): %s", settings.litellm_model, exc)
        return _fallback_response(user_prompt, "unavailable")


def _fallback_response(question: str, reason: str) -> str:
    """Return a graceful fallback when the LLM is unreachable."""
    if reason == "rate_limited":
        return (
            f"I received too many requests in a short time and couldn't process: "
            f"\"{question[:100]}{'...' if len(question) > 100 else ''}\". "
            "Please wait a moment and try again. The free-tier rate limit resets quickly."
        )
    return (
        f"I'm currently unable to connect to the AI provider to answer: "
        f"\"{question[:100]}{'...' if len(question) > 100 else ''}\". "
        "The service will be available once the LLM endpoint is reachable. "
        "Please check the API key / network connectivity."
    )
