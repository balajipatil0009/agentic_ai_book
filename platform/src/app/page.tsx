import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Flame,
  Hammer,
  Lock,
  Radar,
  Sparkles,
  Timer,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'StudyMate — Get out of the tutorial loop',
};

const LADDER = [
  { id: 'P1', name: 'Business FAQ chatbot', note: 'Works on Day 1 — embeddings, pgvector, citations' },
  { id: 'P2', name: 'Memory & streaming', note: 'Multi-turn, SSE, prompt caching, cost' },
  { id: 'P3', name: 'Ingest anything', note: 'PDF / URL / CSV, chunking, dedup, async workers' },
  { id: 'P4', name: 'Retrieval that works', note: 'Hybrid BM25 + dense, RRF, re-ranking, evals' },
  { id: 'P5', name: 'Structured + multimodal', note: 'Pydantic v2, tool calling, vision OCR' },
  { id: 'P6', name: 'Agentic support agent', note: 'LangGraph, MCP, queues, human-in-the-loop' },
  { id: 'P7', name: 'Ship it', note: 'RAGAS, tracing, Docker, full security audit' },
];

const METHOD = [
  {
    icon: Hammer,
    title: 'Learn by doing',
    body: 'You build a real, working product on Day 1. Concepts are pulled in on demand — right before the product needs them, never before.',
  },
  {
    icon: Radar,
    title: 'Out of the tutorial loop',
    body: 'No "finish the chapter, then build". Every chapter is an upgrade patch to a bot you already own. Nothing is a throwaway demo.',
  },
  {
    icon: Lock,
    title: 'Security is not an appendix',
    body: 'If a feature can leak data or be jailbroken, the chapter that adds it also hardens it. Secrets, RLS, prompt injection — as you go.',
  },
  {
    icon: Sparkles,
    title: 'Industry-ready stack',
    body: 'Python, FastAPI, Pydantic v2, PostgreSQL + pgvector, LangGraph, RAGAS, OpenTelemetry — the tools teams actually ship with.',
  },
];

const ROADMAP = [
  { title: 'Building Agentic AI Products', meta: '8 chapters · 157h · live now', state: 'live' },
  { title: 'Production RAG & AI Automation', meta: 'Labs, evaluators, ingestion at scale', state: 'next' },
  { title: 'LLM Evaluation & Safety', meta: 'Red-teaming, guardrails, offline evals', state: 'next' },
];

/** Deterministic pseudo-random heatmap sample for the marketing preview. */
function sampleLevel(index: number): number {
  const value = Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
  const rhythm = (Math.sin(index / 9) + 1) / 2;
  const score = value * 0.65 + rhythm * 0.35;
  if (score < 0.26) return 0;
  if (score < 0.5) return 1;
  if (score < 0.72) return 2;
  if (score < 0.88) return 3;
  return 4;
}

function SampleHeatmap() {
  const cells = Array.from({ length: 26 * 7 }, (_, index) => index);
  return (
    <div className="flex flex-wrap gap-[3px]">
      {cells.map((index) => (
        <span
          key={index}
          className={`heat-cell heat-${sampleLevel(index)}`}
          style={{ opacity: index > 26 * 7 - 14 ? 0.35 : 1 }}
        />
      ))}
    </div>
  );
}

function TerminalMock() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 glow-emerald" aria-hidden />

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[#0a0c11] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.95)]">
        <div className="flex items-center gap-2 border-b border-[var(--line)] bg-white/[0.03] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-2 font-mono text-[0.7rem] text-[var(--faint)]">
            p1-faq-bot — day 1
          </span>
        </div>

        <div className="space-y-3 p-4 font-mono text-[0.78rem] leading-relaxed">
          <div className="fade-up" style={{ animationDelay: '0.15s' }}>
            <span className="text-emerald-400">$</span>{' '}
            <span className="text-[#c9d1d9]">curl -X POST localhost:8000/ask \</span>
          </div>
          <div className="fade-up pl-4 text-[#8b949e]" style={{ animationDelay: '0.35s' }}>
            -H &quot;X-API-Key: $KEY&quot; \
            <br />
            -d &#x27;&#123;&quot;question&quot;: &quot;Why did I pay 4.90 for
            shipping?&quot;&#125;&#x27;
          </div>

          <div className="fade-up rounded-lg border border-[var(--line)] bg-black/40 p-3" style={{ animationDelay: '0.7s' }}>
            <div className="text-[#8b949e]">{'{'}</div>
            <div className="pl-3">
              <span className="text-sky-300">&quot;answer&quot;</span>
              <span className="text-[#8b949e]">: </span>
              <span className="text-emerald-300">
                &quot;Standard shipping is free above EUR 49; below that it costs EUR 4.90 [1].&quot;
              </span>
            </div>
            <div className="pl-3">
              <span className="text-sky-300">&quot;sources&quot;</span>
              <span className="text-[#8b949e]">: </span>
              <span className="text-[#c9d1d9]">[faqs · Shipping · 0.83]</span>
            </div>
            <div className="text-[#8b949e]">{'}'}</div>
          </div>

          <div
            className="fade-up flex flex-wrap items-center gap-2 pt-1"
            style={{ animationDelay: '1s' }}
          >
            <span className="pill !border-emerald-400/25 !bg-emerald-400/10 !text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> cited, not hallucinated
            </span>
            <span className="pill">
              <Timer className="h-3 w-3" /> 47 min to build
            </span>
          </div>
        </div>
      </div>

      <div
        className="fade-up absolute -bottom-5 -left-4 hidden rounded-xl border border-[var(--line)] bg-[#12141a] px-3.5 py-2.5 shadow-xl sm:block"
        style={{ animationDelay: '1.25s' }}
      >
        <div className="flex items-center gap-2 text-[0.72rem]">
          <Flame className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-mono tabular-nums text-[0.9rem] font-semibold">12</span>
          <span className="text-[var(--muted)]">-day streak</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[620px]" aria-hidden />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[560px] w-[760px] -translate-x-1/2 glow-emerald"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-0 top-[380px] h-[460px] w-[460px] glow-violet"
        aria-hidden
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[#08090d]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-3 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-content-center rounded-lg bg-emerald-400/15 text-sm font-bold text-emerald-300">
              S
            </span>
            <span className="text-[0.95rem] font-semibold tracking-tight">StudyMate</span>
          </Link>

          <nav className="ml-8 hidden items-center gap-6 text-sm text-[var(--muted)] md:flex">
            <a href="#method" className="transition hover:text-white">
              The method
            </a>
            <a href="#ladder" className="transition hover:text-white">
              Project ladder
            </a>
            <a href="#roadmap" className="transition hover:text-white">
              Roadmap
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <Link href="/login" className="btn btn-ghost !py-1.5">
              Sign in
            </Link>
            <Link href="/register" className="btn btn-primary !py-1.5">
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-[1180px] px-5 pb-24 pt-16 sm:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="pill">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              8 chapters · 7 projects · 157h syllabus
            </span>

            <h1 className="mt-6 text-[clamp(2.5rem,6vw,4.2rem)] font-semibold leading-[1.03] tracking-[-0.035em]">
              Get out of the
              <br />
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-lime-200 bg-clip-text text-transparent">
                tutorial loop.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-[var(--muted)]">
              Stop watching videos about building things. On <strong className="text-white">Day 1</strong>{' '}
              you ship a working agentic product — then every concept after that arrives only because
              the next feature demanded it. Theory pulled in on demand, security built in as you go.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className="btn btn-primary !py-2.5 !px-5 !text-[0.95rem]">
                Start Chapter 1 — free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#ladder" className="btn btn-ghost !py-2.5 !px-5 !text-[0.95rem]">
                See what you build
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.8rem] text-[var(--faint)]">
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" /> first working bot in 47 minutes
              </span>
              <span className="flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" /> streaks, time logs &amp; heatmap
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> completion tracking per section
              </span>
            </div>
          </div>

          <TerminalMock />
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[var(--line)] bg-white/[0.015]">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-px px-5 sm:grid-cols-4">
          {[
            ['Day 1', 'working product, not a hello-world'],
            ['8', 'chapters in build order, not topic order'],
            ['157h', 'mapped syllabus with hands-on labs'],
            ['100%', 'provider-agnostic — OpenAI, Anthropic or Ollama'],
          ].map(([value, label]) => (
            <div key={value} className="px-1 py-7">
              <div className="text-[1.9rem] font-semibold tracking-tight tabular-nums">{value}</div>
              <div className="mt-1.5 text-[0.78rem] leading-snug text-[var(--muted)]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Method */}
      <section id="method" className="mx-auto max-w-[1180px] scroll-mt-24 px-5 py-20">
        <div className="max-w-2xl">
          <p className="text-[0.78rem] uppercase tracking-[0.18em] text-emerald-300">The method</p>
          <h2 className="mt-3 text-[clamp(1.8rem,3.5vw,2.6rem)] font-semibold leading-tight tracking-tight">
            Learn by doing, then understand why it works.
          </h2>
          <p className="mt-4 text-[1rem] leading-relaxed text-[var(--muted)]">
            Every other AI book does theory, theory, theory — then a lab that somehow uses everything
            at once. You forget chapter 2 by the time you reach chapter 6. We invert it.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {METHOD.map((item) => (
            <div key={item.title} className="card card-hover p-6">
              <span className="grid h-9 w-9 place-content-center rounded-lg bg-emerald-400/12 text-emerald-300">
                <item.icon className="h-4.5 w-4.5" />
              </span>
              <h3 className="mt-4 text-[1.05rem] font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-[var(--muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ladder */}
      <section id="ladder" className="scroll-mt-24 border-y border-[var(--line)] bg-white/[0.015] py-20">
        <div className="mx-auto max-w-[1180px] px-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-[0.78rem] uppercase tracking-[0.18em] text-violet-300">
                The project ladder
              </p>
              <h2 className="mt-3 text-[clamp(1.8rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-tight">
                Seven upgrades to one product you already own.
              </h2>
            </div>
            <p className="max-w-sm text-[0.9rem] leading-relaxed text-[var(--muted)]">
              P2&apos;s memory is added <em>to</em> the P1 bot. P4&apos;s hybrid search{' '}
              <em>replaces</em> P1&apos;s naive search. Nothing gets thrown away.
            </p>
          </div>

          <ol className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {LADDER.map((step, index) => (
              <li key={step.id} className="card card-hover relative flex gap-4 p-5">
                <span className="grid h-9 w-9 shrink-0 place-content-center rounded-lg border border-white/10 bg-black/30 font-mono text-[0.78rem] font-semibold text-emerald-300">
                  {step.id}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[0.98rem] font-semibold tracking-tight">{step.name}</h3>
                    {index === 0 ? (
                      <span className="rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-wider text-emerald-300">
                        day 1
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[0.83rem] leading-snug text-[var(--muted)]">{step.note}</p>
                </div>
              </li>
            ))}

            <li className="card flex gap-4 border-dashed p-5">
              <span className="grid h-9 w-9 shrink-0 place-content-center rounded-lg border border-white/10 bg-black/30 font-mono text-[0.78rem] font-semibold text-violet-300">
                ★
              </span>
              <div>
                <h3 className="text-[0.98rem] font-semibold tracking-tight">Capstone</h3>
                <p className="mt-1.5 text-[0.83rem] leading-snug text-[var(--muted)]">
                  Ship one of three real products: AI support co-pilot, internal knowledge bot, or
                  invoice &amp; contract extractor.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Progress */}
      <section className="mx-auto max-w-[1180px] px-5 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-[0.78rem] uppercase tracking-[0.18em] text-emerald-300">
              Progress that keeps you honest
            </p>
            <h2 className="mt-3 text-[clamp(1.8rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-tight">
              Streaks, minutes and green dots.
            </h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-[var(--muted)]">
              A timer that follows you through every chapter, manual logs for the work you did
              offline, and a dashboard that shows exactly where you stand — current streak, longest
              streak, completion per chapter and a contribution grid you won&apos;t want to break.
            </p>

            <ul className="mt-6 space-y-2.5 text-[0.9rem]">
              {[
                'Start / stop timer attached to the chapter you are reading',
                'Manual entries with date, duration, chapter and notes',
                'LeetCode-style activity grid over the last 26 weeks',
                'Completion tracked per section, chapter and syllabus lab',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span className="text-[var(--muted)]">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.14em] text-[var(--faint)]">
                  Your consistency
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[2rem] font-semibold leading-none tabular-nums">12</span>
                  <span className="flex items-center gap-1 text-[0.85rem] text-amber-300">
                    <Flame className="h-3.5 w-3.5" /> day streak
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[0.7rem] uppercase tracking-[0.14em] text-[var(--faint)]">
                  Completion
                </div>
                <div className="mt-1 text-[2rem] font-semibold leading-none tabular-nums">64%</div>
              </div>
            </div>

            <div className="mt-6">
              <SampleHeatmap />
            </div>

            <div className="mt-5 flex items-center justify-between text-[0.7rem] text-[var(--faint)]">
              <span>Less</span>
              <span className="flex items-center gap-[3px]">
                <span className="heat-cell heat-0" />
                <span className="heat-cell heat-1" />
                <span className="heat-cell heat-2" />
                <span className="heat-cell heat-3" />
                <span className="heat-cell heat-4" />
              </span>
              <span>More</span>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="scroll-mt-24 border-t border-[var(--line)] bg-white/[0.015] py-20">
        <div className="mx-auto max-w-[1180px] px-5">
          <p className="text-[0.78rem] uppercase tracking-[0.18em] text-violet-300">Roadmap</p>
          <h2 className="mt-3 max-w-2xl text-[clamp(1.8rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-tight">
            This is syllabus one. More are coming.
          </h2>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-[var(--muted)]">
            The platform is built for many syllabuses — same dashboard, same streaks, same
            learn-by-doing structure. New tracks ship as they are ready.
          </p>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {ROADMAP.map((track) => (
              <div
                key={track.title}
                className={`card card-hover p-5 ${track.state === 'live' ? 'border-emerald-400/25' : 'border-dashed'}`}
              >
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] uppercase tracking-wider ${
                    track.state === 'live'
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                      : 'border-white/10 text-[var(--faint)]'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      track.state === 'live' ? 'bg-emerald-400' : 'bg-white/25'
                    }`}
                  />
                  {track.state === 'live' ? 'live' : 'coming soon'}
                </span>
                <h3 className="mt-3.5 text-[1.02rem] font-semibold leading-snug tracking-tight">
                  {track.title}
                </h3>
                <p className="mt-2 text-[0.84rem] leading-snug text-[var(--muted)]">{track.meta}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden py-24">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 glow-emerald"
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1180px] px-5 text-center">
          <h2 className="text-[clamp(2rem,4.5vw,3.1rem)] font-semibold leading-tight tracking-tight">
            Stop tutorials.
            <br />
            <span className="bg-gradient-to-r from-emerald-300 to-lime-200 bg-clip-text text-transparent">
              Start implementing.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[1rem] leading-relaxed text-[var(--muted)]">
            Create an account, open Chapter 1, and 47 minutes later you&apos;ll have a bot that
            answers real questions with real citations.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/register" className="btn btn-primary !py-2.5 !px-6 !text-[0.95rem]">
              Create free account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="btn btn-ghost !py-2.5 !px-6 !text-[0.95rem]">
              I already have one
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--line)] py-8">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-5 text-[0.8rem] text-[var(--faint)]">
          <span className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-content-center rounded bg-emerald-400/15 text-[0.6rem] font-bold text-emerald-300">
              S
            </span>
            StudyMate — learn by doing.
          </span>
          <span>Built from the Building Agentic AI Products book.</span>
        </div>
      </footer>
    </div>
  );
}
