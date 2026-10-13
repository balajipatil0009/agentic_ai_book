# Chapter 7 — Production: Evaluate, Observe, Survive

> **Product built in this chapter:** the bot and agent stop being demos and
> become services: an evaluation suite with a gold dataset that **blocks
> regressions in CI**, traces that show *which node* burned the latency and the
> tokens, containers that scale workers independently of the API, and a rate
> limiter plus a full-chain security audit — every control from Chapters 1–6
> on one checklist, verified by test.
> **Concepts pulled in *because* production demanded them:** RAGAS metrics,
> gold datasets as CI gates, OpenTelemetry/LangSmith tracing, token/cost
> attribution, Dockerized deployment, worker scaling, connection pooling,
> rate limiting, PII minimization in observability.
> **Security layer added:** Redis token-bucket rate limiting, the consolidated
> audit, data minimization in traces.

Four cycles, same rhythm:

> 🔁 **LEARN** → **IMPLEMENT** → **TEST** (runnable request + pass criteria).

---

## 7.1 Start with a failing test (the product pain)

Launch week, in the order things break — every one of these is a *silent*
failure today:

```
Monday:    prompt tweak ships → hallucinations return; nobody notices for 2 days
Tuesday:   p95 latency 9s; logs say "everything ok" — WHICH node is slow?
Wednesday: one tenant hammers /ask 10k×/min; the bill triples
Thursday:  support asks "is the bot safe now?" — answer is a vibe, not a checklist
```

Four diseases, four cycles:

| Cycle | Pain | Concept | Done when |
|---|---|---|---|
| 🔁 1 | quality regressions ship silently | RAGAS + gold dataset in CI | a deliberate regression **fails the build** |
| 🔁 2 | "everything is ok" logs | tracing + token attribution | one glance names the slow node |
| 🔁 3 | scale-up = prayer | Docker, worker scaling, pooling | workers scale without touching the API |
| 🔁 4 | bill spike + vibes-based safety | rate limiting + full-chain audit | 429s under abuse; checklist green |

---

## 🔁 Cycle 1 — RAGAS: quality you can put in CI

### LEARN — from vibes to scorecards

Chapter 4's gold set measured *retrieval* (hit@k, MRR). Production needs the
**whole pipeline** judged, and that's what RAGAS does — named metrics over
(question, contexts, answer, ground_truth) rows:

- **Faithfulness** — is every claim in the answer supported by the retrieved
  context? (The hallucination metric. Its twin in spirit: Ch1's grounding rule.)
- **Answer relevancy** — does the answer address the question?
- **Context precision / recall** — were the right chunks retrieved, and were
  they ranked up top? (Bridges to Ch4's numbers.)
- **Context entity recall** — were the *key facts* (SKUs, amounts, dates)
  present in context at all?

**LangSmith** hosts traces + datasets + online evaluation; **Braintrust** is
the newer sibling with similar ambitions; both wrap the same idea — but the
*method* is framework-free: **every meaningful change runs the suite; a
drop past threshold blocks the merge.** One afternoon building this replaces
a hundred "looks fine to me" reviews.

### IMPLEMENT — the suite and its gate

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision

async def scorecard() -> dict:                 # gold rows: ch4 set, grown forever
    rows = [await run_pipeline(q) for q in GOLD]   # real pipeline, real answers
    result = evaluate(dataset=Dataset.from_list(rows),
                      metrics=[faithfulness, answer_relevancy, context_precision])
    return dict(result)                          # {"faithfulness": 0.93, ...}

# ci.py — the gate
scores = asyncio.run(scorecard())
json.dump(scores, open("scorecard.json", "w"))
if scores["faithfulness"] < 0.90 or scores["context_precision"] < 0.85:
    raise SystemExit("RAG quality regression — build blocked")
```

### TEST — break it on purpose

```bash
python ci.py                          # main branch: faithfulness 0.93 → PASS

# now sabotage: delete rule 1 (grounding) from SYSTEM_PROMPT, run again:
python ci.py                          # faithfulness 0.71 → exit 1 → CI RED   ✅
```

**Pass criteria:** the sabotaged prompt **fails the gate** and the clean one
passes — the suite must be able to catch the exact regression class this book
keeps warning about. If removing the grounding rule doesn't move faithfulness,
the suite is decorative; fix it before trusting it.

✅ **Cycle 1 done** when both runs behave as above and scorecards are archived
per commit (they're also Chapter 6 agent's ancestor — trends over time are
how you justify infra spend later).

---

## 🔁 Cycle 2 — Tracing: which node is lying?

### LEARN — logs answer "what happened", traces answer "where and how long"

A request now crosses: webhook → queue → classify → retrieve (hybrid + rerank)
→ draft → gate → act. A log line per service can't show the *shape* of that.
**Tracing** records spans — each step a nested, timed, attributed unit:

```
POST /ask  (6.2s total)
├─ rewrite_query     0.9s   tokens: 340
├─ embed             0.2s
├─ hybrid_search     0.4s
│   └─ rerank        0.3s
└─ chat (draft)      4.6s   tokens: in 1820 (cached 1200) / out 210
```

**OpenTelemetry** is the open standard (instrument once, export anywhere);
**LangSmith** is the managed RAG-native view (dataset linking, per-node LLM
metadata) — you can even run both. One privacy rule that production teams
learn expensively: **spans carry metadata, not content** — token counts,
latencies, tenant *hashes*, chunk counts. Raw prompts in a tracing SaaS are a
PII incident waiting for a lawyer.

### IMPLEMENT — 8 lines of OTel around the pipeline

```python
from opentelemetry import trace
tracer = trace.get_tracer("faqbot")

async def ask(req):
    with tracer.start_as_current_span("ask") as root:
        root.set_attributes({"tenant_hash": sha256(tenant)[:8], "k": req.k})
        with tracer.start_as_current_span("retrieve") as sp:
            hits = await hybrid_search(q, tenant, k=30)
            sp.set_attribute("hits", len(hits))          # NO chunk text here
        with tracer.start_as_current_span("rerank") as sp:
            top = await rerank(q, hits, 4)
        with tracer.start_as_current_span("generate") as sp:
            answer = await chat(...)
            sp.set_attributes({"tokens_in": usage["prompt_tokens"],
                               "tokens_cached": usage.get("cached_tokens", 0),
                               "tokens_out": usage["completion_tokens"]})
```

### TEST — the trace must answer the question

```bash
curl -s localhost:8000/ask ... | jq .trace_id
# open the trace → verify: span tree present; rerank span shows 0.3s;
# generate span shows cached_tokens > 0 (Ch2's caching, now observable)
```

**Pass criteria:** one glance at a slow request's trace names the guilty span
(deliberately insert a `sleep(2)` in the reranker → it must be the obvious
culprit in the tree); token attributes present on the generate span; **no
span attribute contains raw user text or chunk content** (grep the exported
payload — this is a test, not a promise).

✅ **Cycle 2 done** when the planted bottleneck is identifiable in seconds and
the privacy grep passes.

---

## 🔁 Cycle 3 — Containers & scaling: one image, two jobs

### LEARN — stateless API, separately-scaled workers, one database

The architecture has been begging for this split since Chapter 6: the **API**
must answer in milliseconds (it only enqueues and serves `/ask`), while
**workers** run graphs for seconds-to-minutes. Same image, different command:

- **Docker** freezes the runtime (Python version, deps) — "works on my
  laptop" becomes a build artifact. Multi-stage builds keep images slim.
- **Scaling math:** API scale-out is trivial (stateless, healthcheck-gated);
  workers scale on *queue depth* (Redis `LLEN`); the database is the crown
  jewel — pool it (**pgbouncer** or asyncpg's small pool, sized honestly:
  `max_size ≈ (API instances × pool) + workers × 1 < max_connections`).
- **pgvector at scale:** HNSW indexes are memory-mapped — RAM follows your
  vector count; read replicas offload search-heavy `/ask` traffic while
  ingestion stays on the primary. Chapter 4's index means no re-architecture,
  just resources.

### IMPLEMENT — compose grows up

```yaml
services:
  db:      { image: pgvector/pgvector:pg16, volumes: [pgdata:/var/lib/postgresql/data] }
  redis:   { image: redis:7-alpine }
  api:     { build: ., command: uvicorn app.main:app --host 0.0.0.0,
             depends_on: [db, redis], deploy: { replicas: 2 } }
  worker:  { build: ., command: arq app.worker.WorkerSettings,
             depends_on: [db, redis], deploy: { replicas: 3 } }
```

```dockerfile
FROM python:3.12-slim AS build
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]
```

### TEST — chaos, cheaply

```bash
docker compose up -d --scale worker=5
bombardier -c 50 -n 2000 "POST /webhook/tickets"     # queue drains visibly faster
docker compose kill worker                            # 1 of 5 dies
docker compose ps                                    # → restarted; in-flight thread
                                                     #   resumes from checkpoint (Ch6)
```

**Pass criteria:** (1) 5 workers drain a 100-ticket burst measurably faster
than 1 (record both numbers); (2) killing a worker loses zero tickets — the
checkpointed thread completes; (3) `/health` stays green during all of it.

✅ **Cycle 3 done** when the numbers are recorded and the chaos test passes.

---

## 🔁 Cycle 4 — Rate limiting & the audit: the bill and the checklist

### LEARN — tenancy multiplies abuse

One public endpoint + usage-based LLM costs = someone's worst day. **Token
bucket in Redis** (refill rate per tenant, burst capacity) is the whole
defense — one round-trip, survives API restarts, per-tenant by construction
(Ch4's tenant identity finally pays a new dividend).

And the audit method — the answer to "is it safe now?" — is **walk the chain,
one control per hop**:

```
webhook → HMAC sig (Ch6) → queue idempotency (Ch6) → worker (isolated creds)
   → retrieval: RLS fail-closed (Ch4), input caps (Ch1/2) → generation: grounded
   prompt + grading + abstention (Ch1/Ch5) → actions: allowlists, caps,
   audit log (Ch6) → observability: metadata-only spans (this cycle)
   → perimeter: API keys (Ch1) + rate limits (below)
```

### IMPLEMENT — the limiter as a dependency

```python
LIMITS = {"burst": 20, "refill_per_min": 60}           # per tenant

async def rate_limit(tenant: str, redis) -> None:
    key = f"rl:{tenant}:{int(time.time() // 60)}"
    used = await redis.incr(key)
    if used == 1: await redis.expire(key, 120)
    if used > LIMITS["burst"] + LIMITS["refill_per_min"]:
        raise HTTPException(429, "rate limited", headers={"Retry-After": "120"})
```

### TEST — abuse behaves, audit is evidence

```bash
for i in $(seq 1 200); do curl -s -o /dev/null -w "%{http_code}\n" .../ask; done | sort | uniq -c
# → 160× 200, 40× 429   (tenant A limited; tenant B unaffected — test both)
```

**Pass criteria:** (1) tenant A gets 429s at the expected boundary while
tenant B's latency is untouched; (2) every audit row above maps to a *test
that exists* (Chapters 1–6 each shipped one) — an untested control is marked
"claimed", not "verified"; (3) the 3-second webhook law (Ch6) still holds
under limited load.

✅ **Cycle 4 done** when the limit behaves, and the checklist is 100% test-backed.

---

## 7.6 Security layer #7 — the consolidated perimeter

| Control | Introduced | Now verified by |
|---|---|---|
| Constant-time API keys | Ch1 | auth tests |
| Input caps (question/history/file) | Ch1–3 | 422/bomb tests |
| Parameterized SQL everywhere | Ch1 | injection tests |
| RLS fail-closed per tenant | Ch4 | leakage test (both legs) |
| SSRF + upload caps | Ch3 | URL/upload tests |
| Output schemas as firewalls | Ch5 | contract abuse tests |
| Action sandbox: allowlists, caps, idempotency, audit | Ch6 | hijack/retry/cap tests |
| HMAC webhooks, checkpointed interrupts | Ch6 | forgery/pause tests |
| **Rate limiting per tenant** | **this cycle** | **429 boundary test** |
| **Metadata-only traces (PII minimization)** | **this cycle** | **span-content grep** |

## 7.7 What you now actually understand

- ✅ **RAGAS / gold datasets** — faithfulness, relevancy, context precision; regression gates; why a sabotaged prompt must fail your CI
- ✅ **Tracing** — spans vs logs, OTel vs LangSmith, token/cost attribution, the metadata-only rule
- ✅ **Deployment** — one image two jobs, worker scaling on queue depth, honest pool math, HNSW/replica reality
- ✅ **Rate limiting** — Redis token buckets keyed by tenant identity
- ✅ **Security audits as method** — chain-walk, control inventory, test-backed claims

Syllabus mapping: Module 8.1 (RAGAS; LangSmith/Braintrust hosted evaluation),
8.2 (OTel/LangSmith tracing, latency/token breakdown), 8.3 (security — **High**:
the full inventory, now consolidated and test-backed), 8.4 (Docker, FastAPI
deployment, vector scaling, Redis), **Lab 8 delivered end-to-end** (instrumented
pipeline + automated scorecards on a gold dataset).

## 7.8 Node/TypeScript notes

- **OTel and Docker port verbatim** — SDK spans and the Dockerfile differ only in syntax; compose is shared config.
- **RAGAS is Python-only** → on Node use **LangSmith** datasets/evaluators, **promptfoo**, or call the RAGAS suite from a tiny Python CI job (polyglot CI is normal; the scorecard JSON is the contract).
- **Rate limiter:** same Redis `INCR`/`EXPIRE`; Node's `ioredis` makes it five lines.

## 7.9 Next — the Capstone

Everything the syllabus listed is now built *and* proven — the final chapter is
yours to assemble: pick **Option A** (AI Support Co-pilot: SaaS integrations,
webhook listeners, multi-tenant KB, human-in-the-loop drafts), **Option B**
(Internal Knowledge Bot: Drive/Slack/Notion ingestion, SHA-256 dedup, ACLs,
Slack bot), or **Option C** (Invoice/Contract Extractor: vision/PDF parsing,
structured extraction to Postgres, hybrid search with audit trails). Each is a
recombination of chapters you already own — the capstone chapter gives each
option its architecture, acceptance criteria, and the chapter map for every
piece. No new theory awaits you there. That's the point of this book.
