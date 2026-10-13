# Chapter 4 — Retrieval That Actually Works: Hybrid Search & Tenancy

> **Product built in this chapter:** the bot's search is replaced — one query
> now matches both *meaning* ("how do I get my money back") **and** exact
> strings (`NG-4200`, error codes, part numbers), a cross-encoder re-ranks the
> shortlist, and every query runs inside the caller's tenant — enforced by the
> database itself, not by hope.
> **Concepts pulled in *because* the product demanded them:** dense vs sparse
> retrieval, BM25/Postgres FTS, Reciprocal Rank Fusion, cross-encoder
> re-ranking, pre- vs post-filtering, row-level security, hit@k / MRR evals,
> contextual retrieval, late chunking, parent-document retrieval.
> **Security layer added:** tenant isolation via RLS, per-request tenant context,
> the post-filter leak (demonstrated, then closed).

Same rhythm, four cycles:

> 🔁 **LEARN** → **IMPLEMENT** → **TEST** (runnable request + pass criteria).

---

## 4.1 Start with a failing test (the product pain)

Chapter 3 gave the bot a real corpus — and real corpus, real failures:

```
Q: "Tell me about the NG-4200"
   ❌ top-1 = "Shipping and Delivery" (score 0.58)   ← wanted: NimbusPulse Pro

Q: "how do I get my money back?"
   ✅ top-1 = "Returns and Refunds"                  ← semantic leg still works

Q: (as tenant Globex, querying Nimbus's docs)
   ❌ answered from Nimbus chunks                       ← cross-tenant leak
```

The first failure has a clean cause: **embedding models are blind to rare
strings.** `NG-4200` is one meaningless token to an embedding — maybe two.
Its vector barely differs from `NG-780`. But Postgres full-text search matches
it *exactly*. Neither method wins alone; the product needs both.

| Cycle | Pain | Concept | Done when |
|---|---|---|---|
| 🔁 1 | SKU queries miss | dense + BM25 + RRF fusion | 3-query acceptance table passes |
| 🔁 2 | top results relevant but shallow-ranked | cross-encoder re-ranking | adversarial pair flips correctly |
| 🔁 3 | tenant leak | RLS + pre-filtering | leakage test: zero cross-tenant rows |
| 🔁 4 | "which chunking is better?" vibes | eval playground (hit@k, MRR) | numbers recorded, decision made |

*(Brief interlude — vector DB selection, Module 4.1: we chose **pgvector** in
Chapter 1 and this chapter proves why: FTS, transactions and RLS in the same
database, zero extra infra. **Qdrant** wins on raw ANN speed and payload
filters at billion-scale; **Pinecone** wins on ops (fully managed) and loses on
joining with your app data. Rule of thumb: stay on pgvector until search *is*
your bottleneck — you'll know from Chapter 7's tracing.)*

---

## 🔁 Cycle 1 — Hybrid search: two searches, one ranking

### LEARN — dense, sparse, and why fusion

- **Dense** (Chapter 1's vector search): great at *meaning*, blind to rare
  tokens — SKUs, error codes, names.
- **Sparse / BM25** (keyword scoring with inverse-document-frequency weights):
  great at *exact strings*, blind to paraphrase — "money back" never matches
  "refund". Postgres ships this as **Full-Text Search**: `tsvector` (tokenized,
  stemmed text) + `ts_rank_cd` (BM25-ish scoring) + a GIN index.
- **Why not average the two scores?** The scales are incomparable — cosine
  lives in [0,1], ts_rank grows with term frequency and is unbounded. Fusion
  must operate on what the two systems *agree on*: **rank positions**.

**Reciprocal Rank Fusion (RRF)** is embarrassingly simple and very robust:

```
RRF(d) = 1/(k + rank_dense(d))  +  1/(k + rank_sparse(d))      k = 60 (convention)
```

A doc ranked #1 by *either* leg scores ~0.016; #1 by *both* ~0.032. No score
calibration, no learned weights, no tuning on day one. RRF is why "hybrid"
stopped being a research project in industry codebases.

### IMPLEMENT — one SQL query does both legs

First, teach Postgres the sparse leg — a generated column and an index:

```sql
ALTER TABLE chunks ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX idx_chunks_tsv ON chunks USING gin (tsvector);
```

Then the fused search — both legs, tenant-scoped, RRF in SQL (Cycle 3 adds the
RLS layer that makes the `WHERE tenant_id` redundant-but-cheap):

```sql
WITH dense AS (
    SELECT id, row_number() OVER (ORDER BY embedding <=> $1::vector) AS r
    FROM chunks WHERE tenant_id = $4 LIMIT 50
), sparse AS (
    SELECT c.id, row_number() OVER (ORDER BY ts_rank_cd(c.tsv, q) DESC) AS r
    FROM chunks c, websearch_to_tsquery('english', $2) q
    WHERE c.tsv @@ q AND c.tenant_id = $4 LIMIT 50
), fused AS (
    SELECT id, sum(1.0 / (60 + r)) AS rrf
    FROM (SELECT id, r FROM dense UNION ALL SELECT id, r FROM sparse) f
    GROUP BY id
)
SELECT c.id, c.section, c.content, f.rrf
FROM fused f JOIN chunks c ON c.id = f.id
ORDER BY f.rrf DESC LIMIT $3;
```

Notes: `$1` = question vector, `$2` = question text, `$3` = k, `$4` = tenant.
`websearch_to_tsquery` is the human-safe tsquery builder (handles quotes,
boolean operators — a plain string in, sane query out). Both legs pull 50,
fusion keeps the best of both worlds.

### TEST — the three-query acceptance table

```bash
for q in "NG-4200" "how do I get my money back" "quantum flux capacitor"; do
  curl -s localhost:8000/search -H "X-API-Key: $KEY" -d '{"q":"'$q'"}' | jq '.hits[0]'
done
```

**Pass criteria (record the scores):**

| Query | Expected top-1 | Wins by |
|---|---|---|
| `NG-4200` | NimbusPulse Pro section | sparse leg (exact match) |
| `how do I get my money back` | Returns and Refunds | dense leg (paraphrase) |
| `quantum flux capacitor` | *nothing above threshold* | **both legs correctly empty** |

Row 3 matters most: hybrid search that still answers garbage questions is a
*new* hallucination vector. We now have a score (`rrf`) to threshold on.

✅ **Cycle 1 done** when all three rows pass.

---

## 🔁 Cycle 2 — Re-ranking: the cheap-then-careful pipeline

### LEARN — bi-encoders vs cross-encoders

Embedding search is a **bi-encoder**: query and chunk are embedded *separately*,
compared as two vectors — fast over millions, but "similarity" is a blunt
approximation. A **cross-encoder** reads *query and chunk together*, token by
token, through one model — far more accurate judgments, far too slow to run on
a corpus. The production shape falls out immediately:

```
30 candidates (hybrid, cheap)  →  cross-encoder rerank  →  top 4 to the LLM
```

Rerankers you'll meet: **Cohere Rerank** (API, excellent, per-request cost),
**FlashRank** (local, pip-installable, no API key — we use this one),
sentence-transformers `cross-encoder/ms-marco-MiniLM` (the model FlashRank
bundles). Reranking is *the* highest-ROI line in a RAG budget: it costs ~1 model
call on ~30 short texts and it reorders exactly the mistakes you saw in Cycle 1.

### IMPLEMENT — 12 lines in the pipeline

```python
from flashrank import Ranker, RerankRequest

_ranker = Ranker()                       # loads once, at import

async def rerank(query: str, hits: list[dict], top: int = 4) -> list[dict]:
    req = RerankRequest(query=query,
                        passages=[{"id": h["id"], "text": h["content"]} for h in hits])
    order = {p["id"]: p["score"] for p in _ranker.rerank(req)}
    ranked = sorted(hits, key=lambda h: order[h["id"]], reverse=True)
    return [{**h, "rerank_score": order[h["id"]]} for h in ranked[:top]]
```

Wire it: `hybrid_search(q, k=30)` → `rerank(q, hits, top=4)` → generate. The
API response now carries both `rrf` and `rerank_score` — two scores, two
stories, invaluable in Chapter 7's traces.

*(Provider-agnostic escape hatch, same as Chapter 1's rule: swapping FlashRank
for Cohere is one HTTP POST — `{"model": "rerank-english-v3.0", "query": ...,
"documents": [...]}` → `results[].relevance_score`. No vendor leaks past
`rerank()`.)*

### TEST — an adversarial pair the bi-encoder gets wrong

```python
def test_reranker_fixes_bi_encoder_blind_spot():
    q = "can I return a watch I already opened"
    hits = [  # exactly the two near-tie chunks from Cycle 1's failure
        {"id": 1, "content": "Unopened products: full refund within 30 days."},
        {"id": 2, "content": "Opened electronics: 14 days, manufacturing defect only."},
    ]
    out = asyncio.run(rerank(q, hits, top=2))
    assert out[0]["id"] == 2, "cross-encoder must prefer the 'opened' chunk"
    assert out[0]["rerank_score"] > out[1]["rerank_score"]
```

Both chunks mention returns and refunds; cosine puts them within noise of each
other. The cross-encoder reads *both texts jointly* and knows which one is
about **opened** items.

✅ **Cycle 2 done** when the adversarial flip passes and the 3-query table
still passes (rerank must never *break* what fusion fixed).

---

## 🔁 Cycle 3 — Tenant isolation: the database refuses to leak

### LEARN — pre-filter, post-filter, or refuse

- **Post-filtering** (search everything, filter results afterwards) is the
  classic leak: `LIMIT 4` returns 4 Globex rows, the filter drops all of them,
  the user gets nothing — *or* one careless deploy ships someone else's data.
- **Pre-filtering** (filter *before* the search) is correct: only your tenant's
  vectors participate in ranking.
- **Row-Level Security (RLS)** makes pre-filtering a *database guarantee*: the
  policy runs inside every query — including the ones your future self writes
  at 3 a.m. Forgetting `WHERE tenant_id` stops being a data breach and becomes
  a no-op.

### IMPLEMENT — enable RLS, set the tenant per request

```sql
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chunks
    USING (tenant_id = current_setting('app.tenant_id', true));  -- null => no rows
```

Application side — tenant context is **set, never trusted**, scoped to one
transaction so a pooled connection can never carry tenant A into tenant B's
request:

```python
async def as_tenant(tenant_id: str):          # async context manager
    conn = await get_pool().acquire()
    await conn.execute("SET LOCAL app.tenant_id = $1", tenant_id)  # via transaction
    try:
        yield conn                            # every query inside is tenant-scoped
    finally:
        await conn.release()
```

Where does `tenant_id` come from? **The API key → tenant mapping**, never the
request body — a client claiming `{"tenant_id": "nimbus"}` is a story we don't
accept. (Chapters 1–3 stamped `tenant_id` on every chunk at ingest — Chapter
3's Cycle 2 metadata table — which is why this chapter is *configuration*, not
a migration.)

### TEST — the leakage test (the only test that matters here)

```python
async def test_no_cross_tenant_rows():
    await seed_tenant("nimbus",  qa="warranty?", section="Warranty")
    await seed_tenant("globex",  qa="warranty?", section="Globex Warranty")

    nimbus_hits = await hybrid_search("warranty period", tenant="nimbus", k=50)
    globex_hits = await hybrid_search("warranty period", tenant="globex", k=50)

    assert all(h["tenant_id"] == "nimbus" for h in nimbus_hits)
    assert all(h["tenant_id"] == "globex" for h in globex_hits)
    # and with NO tenant set — the paranoid case — the database returns nothing:
    assert await hybrid_search("warranty period", tenant=None, k=50) == []
```

**Pass criteria:** all three assertions green — including the `tenant=None`
row, which proves the policy *fails closed* (missing context = zero rows, not
"all rows").

✅ **Cycle 3 done** when the leakage test passes on both legs (dense **and**
sparse — a policy mistake can hide on one leg only).

---

## 🔁 Cycle 4 — The eval playground: stop guessing

### LEARN — hit@k, MRR, and the deferred techniques

Chapter 3 parked three techniques here: **contextual retrieval** (prepend a
short LLM-written situating summary to each chunk *before* embedding — one-time
cost, big recall gains on ambiguous chunks), **late chunking** (embed the whole
document with a long-context model, then pool token vectors per chunk — chunks
keep whole-document context), and **parent-document retrieval** (search small
chunks, hand the LLM their parent section). Which should we adopt? *Measure,
don't debate.* Two metrics a spreadsheet can hold:

- **hit@k** — fraction of gold questions where the right section is in top k.
- **MRR** — mean reciprocal *rank* of the right section (1.0 = always #1,
  0.5 = always #2): rewards getting the answer to the top, not just near it.

### IMPLEMENT — the runner

```python
GOLD = [  # (question, expected section) — start with 10, grow it forever
    ("can I return an opened watch?", "Returns and Refunds"),
    ("NG-4200 battery life?",         "NimbusPulse Pro Watch (SKU NG-4200)"),
    ("warranty period?",              "Warranty"),
]

def evaluate(strategy) -> dict:            # strategy = fn(question) -> ranked hits
    hits1 = hits3 = rr = 0.0
    for q, gold in GOLD:
        sections = [h["section"] for h in strategy(q)]
        if gold in sections[:1]: hits1 += 1
        if gold in sections[:3]: hits3 += 1
        if gold in sections:     rr += 1 / (sections.index(gold) + 1)
    return {"hit@1": hits1/len(GOLD), "hit@3": hits3/len(GOLD), "mrr": rr/len(GOLD)}
```

Run each strategy — naive-chunks+dense (Chapter 1), recursive-chunks+dense
(Chapter 3), hybrid, hybrid+rerank, hybrid+rerank+parent-doc — same gold set:

```
strategy                        hit@1   hit@3    MRR
naive dense (ch1)                0.40    0.70   0.51
recursive dense (ch3)            0.60    0.80   0.68
hybrid (cycle 1)                 0.70    0.90   0.77
hybrid + rerank (cycle 2)        0.80    1.00   0.86      ← adopted
hybrid + rerank + parent-doc     0.80    1.00   0.88      ← keep, revisit at 100+ gold rows
```

*(Numbers are from this book's sample corpus — yours will differ; the method
won't. Contextual retrieval / late chunking plug into the same runner as extra
strategies when your chunks start failing specific gold rows — adopt them per
failure, not per blog post.)*

### TEST — the eval *is* the test

**Pass criteria:** the table exists, `hybrid + rerank` ≥ every earlier
strategy on all three metrics, and the adopted row is what production runs.
Re-run the whole table whenever a strategy changes — Chapter 7 wires this into
CI so regressions block merges.

✅ **Cycle 4 done** when the table is recorded and the adopted strategy is live.

---

## 4.6 Security layer #4 — isolation is infrastructure

| Control | Where | Defends against |
|---|---|---|
| RLS policy on `chunks`, fail-closed (`tenant=None` ⇒ zero rows) | database | every cross-tenant leak, *including from your own future bugs* |
| Tenant from API-key mapping, `SET LOCAL` per transaction | app | forged `tenant_id` in request bodies; pooled-connection bleed |
| Both legs tenant-scoped (dense **and** sparse) | Cycle 1 SQL | partial-coverage leaks — FTS index bypassing a forgotten WHERE |
| RRF threshold before generation (Cycle 1, row 3) | `/ask` | answering from nothing — a hallucination vector |
| Rerank scores surfaced in API + logs | Cycle 2 | silent retrieval regressions shipping unnoticed |

---

## 4.7 What you now actually understand

- ✅ **Dense vs sparse retrieval** — why each is blind where the other sees
- ✅ **RRF** — rank-based fusion, why score-averaging fails
- ✅ **Cross-encoders & the retrieve-wide-rerank-narrow pipeline** — where accuracy per millisecond actually comes from
- ✅ **Pre- vs post-filtering** — and why RLS is the only version you don't have to remember
- ✅ **hit@k / MRR** — gold sets, strategy tables, measuring before adopting
- ✅ **Contextual retrieval, late chunking, parent-doc retrieval** — specified, runnable in the playground, adopted per evidence

Syllabus mapping: Module 4.1 (DB selection — reasoned), 4.2 (RLS/tenant ACLs —
**High** ✅), 4.3 (hybrid + RRF — **High** ✅), 4.4 (rerankers), 4.5 (pre/post
filtering), plus Module 3.3/3.5 delivered as the eval playground (Lab 3).

---

## 4.8 Node/TypeScript notes

- **FTS is PostgreSQL, not Python** — the Cycle-1 SQL runs byte-identically from `pg`; `SET LOCAL` works the same inside `pool.connect()` + transaction.
- **FlashRank is Python-only** → on Node, use Cohere's rerank API directly (same JSON contract shown in Cycle 2) or ONNX runtime hosting the same MiniLM cross-encoder. One function either way.
- **The eval runner** is a `Map<strategy, fn>` + `reduce` — metrics math ports 1:1.

---

## 4.9 Next — Chapter 5: the brain learns to *do*

The bot now retrieves like a pro but still only *answers*. Chapter 5 gives it
structured output it can trust (Pydantic v2 schemas, JSON mode, function
calling — Module 1.3) and judgment: Corrective RAG that checks its own retrieved
context before answering, HyDe, router agents that split questions between SQL
and the vector store, multimodal chunks, and a first look at knowledge graphs
(Module 6). The line between "chatbot" and "agent" starts here.
