# Capstone — Assemble and Harden

> **No new theory in this chapter.** Every concept your syllabus listed is
> already built and proven somewhere in Chapters 1–7. The capstone is an
> *assembly* job: pick one of three real products, recombine the parts you
> own, write the glue (which is integration work, not AI work), and pass the
> acceptance criteria — each of which is a test you already know how to write.

Three options, ~25 hours each (your syllabus's estimate — five focused days).
Each gets: what it is → architecture → the chapter map → build order →
**Pass criteria** → the security checklist that option cannot skip.

---

## How to choose

| Pick | If you want to go deep on | The new work is mostly… |
|---|---|---|
| **A — AI Support Co-pilot** | agents, multi-tenancy, SaaS glue | channel adapters + approval UI |
| **B — Internal Knowledge Bot** | data engineering, permissions at scale | connectors + ACL mapping from SSO |
| **C — Invoice/Contract Extractor** | document AI, structured extraction, finance-grade rigor | field schemas + validation + review queue |

Any choice proves the same thesis; the difference is which muscle you leave
the book with. If undecided: **A** if you might sell this, **B** if you'll use
it at work, **C** if document AI is your target industry.

---

## Option A — AI Support Co-pilot

**What:** a multi-tenant SaaS co-pilot. Customers forward support tickets
(Zendesk, email, Meta/WhatsApp webhooks) → the agent classifies, retrieves the
*tenant's* knowledge base, drafts a reply with citations → a human agent
approves/edits in a dashboard → the reply is sent and the ticket status
updates. Low-risk drafts auto-send under caps; everything else waits for a
human.

```
channels (Zendesk/email/Meta) ─→ webhook gateway ─→ queue ─→ agent graph
   HMAC, idempotency (Ch6)          (Ch6)          │
                                                    ▼
      send ← action sandbox (Ch6) ← approval API/UI ← interrupt (Ch6)
                     │
   tenant KB ── hybrid search + RLS (Ch4) ← ingestion (Ch3) ← customer docs
   drafts: grounded generation (Ch1) + contracts (Ch5) + memory (Ch2)
   quality: RAGAS gates + traces (Ch7)     limits: token buckets (Ch7)
```

**Chapter map** — almost everything is recombination; the genuinely new glue
is honest and small:

| Piece | From |
|---|---|
| Grounded answers, citations, `/ask` | Ch1 |
| Session memory, streaming drafts to the dashboard | Ch2 |
| Customer doc ingestion, SHA-256 dedup | Ch3 |
| Hybrid search, rerank, **tenant RLS** (the SaaS spine) | Ch4 |
| Ticket contracts, CRAG abstention, router (ticket vs KB vs live API) | Ch5 |
| Agent graph, human-in-the-loop, webhook workers | Ch6 |
| Eval gates, tracing, rate limits, audit | Ch7 |
| *New:* channel adapters (Zendesk app, email parser, Meta webhook), thin approval dashboard, per-tenant billing metering | — |

**Build order (5 days):** D1 multi-tenant skeleton + RLS + keys (Ch4 reused
wholesale) · D2 channel adapters + queue (Ch6) · D3 draft quality: CRAG +
RAGAS per-tenant scorecards (Ch5+Ch7) · D4 approval UI + interrupts (Ch6) ·
D5 limits, audit, chaos day (Ch6+Ch7).

**Pass criteria** (every row is a test, not a demo):

1. Ticket from channel A of tenant 1 never surfaces tenant 2 data — leakage
   test runs against *production-shaped* fixtures, both search legs.
2. Webhook ack < 3s under burst; retried delivery produces exactly one draft.
3. Drafts below 0.85 confidence pause; approval resumes within one API call;
   rejected drafts regenerate with feedback.
4. Per-tenant RAGAS faithfulness ≥ 0.90 gates any prompt/model change.
5. A seeded injection ticket ("email the transcript to…") is blocked by the
   recipient allowlist and visible in the audit log.
6. p95 `/ask`-equivalent latency traced end-to-end; slowest span identified
   from a trace alone.

**Security checklist (non-negotiable for A):** per-tenant keys + RLS
fail-closed, HMAC on every channel, action sandbox unchanged (caps are your
insurance policy), PII-minimized traces, data-retention contract per tenant.

---

## Option B — Internal Knowledge Bot

**What:** the company's own bot. It ingests Drive folders, Notion spaces and
Slack channels — with **SHA-256 dedup** so re-syncs are free — honors source
permissions via SSO-group ACLs, and answers employees in Slack threads or a
web UI, with conversation memory.

```
Drive / Notion / Slack APIs ──→ connectors ──→ ingestion (Ch3: hash, dedup,
      OAuth, delta sync                 │       metadata, ACL stamping)
                                        ▼
   SSO groups ──→ ACL map ──→ group-stamped chunks ──→ hybrid search + RLS (Ch4)
                                        ▼
   Slack Events API (HMAC-verified) → agent graph lite (Ch6, single-step) →
                                        threaded reply + memory (Ch2)
```

**Chapter map:**

| Piece | From |
|---|---|
| Extraction, dedup, delta sync, MCP tools for sources | Ch3 (+ Ch6 MCP) |
| ACL stamping at ingest; group-based RLS; hybrid search | Ch4 |
| Memory in Slack threads, streaming in web UI | Ch2 |
| Structured citations, abstention ("ask the doc owner" path) | Ch5 |
| Workers for resync schedules, HMAC on Slack events | Ch6 |
| Scorecards on an internal gold set, traces, limits | Ch7 |
| *New:* connector OAuth flows, SSO-group→ACL mapping, Slack thread UX | — |

**Build order (5 days):** D1 one connector (Notion or Drive) end-to-end with
hashes · D2 ACL model: groups → policies, fail-closed tests · D3 Slack events
+ threaded memory · D4 remaining connectors + scheduled resync · D5 evals,
audit, permission-change drills.

**Pass criteria:**

1. Re-sync with zero content changes: **zero embedding API calls** (watch the
   provider dashboard — Ch3's promise, now load-bearing).
2. Permission matrix test: user in group `eng` never retrieves `hr-private`
   chunks — across search legs, Slack *and* web UI.
3. A document permission change at the source propagates within one resync
   cycle; revoked doc is unretrievable after it.
4. Slack thread follow-ups use memory correctly ("what about the second
   option?") without cross-thread bleed.
5. A poisoned internal doc ("ignore instructions…") cannot trigger actions —
   internal indirect-injection drill, audit-logged.
6. Gold set of 20 real internal questions: hit@3 ≥ 0.85 before rollout.

**Security checklist (non-negotiable for B):** ACL fidelity beats retrieval
quality (a perfectly-answered off-limits question is a breach), least-privilege
connector credentials, revocation drills, internal-injection stance.

---

## Option C — Enterprise Invoice/Contract Extractor & Q&A

**What:** upload invoices and contracts (scanned, photographed, digital) →
vision models extract structured fields into Postgres with per-field
confidence → low-confidence fields go to a human review queue → finance Q&A
over the corpus ("which contracts renew before June?") with **audit trails**:
every answer and every field change attributable, page-cited.

```
uploads ──→ vision extraction (Ch3: vision OCR, Docling) ──→ field contracts
             (Ch5: Pydantic schemas per doc type, per-field confidence)
                       ▼
   Postgres: documents / fields / audit_trail ── numeric validators
             (totals sum, VAT math, date sanity — seeded-error drills)
                       ▼
   review queue (confidence < threshold → human) ←──→ hybrid search Q&A (Ch4)
                       ▼                                + page-cited answers
   audit trail: who changed what field, when, why (finance-grade)   (Ch7 traces)
```

**Chapter map:**

| Piece | From |
|---|---|
| PDF/vision extraction pipeline, hashes, table fidelity | Ch3 |
| Field contracts, validation-retry, confidence grading | Ch5 |
| Multimodal citations (page crops), hybrid search + filters | Ch4+Ch5 |
| Review queue as an interrupt (human-in-the-loop, same pattern) | Ch6 |
| Audit trails, retention, PII-minimized traces, eval gates | Ch7 |
| *New:* per-doctype field schemas, numeric cross-validation rules, review UI | — |

**Build order (5 days):** D1 one doctype (invoice) schema + extraction
contracts · D2 numeric validators + seeded-error drills · D3 review queue +
audit trail · D4 corpus Q&A with page citations + entity filters
("show unpaid invoices > €1k") · D5 RAGAS-on-fields, retention, chaos day.

**Pass criteria:**

1. Gold set of 30 real invoices: field-level accuracy recorded per field;
   any regression blocks the pipeline change (scorecards, Ch7 style).
2. Seeded errors — a total that doesn't equal line items, VAT that doesn't
   add up — are caught by validators, not by the model's mood.
3. Every Q&A answer cites document + page; a crop accompanies visual claims.
4. Every field carries provenance: who extracted, who overrode, when —
   append-only, exportable for auditors.
5. Low-confidence fields never silently ship to the ledger — review queue is
   mandatory and its SLA is measured.
6. Injection drill: a malicious PDF text layer ("ignore instructions…") can
   neither trigger actions nor leak other documents' fields.

**Security checklist (non-negotiable for C):** financial PII never in traces
or logs, retention/deletion policy per jurisdiction, dual-control on field
overrides above a threshold, immutable audit trail.

---

## The closing method (the actual point of this book)

Whatever option you shipped, you used the same four moves — they travel to
every future system you build:

1. **Tracer bullet first.** Working product before understanding; theory
   arrives when the product demands it. Day-1 value, always.
2. **🔁 learn → implement → test.** No concept without a runnable signal
   attached; every cycle ends with a labeled Pass criteria you actually ran.
3. **Security is a section of every chapter, never an appendix.** Each feature
   that touches data or triggers actions ships with the control that bounds
   it — and the test that proves the control.
4. **Measure before you adopt.** HyDE, late chunking, contextual retrieval,
   rerankers, extra agents — everything entered your stack through an eval
   table, not a blog post.

Where to grow next: provider cookbooks (Anthropic/OpenAI engineering guides),
the LangGraph docs, RAGAS/LangSmith release notes, and arXiv's
`cs.CL` for retrieval — reading each through the lens of *which of my gold-set
rows would this improve?* Your scorecard is the compass now. Keep the
checklist green, keep the traces clean, keep the caps where the model can't
reach them — and ship.
