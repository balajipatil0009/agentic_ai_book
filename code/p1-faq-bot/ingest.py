"""Ingestion: markdown file -> chunks -> embeddings -> pgvector.

Run:  python ingest.py [path/to/file.md]

Chapter 1 chunking is deliberately naive (split on `## ` headings). P3
replaces this with production strategies — this function's signature is what
P3 will upgrade behind.
"""
import asyncio
import sys
from pathlib import Path

from app import db, providers
from app.config import get_settings

SECTION_MAX_CHARS = 1200  # keep each chunk well inside any context window


def split_sections(markdown: str) -> list[tuple[str, str]]:
    """Split a markdown doc on level-2 headings. Returns [(section, text)]."""
    sections: list[tuple[str, str]] = []
    current_title, current_lines = "intro", []

    for line in markdown.splitlines():
        if line.startswith("## "):
            if current_lines:
                sections.append((current_title, "\n".join(current_lines).strip()))
            current_title, current_lines = line[3:].strip(), []
        else:
            current_lines.append(line)

    if current_lines:
        sections.append((current_title, "\n".join(current_lines).strip()))

    # Drop sections that are empty or only front-matter boilerplate.
    return [(t, body) for t, body in sections if len(body) > 40]


def split_long(section: str, text: str) -> list[str]:
    """Naive fixed-size splitter for oversized sections (P3 upgrades this)."""
    if len(text) <= SECTION_MAX_CHARS:
        return [text]
    pieces, buf = [], ""
    for para in text.split("\n\n"):
        if len(buf) + len(para) + 2 > SECTION_MAX_CHARS and buf:
            pieces.append(buf.strip())
            buf = para
        else:
            buf = f"{buf}\n\n{para}" if buf else para
    if buf.strip():
        pieces.append(buf.strip())
    return pieces


async def ingest(path: Path) -> None:
    settings = get_settings()
    doc_id = path.stem

    sections = split_sections(path.read_text(encoding="utf-8"))
    if not sections:
        raise SystemExit(f"No '## ' sections found in {path}")

    rows: list[tuple[str, str, list[float]]] = []
    for title, body in sections:
        for piece in split_long(title, body):
            rows.append((title, piece, []))  # embedding filled below

    # Embed in batches — never send a whole book in one API call.
    batch_size = 32
    vectors: list[list[float]] = []
    for i in range(0, len(rows), batch_size):
        batch_texts = [r[1] for r in rows[i : i + batch_size]]
        vectors.extend(await providers.embed(batch_texts))
        print(f"  embedded {min(i + batch_size, len(rows))}/{len(rows)} chunks")

    rows = [(title, body, vec) for (title, body, _), vec in zip(rows, vectors)]

    # Sanity check: pgvector column has a FIXED dimension.
    if any(len(r[2]) != settings.embedding_dim for r in rows):
        raise SystemExit(
            f"Embedding dimension mismatch: expected {settings.embedding_dim}. "
            f"Check EMBEDDING_DIM in .env matches EMBEDDINGS_MODEL."
        )

    await db.init_schema()
    count = await db.replace_document(doc_id, rows)
    print(f"Ingested '{doc_id}': {count} chunks ({len(sections)} sections) into pgvector.")


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/faqs.md")
    asyncio.run(ingest(target))
