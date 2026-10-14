# StudyMate — the course platform for *Building Agentic AI Products*

A Next.js app that turns the `book/*.md` chapters in this repo into a rendered,
trackable course: accounts, a fast markdown reader, a syllabus view, and a time
logger that feeds a streak + LeetCode-style contribution grid.

> Learn by doing. Get out of the tutorial loop and start implementing.

## Features

- **Accounts** — email + password only (bcrypt + JWT session cookie, HttpOnly).
  No OAuth, no third-party auth service.
- **Reader** — the book rendered with syntax-highlighted code blocks (shiki),
  GFM tables, callouts, heading anchors, a scrollspy TOC, a reading-progress
  bar, and per-section / per-chapter completion.
- **Syllabus tabs** — the same book also ships as a structured syllabus
  (modules → topics → labs) with tickable progress.
- **Time logger** — a start/stop timer (survives refresh and navigation; the
  clock runs server-side) plus manual entries with date, duration, chapter
  and notes.
- **Dashboard** — streak, time studied, chapters shipped, a 26-week
  contribution heatmap, weekly bars, today's goal, and what to read next.
- **Multi-syllabus ready** — everything is keyed by `course`/`slug`, so a
  second syllabus is a seed away: its own reading path, labs, stats and
  heatmap on the same dashboard.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
Drizzle ORM + `pg` · PostgreSQL · unified/remark/rehype + shiki for markdown ·
bcryptjs + jose for auth.

## Run it locally

Prerequisites: Node 20+ and PostgreSQL 14+ (Docker works too).

```bash
cd platform
npm install

# 1. configure the connection + session secret
copy .env.example .env        # Windows: copy / macOS-Linux: cp
#    then set DATABASE_URL and a random AUTH_SECRET

# 2. create the database, push the schema, seed the book + syllabus
npm run db:setup

# 3. go
npm run dev
```

Open http://localhost:3000 — register, then start reading.

`npm run db:setup` is idempotent: it creates the database only if missing and
re-seeds by upserting, so it's safe to run again after pulling changes.

### Scripts

| Command            | What it does                                            |
| ------------------ | ------------------------------------------------------- |
| `npm run dev`      | dev server (Turbopack)                                  |
| `npm run build`    | production build                                        |
| `npm run start`    | serve the production build                              |
| `npm run lint`     | ESLint                                                  |
| `npm run db:create`| create `DATABASE_URL`'s database if it doesn't exist    |
| `npm run db:push`  | push the Drizzle schema to the database                 |
| `npm run db:seed`  | import `../book/*.md` + the syllabus CSV                |
| `npm run db:admin` | promote a user: `npm run db:admin -- you@example.com`    |
| `npm run db:setup` | `db:create` → `db:push` → `db:seed`                     |

## Project layout

```
platform/
├── scripts/
│   ├── create-db.ts      # idempotent CREATE DATABASE
│   └── seed.ts           # book/*.md + syllabus CSV → database
└── src/
    ├── app/
    │   ├── page.tsx      # public landing
    │   ├── login/ register/
    │   ├── health/       # liveness probe (GET → 200)
    │   └── (app)/        # authed shell: dashboard, book, book/[slug], time
    ├── components/       # reader, markdown, time logger, app shell
    ├── lib/              # auth, markdown pipeline, queries, server actions
    └── db/               # Drizzle schema + client
```

Content lives **outside** the app and is never edited by it:

- `../book/*.md` — chapter source (8 chapters)
- `../Production RAG & AI Automation Learning Tracker (2026) - Sheet1.csv` —
  syllabus source

Re-run `npm run db:seed` after editing either one.

## How data flows

Mutations go through **Server Actions** (`src/lib/actions/*`) that check the
session themselves, so every page and action is protected without middleware.
Reads go through `src/lib/queries.ts`. Progress is split deliberately:

- **sections** — passive "seen" the moment they scroll into view (throttled
  refresh keeps the read-% live),
- **chapters / syllabus topics** — explicit, you tick them.

## Deploying (later)

Nothing here is localhost-specific:

1. Provision PostgreSQL (Neon, Supabase, Vercel Postgres…) and set
   `DATABASE_URL`.
2. Set `AUTH_SECRET` to a long random string.
3. Push the schema and seed: `npm run db:push && npm run db:seed`.
4. Deploy `platform/` to Vercel — `GET /health` is a ready-made liveness
   endpoint.

The existing local database is only referenced by `.env`, so switching hosts
is a variable change, not a rewrite.

## Testing

End-to-end coverage (register → dashboard → book tabs → reader rendering,
scroll tracking and completion → timer start/stop → manual entry → logout →
login) runs headless in Edge. The suite lives outside the repo in the agent's
temp directory; it exercises the real UI, not mocks.
