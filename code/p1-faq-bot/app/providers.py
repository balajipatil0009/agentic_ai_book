"""Provider-agnostic LLM layer.

Two functions — `embed()` and `chat()` — and the rest of the app never thinks
about vendors again. Every call is plain HTTP via httpx: no vendor SDK, no
lock-in. Swap providers with env vars in .env.

Providers:
  chat:        openai | anthropic | ollama
  embeddings:  openai | voyage | ollama
"""
import httpx

from .config import get_settings

TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class ProviderError(RuntimeError):
    """Raised when an upstream LLM/embedding provider call fails."""


def _require(key: str, provider: str, env_var: str) -> str:
    if not key:
        raise ProviderError(
            f"{provider} selected but {env_var} is not set. "
            f"Add it to .env or switch provider."
        )
    return key


async def embed(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns one vector per input string."""
    if not texts:
        return []
    s = get_settings()
    provider = s.embeddings_provider.lower()

    if provider == "openai":
        key = _require(s.openai_api_key, "openai", "OPENAI_API_KEY")
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": s.embeddings_model, "input": texts},
            )
        if r.status_code != 200:
            raise ProviderError(f"openai embeddings {r.status_code}: {r.text[:300]}")
        data = sorted(r.json()["data"], key=lambda d: d["index"])
        return [d["embedding"] for d in data]

    if provider == "voyage":
        key = _require(s.voyage_api_key, "voyage", "VOYAGE_API_KEY")
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(
                "https://api.voyageai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": s.embeddings_model, "input": texts, "input_type": "document"},
            )
        if r.status_code != 200:
            raise ProviderError(f"voyage embeddings {r.status_code}: {r.text[:300]}")
        data = sorted(r.json()["data"], key=lambda d: d["index"])
        return [d["embedding"] for d in data]

    if provider == "ollama":
        base = s.ollama_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            r = await client.post(
                f"{base}/api/embed",
                json={"model": s.embeddings_model, "input": texts},
            )
        if r.status_code != 200:
            raise ProviderError(f"ollama embeddings {r.status_code}: {r.text[:300]}")
        return r.json()["embeddings"]

    raise ProviderError(f"Unknown embeddings provider: {provider}")


async def chat(messages: list[dict], system: str) -> str:
    """Run one non-streaming chat completion. `messages` are user/assistant turns."""
    s = get_settings()
    provider = s.chat_provider.lower()

    if provider == "openai":
        key = _require(s.openai_api_key, "openai", "OPENAI_API_KEY")
        payload_messages = [{"role": "system", "content": system}] + messages
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": s.chat_model,
                    "messages": payload_messages,
                    "temperature": s.temperature,
                },
            )
        if r.status_code != 200:
            raise ProviderError(f"openai chat {r.status_code}: {r.text[:300]}")
        return r.json()["choices"][0]["message"]["content"]

    if provider == "anthropic":
        key = _require(s.anthropic_api_key, "anthropic", "ANTHROPIC_API_KEY")
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
                json={
                    "model": s.chat_model,
                    "max_tokens": 1024,
                    "system": system,
                    "messages": messages,
                    "temperature": s.temperature,
                },
            )
        if r.status_code != 200:
            raise ProviderError(f"anthropic chat {r.status_code}: {r.text[:300]}")
        return r.json()["content"][0]["text"]

    if provider == "ollama":
        base = s.ollama_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            r = await client.post(
                f"{base}/api/chat",
                json={
                    "model": s.chat_model,
                    "messages": [{"role": "system", "content": system}] + messages,
                    "stream": False,
                    "options": {"temperature": s.temperature},
                },
            )
        if r.status_code != 200:
            raise ProviderError(f"ollama chat {r.status_code}: {r.text[:300]}")
        return r.json()["message"]["content"]

    raise ProviderError(f"Unknown chat provider: {provider}")
