# Chapter 3 — Feeding the Brain: Universal Ingestion

> **Product built in this chapter:** the `/ingest` service — drop a PDF, a URL,
> or a CSV on the bot and its knowledge base grows. The hand-written `faqs.md`
> becomes just one of many sources; re-running ingestion costs nothing when
> nothing changed.
> **Concepts pulled in *because* the product demanded them:** multi-source
> extraction, the markdown intermediate, chunking strategies (fixed, recursive,
> semantic), metadata enrichment, SHA-256 content hashing / cache invalidation.
> **Security layer added:** SSRF defenses on URL ingestion, size/type caps,
> untrusted-document handling, per-source ACL stamping.

Same rhythm as Chapter 2 — every feature moves through one cycle:

> 🔁 **LEARN** the concept → **IMPLEMENT** it in small snippets → **TEST** it
> with a runnable request and a pass/fail signal.

---

## 3.1 Start with a failing test (the product pain)

Chapter 1 promised: *"In P3 this file gets replaced by real PDFs, websites and
tickets — the bot's code will not change."* Time to collect on it. The customer
sends what real customers send:

```
$ curl -F "source=@price-list-2026.pdf" localhost:8000/ingest
   → ❌ "unsupported source: expected data/faqs.md"

$ curl -X POST localhost:8000/ingest -d '{"url":"https://nimbusgadgets.example/support"}'
   → ❌ 404
```

Also hidden in this pain: **re-ingesting the edited FAQ today duplicates every
vector** (Chapter 1's `DELETE`+`INSERT` re-embeds 100% of the content, at full
price, every time). Two cycles fix ingestion properly — plus one for the money
problem:

| Cycle | Pain | Concept | Done when |
|---|---|---|---|
| 🔁 1 | only `.md` files work | multi-source extraction → markdown | PDF, URL, CSV all produce clean markdown |
| 🔁 2 | one giant section = one giant chunk | chunking strategies + metadata | chunk stats test passes |
| 🔁 3 | every re-ingest re-bills every token | SHA-256 dedup / invalidation | second run: `skipped (unchanged)` |

---

## 🔁 Cycle 1 — Multi-source extraction

### LEARN — markdown is the universal intermediate

Every source type (PDF, web page, CSV, SQL table, Notion export, old ticket
dump) gets converted **once**, into **clean markdown + metadata**. Everything
downstream — chunking, embedding, retrieval — only ever sees markdown. This
architecture line is the whole trick:

```
pdf ─┐                                                    ┌→ chunks → vectors
url ─┼→  extract()  →  markdown + metadata  →  chunk()  ──┤
csv ─┘   (this cycle)                  (Cycle 2)          └→ documents (hash, 3.3)
```

Why markdown? Tables become `|` grids, headings survive (`##` = structure from
Chapter 1's splitter), code stays fenced — it's the richest format that's still
plain text, and every embedding model eats it directly.

**Tool selection** (when to reach for what — you don't need all of these):

| Source | First choice | When to escalate |
|---|---|---|
| Text/Markdown | *nothing — it's already there* | — |
| PDF (digital) | **pypdf** (tiny) / **Docling** (better layout) | layout-critical → **Marker** or **LlamaParse** |
| PDF (scanned) / photos / charts | **Vision LLM** (GPT-4o / Claude Vision) as OCR | when tables/handwriting defeat classic OCR |
| Website (static) | `httpx` + html→text | JS-rendered → **Firecrawl** / **Playwright** |
| Website (scale/rotation) | **Apify** actors | beyond a few pages |
| CSV / JSON | stdlib `csv` / `json` | wide tables → LLM summarization per row-group |
| Messy anything | **Unstructured.io** | when you want one API for many types |

Two syllabus ideas live here and are *deferred, not skipped*: extractors
exposed as **MCP servers** (so agents can call "fetch this document" as a tool)
arrives in Chapter 6 with the rest of MCP; **delta sync** rides along with
Cycle 3's hashing.

### IMPLEMENT — one dispatcher, three extractors

`POST /ingest` accepts a file **or** a URL and returns the markdown it
produced. The dispatcher is the only new routing code in the whole service:

```python
# ingest/service.py
async def extract_file(path: Path) -> tuple[str, dict]:
    """File bytes -> (markdown, metadata), chosen by extension."""
    match path.suffix.lower():
        case ".md" | ".txt":
            return path.read_text(encoding="utf-8"), {}
        case ".pdf":
            return await pdf_to_markdown(path), {}          # pypdf or Docling
        case ".csv":
            return csv_to_markdown(path), {"kind": "table"}
        case _:
            raise HTTPException(415, f"unsupported type: {path.suffix}")

async def extract_url(url: str) -> tuple[str, dict]:
    await assert_safe_url(url)                              # SECURITY, see 3.4
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        r = await client.get(url, headers={"User-Agent": "faqbot/0.1"})
    html = r.text
    return html_to_markdown(html), {"source_url": str(r.url), "fetched_at": now_iso()}
```

CSV is three lines of real code — a reminder that "data extraction" is often
trivial once the output contract is markdown:

```python
def csv_to_markdown(path: Path) -> str:
    rows = list(csv.reader(path.open(encoding="utf-8")))
    head, *body = rows
    lines = ["| " + " | ".join(head) + " |", "| " + " | ".join("---" for _ in head) + " |"]
    return "\n".join(lines + ["| " + " | ".join(r) + " |" for r in body])
```

Both return **(markdown, metadata)** — metadata is not optional in a
production system: `source_url`, `fetched_at`, `author`, `tenant_id` all ride
into Cycle 2 and become filters in Chapter 4.

### TEST — three sources, one contract

```bash
curl -F "source=@data/faqs.md"        localhost:8000/ingest   # markdown passthrough
curl -F "source=@price-list-2026.pdf" localhost:8000/ingest   # PDF → markdown
curl -X POST localhost:8000/ingest -H 'Content-Type: application/json' \
     -d '{"url":"https://nimbusgadgets.example/support"}'      # web → markdown
```

**Pass criteria:**

1. All three return the **same JSON shape**: `{"doc_id", "markdown", "metadata",
   "chars"}` — same bytes in the pipeline regardless of origin.
2. The PDF's price table survives as a markdown grid (`| SKU | Price |` row
   present) — a table flattened to prose is a **failed** extraction, not a
   cosmetic one (Chapter 4's hybrid search depends on exact `NG-4200` strings).
3. The URL response's `metadata.source_url` is the **final** redirect target.

Unit test without network — the contract test pattern from Chapter 2:

```python
def test_csv_extractor_emits_valid_grid(tmp_path):
    f = tmp_path / "p.csv"; f.write_text("sku,price\nNG-4200,249.00\n")
    md, meta = csv_to_markdown(f), {}
    assert md.splitlines()[0] == "| sku | price |"
    assert "NG-4200" in md                              # exact code survives
```

✅ **Cycle 1 done** when all three curls match the contract and the table test passes.

---

## 🔁 Cycle 2 — Chunking strategies & metadata

### LEARN — the chunk is the unit of retrieval

Chapter 1 split on `## ` headings and called it a day. Real corpora break that:
a 12-page PDF section becomes one 40k-token chunk (dilutes similarity — one
vector has to mean *everything* in it), while a two-line FAQ is fine as-is.
The rule of thumb: **a chunk should fit one focused question.**

| Strategy | How | Trade-off |
|---|---|---|
| Fixed size | slice every N chars | dumb boundaries; splits sentences mid-word |
| **Recursive character** | split on `\n\n` → `\n` → `. ` → ` ` until under N | the sane default; honors paragraphs — **we implement this one** |
| Semantic | embed sentence windows; break where meaning shifts | costs an embedding run per document; boundaries are *meaning* boundaries |
| Agentic | LLM reads the doc and *decides* cuts | best quality, slowest, priciest — batch jobs only |

Also from the syllabus, and worth knowing before Chapter 4 implements them:

- **Parent Document Retrieval** — index *small* chunks (good matching), but
  hand the LLM their *parent* section at generation time (good context).
- **Contextual Retrieval / Late Chunking** — advanced techniques that stop
  chunks from losing their "where am I?" context; they go in Chapter 4's
  evaluation playground, where we can *measure* them against naive chunking.
- **Specialized handling:** tables stay as whole markdown grids (don't shred
  rows across chunks), code stays inside fences, headings inherit into chunk
  titles.

**Metadata enrichment** is not decoration: every chunk gets stamped at ingest —

```python
meta = {"source": doc.source, "tenant_id": doc.tenant, "acl": doc.acl_groups,
        "ingested_at": now_iso(), "sha256": doc.content_hash}
```

`tenant_id`/`acl` are exactly the "stamp chunks with business_phone_number for
tenant scoping" note from your syllabus — Chapter 4 turns them into row-level
security. `sha256` belongs to Cycle 3.

### IMPLEMENT — recursive chunker, ~20 lines

Replaces Chapter 1's `split_long()` — same call site, better brain:

```python
SEPARATORS = ["\n\n", "\n", ". ", " "]

def recursive_split(text: str, limit: int = 1200) -> list[str]:
    if len(text) <= limit:
        return [text]
    for sep in SEPARATORS:                     # coarsest boundary that exists
        if sep in text:
            out, buf = [], ""
            for p in text.split(sep):          # greedily re-join under the limit
                if buf and len(buf) + len(sep) + len(p) > limit:
                    out.append(buf); buf = p
                else:
                    buf = f"{buf}{sep}{p}" if buf else p
            if buf: out.append(buf)
            return [chunk for part in out          # recurse on oversized pieces
                      for chunk in recursive_split(part, limit)]
    return [text]                                   # unbreakable: hand it over whole
```

Termination is guaranteed: every recursive call is either strictly shorter or
moves to a finer separator. (Honest note: production chunkers add overlap
windows, sentence guards, and table detection — your test below is what keeps
a simple version honest.)

Metadata stamping happens where chunks are created:

```python
def chunk_document(md: str, meta: dict) -> list[dict]:
    return [{"content": piece, **meta}              # meta spreads onto every chunk
            for section, body in split_sections(md)
            for piece in recursive_split(body)]
```

### TEST — statistics, not vibes

```python
def test_recursive_chunker_invariants():
    md = Path("data/faqs.md").read_text()
    chunks = chunk_document(md, {"tenant_id": "nimbus"})
    assert all(len(c["content"]) <= 1400 for c in chunks)        # respects limit
    assert all(c["tenant_id"] == "nimbus" for c in chunks)       # metadata stamped
    assert all(not c["content"].strip().endswith(("warrant", "shipp"))  # no mid-word cuts
               for c in chunks)
    joined = " ".join(c["content"] for c in chunks)
    assert "NG-4200" in joined                                   # nothing lost
    assert len(chunks) < 25                                      # didn't explode
```

Then the retrieval-level test that makes chunking *real* — same question,
before vs after. A five-line harness you run once and record (fake-or-real
embedder both work, as long as it's the *same* one for both runs):

```python
# python -m tests.compare_chunking "what is the warranty period?"
for label, chunks in [("naive", ch1_chunks), ("recursive", ch2_chunks)]:
    qv = (await embed([question]))[0]
    top = max(chunks, key=lambda c: cosine(qv, c["embedding"]))
    print(f"{label}: top-1 = {top['section']!r}  score {cosine(qv, top['embedding']):.2f}")
```

**Pass criteria:** all six invariants green **and** the top-1 hit for three
sample questions is the right section with the recursive chunker. If chunking
changes don't move retrieval, the test isn't testing.

✅ **Cycle 2 done** when invariants pass and the before/after numbers are recorded.

---

## 🔁 Cycle 3 — SHA-256 dedup: don't pay twice

### LEARN — content hashing is cache invalidation

Your syllabus flags this **High** for good reason: *"prevents duplicate vectors
when business edits FAQ/products in admin portal."* The flow:

```
file → sha256(bytes) → documents table lookup
        ├─ hash known  → SKIP everything (no parse, no embed, no insert)
        └─ hash new    → extract → chunk → embed → store (with the hash)
```

Same idea as git's object store or HTTP's `ETag`: the hash *is* the identity of
the content. Editing one word → new hash → re-ingest that document (replacing
its old chunks — Chapter 1's `DELETE` by `doc_id` already scopes this correctly).
Not editing → hash matches → zero API calls, zero duplicate vectors. **Delta
sync** is this mechanism pointed at URLs (re-fetch, compare hash of extracted
markdown) — one more line, same table.

### IMPLEMENT — the documents table + the guard

```sql
CREATE TABLE documents (
    doc_id     TEXT PRIMARY KEY,
    sha256     TEXT NOT NULL,          -- hex digest of the SOURCE bytes
    source     TEXT NOT NULL,          -- 'file:faq.md' | 'url:https://...'
    meta       JSONB NOT NULL DEFAULT '{}',
    ingested_at TIMESTAMPTZ DEFAULT now()
);
```

The guard in front of everything from Cycles 1–2:

```python
async def ingest(path: Path) -> str:
    raw   = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()

    if old := await pool.fetchval("SELECT sha256 FROM documents WHERE doc_id=$1", doc_id):
        if old == digest:
            return "skipped (unchanged)"             # ← the whole point

    markdown, meta = await extract_file(path)        # Cycle 1
    chunks = chunk_document(markdown, {**meta, "sha256": digest})   # Cycle 2
    await replace_document(doc_id, chunks, digest)   # transactional, Ch1 style
    return f"ingested ({len(chunks)} chunks)"
```

### TEST — run it twice, then lie to it

```bash
python ingest.py data/faqs.md          # → ingested (9 chunks)
python ingest.py data/faqs.md          # → skipped (unchanged)   ✅ zero API calls
echo "## New Promo\n\nEUR 10 off with code TEN." >> data/faqs.md
python ingest.py data/faqs.md          # → ingested (10 chunks)  ✅ hash changed
```

**Pass criteria:**

1. Second run prints `skipped (unchanged)` — and you can prove no embedding
   call happened by watching your provider dashboard (or a log line in
   `providers.embed` — add one).
2. Row count in `chunks` after run 2 **equals** run 1 — no duplicates.
3. After the edit: old chunks for that `doc_id` gone, new count present
   (transaction — a crash mid-ingest leaves the old version intact).

✅ **Cycle 3 done** when all three hold.

---

## 3.4 Security layer #3 — ingestion is your widest door

Data coming *in* is data you don't control yet:

| Control | Where | Defends against |
|---|---|---|
| `assert_safe_url()`: scheme ∈ {http, https}, resolve DNS and **reject private/link-local ranges** (127.0.0.1, 10.x, 169.254.x, metadata IPs), re-check on every redirect hop | URL extractor | **SSRF** — "fetch this URL" pointing at your own metadata service or Postgres |
| Caps: file ≤ 20 MB, page ≤ 500 KB, redirect limit, timeout | extractors | zip/PDF bombs, memory exhaustion, endless redirects |
| Extension allowlist + magic-byte sniffing (`%PDF-` header, not just `.pdf`) | file extractor | disguised uploads executing elsewhere in your toolchain |
| Every chunk stamped `tenant_id` + `acl` at ingest | Cycle 2 | cross-tenant leakage — enforced for real in Chapter 4's RLS |
| Retrieved document text = **data, not instructions** (Ch1 rule 3 now covers *files*, not just questions) | system prompt | **indirect prompt injection**: a PDF that says "ignore previous rules" — full treatment in Chapter 6 |
| Hash stored, ingest idempotent | Cycle 3 | duplicate-vector DoS via repeated re-ingestion |

SSRF deserves emphasis — it's the new #1 risk your product just acquired by
accepting URLs, and the fix is fifteen lines you write *once* in `assert_safe_url()`.

---

## 3.5 What you now actually understand

- ✅ **The markdown intermediate** — one contract, many source types; extraction tool matrix
- ✅ **Chunking as retrieval design** — fixed vs recursive vs semantic vs agentic, why the unit matters
- ✅ **Metadata enrichment** — provenance, ACLs, hashes stamped at creation time
- ✅ **Content-hash invalidation** — SHA-256 as identity, skip-vs-re-ingest, delta sync
- ✅ **Security floor #3** — SSRF, upload caps, untrusted-document stance

Syllabus mapping: Module 2 (extraction: tools, scraping, vision-OCR, hashing —
2.5 MCP deferred to Ch6 by design) + Module 3.1 (cleaning, dedup, metadata) and
3.2 (chunking strategies). Module 3.3/3.5 (contextual retrieval, late chunking,
parent-doc retrieval) are *specified here, measured in Chapter 4* — they're
retrieval techniques and deserve the evaluation playground before adoption.

---

## 3.6 Node/TypeScript notes

- **Hashing:** `crypto.createHash("sha256").update(bytes).digest("hex")` — identical output; the `documents` table doesn't care which language wrote it.
- **PDF → text:** `pdf-parse` (or `unpdf`); URL fetch is plain `fetch` — but port `assert_safe_url()` *verbatim*, including the redirect re-check.
- **Dispatcher:** a `Record<string, Extractor>` map beats `switch` in TS; the `(markdown, metadata)` tuple becomes an object `{markdown, meta}`.
- **Chunker:** string recursion ports 1:1 — `SEPARATORS.forEach` instead of the Python loop. Where Python pulls ahead: Chapter 4's rerankers (`sentence-transformers` / `FlashRank`) have thinner Node coverage.

---

## 3.7 Next — Chapter 4: retrieval that actually works

Our search is still Chapter 1's single `ORDER BY embedding <=> $1` line — and
now it indexes messy real-world chunks, where one vector per chunk is no longer
enough. Chapter 4 replaces it: **hybrid dense + BM25 search with Reciprocal
Rank Fusion** (so `NG-4200` matches exactly *and* "how do I return this" still
finds the returns policy), **re-ranking**, **tenant row-level security**, and
an evaluation playground that scores naive vs contextual vs late chunking with
real numbers. The first chapter where we delete Chapter 1's code on purpose —
and prove the replacement is better with measurements.
