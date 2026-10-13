"""Smoke tests for the P1 FAQ bot.

No Docker, no API keys required: DB and provider calls are mocked at the
module boundary, so we exercise the real request path (auth -> validation ->
prompt -> response shape) deterministically.
"""
import os

# Must be set before app.config.Settings is first read (lifespan checks it).
os.environ.setdefault("API_KEY", "test-key-123")

import pytest
from fastapi.testclient import TestClient

from app import db, main, providers
from app.prompts import SYSTEM_PROMPT, build_context, build_user_prompt
from ingest import split_sections

KEY = {"X-API-Key": "test-key-123"}


@pytest.fixture()
def client():
    # Lifespan runs init_schema(), which fails gracefully without a DB.
    with TestClient(main.app) as c:
        yield c


# ---------------------------------------------------------------- endpoints

def test_health_shape(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in ("ok", "degraded")
    assert isinstance(body["db"], bool)


def test_ask_rejects_missing_key(client):
    r = client.post("/ask", json={"question": "What is shipping cost?"})
    assert r.status_code == 401


def test_ask_rejects_wrong_key(client):
    r = client.post("/ask", json={"question": "What is shipping cost?"},
                    headers={"X-API-Key": "nope"})
    assert r.status_code == 401


def test_ask_rejects_oversized_question(client):
    r = client.post("/ask", json={"question": "x" * 501}, headers=KEY)
    assert r.status_code == 422


def test_ask_rejects_tiny_question(client):
    r = client.post("/ask", json={"question": "a"}, headers=KEY)
    assert r.status_code == 422


def test_ask_happy_path_with_fakes(client, monkeypatch):
    fake_chunks = [
        {"id": 1, "doc_id": "faqs", "section": "Shipping",
         "content": "Standard delivery costs EUR 4.90 and takes 3-5 days.",
         "score": 0.81},
        {"id": 2, "doc_id": "faqs", "section": "Returns",
         "content": "Returns are allowed within 30 days.",
         "score": 0.64},
    ]
    monkeypatch.setattr(providers, "embed", lambda texts: _fake_embed(texts))
    monkeypatch.setattr(db, "search", lambda vec, k=None: _fake_search(fake_chunks))
    monkeypatch.setattr(providers, "chat", lambda msgs, system: _fake_chat(msgs, system))

    r = client.post("/ask", json={"question": "How much is shipping?"},
                    headers=KEY)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "EUR 4.90" in body["answer"]
    assert len(body["sources"]) == 2
    assert body["sources"][0]["doc_id"] == "faqs"
    assert 0 <= body["sources"][0]["score"] <= 1
    assert body["model"]


async def _fake_embed(texts):
    return [[0.1] * 8 for _ in texts]


async def _fake_search(chunks):
    return chunks


async def _fake_chat(msgs, system):
    # The model must see the grounded context and the citation instruction.
    ctx = msgs[-1]["content"]
    assert "<context>" in ctx and "EUR 4.90" in ctx
    assert "cite" in system.lower()
    return "Shipping costs EUR 4.90 [1] and returns work within 30 days [2]."


# ---------------------------------------------------------------- prompts

def test_system_prompt_has_injection_defense():
    assert "not instructions" in SYSTEM_PROMPT
    assert "don't know" in SYSTEM_PROMPT.lower()
    assert "cite" in SYSTEM_PROMPT.lower()


def test_empty_context_forces_decline_path():
    prompt = build_user_prompt("anything?", [])
    assert "no documents matched" in prompt


def test_context_numbers_sources():
    chunks = [{"doc_id": "d", "section": "S", "content": "body", "score": 1}]
    ctx = build_context(chunks)
    assert ctx.startswith("<context>")
    assert "[1] d :: S" in ctx


# ---------------------------------------------------------------- chunking

def test_split_sections_on_headings():
    md = (
        "# Title\n\nintro text here\n\n"
        "## One\n\n" + ("body one with plenty of detail " * 3) + "\n\n"
        "## Two\n\n" + ("body two with plenty of detail " * 3) + "\n"
    )
    sections = split_sections(md)
    titles = [t for t, _ in sections]
    assert "One" in titles and "Two" in titles


def test_split_sections_drops_boilerplate():
    md = "# T\n\n## \n\nshort\n\n## Real\n\n" + ("long body " * 20)
    sections = split_sections(md)
    assert all(len(body) > 40 for _, body in sections)
