"""All PostgreSQL/pgvector access lives here.

One table (`chunks`), four operations (init, replace-a-document, semantic
search, health). The rest of the app talks to these functions — nobody else
writes SQL.
"""
import json

import asyncpg

from .config import get_settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=get_settings().database_url,
            min_size=1,
            max_size=5,
            command_timeout=30,
        )
    return _pool


async def close() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def init_schema() -> None:
    """Create the extension and table. Idempotent — safe to run every boot."""
    dim = get_settings().embedding_dim
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        await conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS chunks (
                id        BIGSERIAL PRIMARY KEY,
                doc_id    TEXT NOT NULL,
                section   TEXT NOT NULL DEFAULT '',
                content   TEXT NOT NULL,
                embedding VECTOR({dim}) NOT NULL
            );
            """
        )
        # HNSW gives us millisecond search at millions of rows; at FAQ scale
        # Postgres would seq-scan anyway, but we index from day one so scale
        # never forces a migration.
        await conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_chunks_embedding
            ON chunks USING hnsw (embedding vector_cosine_ops);
            """
        )


async def replace_document(doc_id: str, rows: list[tuple[str, str, list[float]]]) -> int:
    """Idempotent ingest: drop the doc's old chunks, insert the new ones.

    rows: list of (section, content, embedding)
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM chunks WHERE doc_id = $1;", doc_id)
            await conn.executemany(
                """
                INSERT INTO chunks (doc_id, section, content, embedding)
                VALUES ($1, $2, $3, $4::vector);
                """,
                [
                    (doc_id, section, content, json.dumps(embedding))
                    for section, content, embedding in rows
                ],
            )
    return len(rows)


async def search(query_embedding: list[float], k: int | None = None) -> list[dict]:
    """Semantic search: k nearest chunks by cosine distance.

    `<=>` is pgvector's cosine-distance operator. Lower is closer, so we
    convert to a 0..1 similarity score for humans.
    """
    k = k or get_settings().top_k
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, doc_id, section, content,
                   1 - (embedding <=> $1::vector) AS score
            FROM chunks
            ORDER BY embedding <=> $1::vector
            LIMIT $2;
            """,
            json.dumps(query_embedding),
            k,
        )
    return [dict(r) for r in rows]


async def healthy() -> bool:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1;")
        return True
    except Exception:
        return False
