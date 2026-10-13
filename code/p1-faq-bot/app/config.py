"""Central configuration — every knob of the app in one typed place.

Reads from environment variables and an optional .env file. This is the ONLY
file that knows which providers and models we use; everything else imports
`settings` from here.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Database ---
    database_url: str = "postgresql://postgres:postgres@localhost:5432/faqbot"

    # --- Auth ---
    api_key: str = ""

    # --- Chat (generation) ---
    chat_provider: str = "openai"  # openai | anthropic | ollama
    chat_model: str = "gpt-4o-mini"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"

    # --- Embeddings ---
    embeddings_provider: str = "openai"  # openai | voyage | ollama
    embeddings_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536
    voyage_api_key: str = ""

    # --- Retrieval / generation behaviour ---
    top_k: int = 4
    temperature: float = 0.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
