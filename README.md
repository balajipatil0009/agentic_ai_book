# Building Agentic AI Products — A Project-Oriented Book

This book throws away the "finish the topic, then build" order. You build a **real,
working product on Day 1**, and every concept after that arrives only because the
next product feature needed it. Theory is pulled in *on demand*, inline, right
before you use it.

Your background assumed: **you already know Python and Node.** No language
tutorials. Code is Python-first (FastAPI/Pydantic — the ecosystem this domain
lives in), with Node/TypeScript notes wherever the equivalent matters.

Source material: the syllabus CSV in the repo root (8 modules, ~157h). That
syllabus is *topic order*. This book is *project order*. Every syllabus topic
still gets covered — as an "upgrade patch" to a product you already own.

---

## The Project Ladder

| # | Product you build | Concepts pulled in (syllabus coverage) | Security thread |
|---|---|---|---|
| **P1** | **Business FAQ Chatbot — works Day 1** | tokens & context windows, embedding models, vectors, pgvector, semantic search, LLM integration, grounded prompting, citations | API keys, secrets handling, input limits, parameterized SQL, prompt-injection basics |
| **P2** | Chatbot that remembers & streams | conversation memory, multi-turn query rewriting, SSE streaming, prompt caching, cost/latency | session isolation |
| **P3** | Ingest anything (PDF / URL / CSV) | extraction tools (Docling, LlamaParse), chunking strategies, SHA-256 dedup, metadata enrichment, async workers | source ACLs on chunks |
| **P4** | Retrieval that actually works | hybrid BM25 + dense search, RRF, re-ranking, pre/post filtering, eval harness | multi-tenant RLS in pgvector |
| **P5** | Structured + multimodal brain | Pydantic v2 structured outputs, function calling, vision LLM OCR, tables | output validation, data leakage |
| **P6** | **Agentic support agent** | workflows vs autonomous agents, LangGraph, tool use, MCP servers, background queues, human-in-the-loop | tool sandboxing, indirect prompt injection |
| **P7** | Ship it | RAGAS evals, LangSmith/OpenTelemetry tracing, Docker, scaling, full security audit | prompt-injection defense in depth |
| **Capstone** | Pick A (AI Support Co-pilot), B (Internal Knowledge Bot), or C (Invoice/Contract Extractor) from the syllabus | assembly + hardening | end-to-end |

Each project chapter ends with: what you built, the concepts you now actually
understand (recap), and the security layer you added. Projects compound — P2's
memory is added *to the P1 bot*, P4's hybrid search *replaces P1's naive search*.
Nothing is a throwaway demo.

---

## Conventions

- **Chapters** live in `book/chapter-NN-*.md` and carry **small inline code
  snippets** — the piece being discussed at that moment, nothing more. Read in
  order; each chapter assumes the previous project exists. Assembling a
  chapter's snippets in order gives you that chapter's working product.
- **Reference builds:** `code/pN-<name>/` holds one full reference
  implementation per project, kept only for comparison — the book text is the
  source of truth.
- **Provider-agnostic by default.** A thin `providers.py` layer (raw HTTP via
  `httpx`, no vendor SDK lock-in) lets every example run against OpenAI,
  Anthropic, Ollama (local/free), or any OpenAI-compatible endpoint. One env var
  switches providers.
- **Security is a chapter section, not an appendix.** If a feature can leak data
  or be jailbroken, the chapter that adds it also hardens it.
- **Stack:** Python 3.11+, FastAPI, Pydantic v2, PostgreSQL + pgvector, plain
  `httpx` for provider calls, Docker for the database. Node/TypeScript
  equivalents in each chapter's notes.

## Status

- [x] Chapter 1 — P1: The Tracer Bullet (FAQ bot, working Day 1)
- [x] Chapter 2 — P2: Memory & Streaming (learn → implement → test cycles)
- [x] Chapter 3 — P3: Universal Ingestion (learn → implement → test cycles)
- [x] Chapter 4 — P4: Hybrid Retrieval (learn → implement → test cycles)
- [x] Chapter 5 — P5: Structured & Multimodal Outputs (learn → implement → test cycles)
- [x] Chapter 6 — P6: The Agentic Support Agent (learn → implement → test cycles)
- [x] Chapter 7 — P7: Production & Evaluation (learn → implement → test cycles)
- [ ] Capstone
"# agentic_ai_book" 
