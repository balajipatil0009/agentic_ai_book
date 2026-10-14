# Plan — Login tracking + admin dashboard

Status: **planned, not implemented.**
Confirmed decisions: both sign-in events *and* online time · `role` column + CLI promote script ·
overview + users table + activity feed · store IP and user agent on each sign-in.

---

## 1. Schema — `platform/src/db/schema.ts`

```ts
users        + role: 'user' | 'admin'   (default 'user')

login_events   id, userId, kind: 'login' | 'logout', occurredAt, ip, userAgent
user_sessions  id, userId, startedAt, lastSeenAt, endedAt?, activeSeconds
```

Indexes:

- `user_sessions(user_id)` — per-user session history
- `user_sessions(last_seen_at)` — the "online now" lookup
- `login_events(user_id, occurred_at desc)` — the audit feed

Migrated with the existing `npm run db:push`; `npm run db:setup` stays idempotent.

Failed logins are **not** recorded by default (no user to attribute them to) —
addable later as `kind: 'failed'` keyed by email.

## 2. Session & event capture — `src/lib/auth.ts`, `src/lib/actions/auth.ts`

- JWT gains a `sid` claim; every sign-in creates a `user_sessions` row.
- `loginAction`: insert `login_events('login', ip, userAgent)` (from `headers()`) **and** open a
  session row.
- `logoutAction`: final heartbeat, close the session (`endedAt`), insert `login_events('logout')`,
  clear the cookie.
- Cookies issued before this change (no `sid`) degrade gracefully — heartbeats no-op, auth still
  works.
- `getSessionUser()` also returns `role`, so admin gating reuses the existing session query.

## 3. Live presence — `src/lib/actions/track.ts` + `src/components/session-pulse.tsx`

- A `SessionPulse` client component mounted once in the app shell: 60s interval, skips ticks while
  the tab is hidden, ticks immediately when it becomes visible again.
- The heartbeat is a single atomic SQL statement:
  `activeSeconds += LEAST(now() - lastSeenAt, 10 min); lastSeenAt = now()`
  → idle/closed-tab time is never counted and multiple tabs cannot race.

Definitions used everywhere in the UI:

| Term            | Meaning                                             |
| --------------- | --------------------------------------------------- |
| Logged-in time  | `Σ activeSeconds`                                   |
| Last seen       | last heartbeat                                      |
| Online now      | `endedAt IS NULL AND lastSeenAt > now() - 2 min`    |

> **Assumption to confirm before implementation:** idle cap of 10 minutes and hidden tabs not
> counting. Alternative: plain wall-clock time from login to logout.

## 4. Admin authorization

- `platform/scripts/make-admin.ts` → `npm run db:admin -- you@example.com`
- `src/app/(app)/admin/layout.tsx`: server-side `requireAdmin()`; non-admins redirect to
  `/dashboard`.
- `AppShell` renders the **Admin** nav item only when `user.role === 'admin'` (its `user` type gains
  `role`).

## 5. The dashboard — `src/app/(app)/admin/page.tsx` + `src/components/admin/`

Server-rendered, driven by `searchParams` — search and sort are a plain GET form and links, so no
client state is needed (and none of the React 19 `set-state-in-effect` lint rules are touched).

- **KPI strip** — total users · online now · sign-ins today · active time today · new this week
- **Live now** — green dot + "active for Xm"
- **Users table** — name/email, role, last seen (relative), logged-in time, sessions, sign-ins (7d),
  studied time + chapters completed (joins the existing `study_sessions` / `chapter_progress`).
  Sortable by last-seen / logged-in time / sign-ins; searchable by name or email.
- **Recent sign-ins feed** — last 25 rows: user, time, browser, IP.
- **14-day bars** — sign-ins per day, same visual style as the dashboard's week bars.
- Empty states for a fresh install; reuses `card`, `btn` and stat-cell styles from the design system.

Aggregations live in `src/lib/queries.ts`:

```ts
getAdminOverview()                 // KPI numbers
getAdminUsers({ q, sort })         // roster with per-user aggregates
getRecentLogins(limit)             // audit feed
getSignInSeries(days)              // bar chart data
```

## 6. Verification

1. `npx tsc --noEmit` · `npm run lint` · `npm run build`
2. Extended headless E2E suite:
   - non-admin is redirected from `/admin` and sees no Admin nav link
   - promote the test user via `npm run db:admin`, re-login → `/admin` renders
   - KPIs populate; the signed-in user's row shows non-zero logged-in time
   - feed shows both the sign-in and the logout; search + sort work
   - one ~70s wait to prove the heartbeat actually ticks logged-in time
3. Inspect admin screenshots visually, as with the rest of the app.

## Non-goals

- No retention/purge job (local-first; rows are small).
- No per-user detail page (`/admin/users/[id]`) — possible follow-up.
- No websocket push; 2-minute freshness for "online now" is enough.

## Implementation order

1. Schema + `db:push` + `scripts/make-admin.ts`
2. Auth: `sid` claim, session rows, login/logout events
3. Heartbeat action + `SessionPulse` in the app shell
4. Admin layout guard + nav visibility
5. Admin queries + page + components
6. Tests, lint/tsc/build, screenshots
