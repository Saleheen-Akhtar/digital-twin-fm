"""
Digital Twin FM — AI service settings.
All values come from environment variables. No secrets in code.
"""
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[".env", "../.env"],
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Service
    service_name: str = "ai-service"
    port: int = 8000
    log_level: str = "info"

    # LLM Provider — abstracted via LiteLLM. Set one of these.
    # Examples: "gpt-4o-mini" (openai), "claude-3-5-sonnet-20240620" (anthropic),
    # "ollama/llama3.2" (local), "bedrock/anthropic.claude-3-sonnet-..."
    litellm_model: str = "openai/deepseek-v4-flash-free"

    # Custom API base for LiteLLM (OpenAI-compatible). Set when using a
    # proxy or self-hosted endpoint like OpenCode Zen, LiteLLM proxy, etc.
    litellm_api_base: str = "https://opencode.ai/zen/v1"
    litellm_api_key: str | None = Field(
        default=None,
        validation_alias="OPENCODE_ZEN_API_KEY",
    )

    # Internal
    api_gateway_url: str = "http://localhost:4000"

    # RAG (post-MVP)
    vector_store_path: str = "./.vector_store"


@lru_cache
def get_settings() -> Settings:
    return Settings()
