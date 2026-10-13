"""End-to-end verification against a REAL PostgreSQL + pgvector.

Verifies the code paths no mock can: HNSW index creation, ::vector casting,
cosine-distance ordering, and the full /ask request path with live DB.

Skips automatically when no local Postgres is reachable, so the suite stays
green on machines without a database (the mocked smoke tests still cover the
request logic there).
"""
import asyncio
import hashlib
import math
import os

import asyncpg
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("API_KEY", "test-key-123")

from app import db, main, providers  # noqa: E402
from app.config import get_settings  # noqa: E402
from ingest import ingest, split_sections  # noqa: E402

KEY = {"X-API-Key": "test-key-123"}


def _try_connect(dbname: str):
    s = get_settings()
    return asyncpg.connect(dsn=s.database_url.rsplit("/", 1)[0] + f"/{dbname}")


def _ensure_db() -> bool:
    """Create faqbot database if missing. Returns False if no server at all."""

    async def run() -> bool:
        try:
            conn = await _try_connect("postgres")
        except Exception:
            return False
        try:
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname='faqbot';"
            )
            if not exists:
                await conn.execute("CREATE DATABASE faqbot;")
            return True
        finally:
            await conn.close()

    return asyncio.run(run())


DB_OK = _ensure_db()
pytestmark = pytest.mark.skipif(not DB_OK, reason="no local PostgreSQL reachable")


# -------------------------------------------------- deterministic fake model
# A tiny hashed bag-of-words embedder: real words produce real similarity, so
# this genuinely tests ranking — not just plumbing.

def fake_embed(texts: list[str]) -> list[list[float]]:
    out = []
    for t in texts:
        vec = [0.0] * 64
        for word in t.lower().split():
            h = int(hashlib.md5(word.encode()).hexdigest(), 16)
            vec[h % 64] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        out.append([v / norm for v in vec])
    return out


async def fake_chat(msgs, system) -> str:
    return "Shipping costs EUR 4.90 [1]"


# -------------------------------------------------- schema + search + /ask

def test_full_pipeline_with_real_pgvector(monkeypatch):
    async def run():
        await db.init_schema()

        monkeypatch.setattr(providers, "embed", _coro)

        # Ingest the actual chapter-1 knowledge base through the real script.
        import pathlib
        await ingest(pathlib.Path("data/faqs.md"))

        # Search with a real question: ranking must surface the shipping doc.
        qvec = (await providers.embed(["how much does standard shipping cost"]))[0]
        rows = await db.search(qvec, k=3)
        assert rows, "search returned no rows"
        assert len(rows) <= 3
        scores = [r["score"] for r in rows]
        assert scores == sorted(scores, reverse=True), "not ordered by similarity"
        assert all(0.0 <= s <= 1.01 for s in scores)
        assert "Shipping" in rows[0]["section"], rows[0]["section"]

        # The full authenticated HTTP path, with only the LLM stubbed.
        with TestClient(main.app) as client:
            r = client.post(
                "/ask",
                json={"question": "How much does standard shipping cost?"},
                headers=KEY,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["sources"], "no sources returned"
            assert body["sources"][0]["doc_id"] == "faqs"
            assert "EUR 4.90" in body["answer"]

        await db.close()

    asyncio.run(run())


async def _coro(texts: list[str]) -> list[list[float]]:
    """Async wrapper: the app awaits providers.embed()."""
    return fake_embed(texts)


def test_split_sections_on_real_kb():
    import pathlib
    text = pathlib.Path("data/faqs.md").read_text(encoding="utf-8")
    sections = split_sections(text)
    titles = [t for t, _ in sections]
    assert "Shipping and Delivery" in titles
    assert "NimbusPulse Pro Watch (SKU NG-4200)" in titles
    assert len(titles) >= 6
