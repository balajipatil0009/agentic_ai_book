"""The product itself: a tiny FastAPI app with two endpoints.

GET  /health  — liveness + DB status (no auth, for load balancers)
POST /ask     — the money endpoint: embed -> search -> generate -> cite

Run:  uvicorn app.main:app --reload
"""
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import db, providers
from .config import get_settings
from .prompts import SYSTEM_PROMPT, build_messages


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if not settings.api_key or settings.api_key == "change-me-to-a-long-random-string":
        raise RuntimeError(
            "API_KEY is not set. Copy .env.example to .env and set a long random API_KEY."
        )
    # Schema is idempotent; if the DB is down we still boot (health shows db:false)
    # so operators can see the service is up but degraded.
    try:
        await db.init_schema()
    except Exception as exc:  # pragma: no cover - boot-time resilience
        print(f"[warn] database unavailable at boot: {exc}")
    yield
    await db.close()


app = FastAPI(title="P1 FAQ Bot", version="0.1.0", lifespan=lifespan)


async def require_api_key(x_api_key: str = Header(default="")) -> None:
    # Constant-time comparison: a naive == leaks key prefix via timing.
    if not secrets.compare_digest(x_api_key, get_settings().api_key):
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    k: int = Field(default=4, ge=1, le=10)


class Source(BaseModel):
    doc_id: str
    section: str
    score: float
    snippet: str


class AskResponse(BaseModel):
    answer: str
    sources: list[Source]
    model: str


@app.get("/health")
async def health() -> dict:
    db_ok = await db.healthy()
    return {"status": "ok" if db_ok else "degraded", "db": db_ok}


@app.post("/ask", response_model=AskResponse, dependencies=[Depends(require_api_key)])
async def ask(req: AskRequest) -> AskResponse:
    settings = get_settings()

    # 1. Retrieve. The question is data for SQL, never SQL syntax — asyncpg
    #    parameterizes this ($1/$2), which is our injection defense.
    try:
        question_vec = (await embed_query(req.question))[0]
        chunks = await db.search(question_vec, req.k)
    except providers.ProviderError as exc:
        raise HTTPException(status_code=502, detail=f"embedding provider failed: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"retrieval unavailable: {exc}")

    # 2. Generate with grounded context + citations.
    try:
        answer = await providers.chat(
            build_messages(req.question, chunks),
            system=SYSTEM_PROMPT,
        )
    except providers.ProviderError as exc:
        raise HTTPException(status_code=502, detail=f"chat provider failed: {exc}")

    sources = [
        Source(
            doc_id=c["doc_id"],
            section=c["section"],
            score=round(float(c["score"]), 4),
            snippet=c["content"][:200],
        )
        for c in chunks
    ]
    return AskResponse(answer=answer, sources=sources, model=settings.chat_model)


async def embed_query(text: str) -> list[list[float]]:
    return await providers.embed([text])
