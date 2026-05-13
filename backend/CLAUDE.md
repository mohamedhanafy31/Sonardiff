# Backend — Claude Code Guide

Express 5 API + BullMQ worker + Playwright scraper.
Port: **3001**. Language: TypeScript (compiled to `dist/`).

---

## Commands

```bash
pnpm run dev          # ts-node-dev API server (hot reload)
pnpm run dev:worker   # ts-node-dev worker process
pnpm run build        # tsc → dist/
pnpm run start        # node dist/index.js (production)
pnpm run db:generate  # drizzle-kit generate (after schema changes)
pnpm run db:migrate   # apply migrations to DATABASE_URL
pnpm exec tsc --noEmit  # type-check without emitting
```

After every schema change: `db:generate` → inspect SQL for unwanted DROPs →
`db:migrate`. Never hand-edit migration files.

---

## Source layout

```
src/
├── index.ts              Entry — starts HTTP server
├── app.ts                Express app setup, middleware, route mounting
├── worker.ts             Entry — starts BullMQ workers (import from worker/jobs.ts)
│
├── db/
│   ├── index.ts          Drizzle client (singleton)
│   ├── schema.ts         Single source of truth for all tables
│   └── migrations/       Generated SQL (0000… onwards)
│
├── engine/
│   ├── scraper.ts        Tiered fetcher: HTTP → Playwright → Playwright+stealth
│   ├── diff.ts           Text diff engine (diff library), threshold gate
│   ├── alert.ts          Email via Resend; renders diff HTML
│   └── fingerprint.ts    CSS selector recovery via DOM fingerprinting
│
├── lib/
│   ├── config.ts         All env vars + plan limits (single source of truth)
│   ├── auth.ts           bcrypt helpers, session token generation
│   ├── dom-picker-session.ts  Playwright session pool for DOM picker
│   ├── crawl.ts          Site discovery / sitemap crawler
│   └── logger.ts         Pino logger
│
├── middlewares/
│   └── requireAuth.ts    Session cookie → req.user
│
├── routes/
│   ├── auth.ts           POST /auth/register, login, logout, GET /auth/me
│   ├── monitors.ts       CRUD + manual trigger + quota gate
│   ├── monitor-groups.ts Group CRUD
│   ├── dashboard.ts      Aggregated stats for dashboard page
│   └── dom-picker.ts     Visual element picker API (Pro only)
│
└── worker/
    └── jobs.ts           All BullMQ processors + system job registration
```

---

## Database schema (key tables)

All in `src/db/schema.ts`. Never edit migrations by hand.

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | varchar | unique |
| `password_hash` | text | bcrypt; deprecated once Supabase migrates |
| `plan` | enum | `free` \| `pro` |
| `plan_limit` | int | 150 (free) / 36 000 (pro) |
| `checks_used_this_period` | int | atomic quota counter |
| `period_reset_at` | timestamptz | set to 1st of next month on reset |

### `monitors`
| Column | Type | Notes |
|---|---|---|
| `css_selector` | text | nullable; Pro only |
| `threshold` | real | 0–1 fraction; default 0.01 (1%) |
| `fetcher_tier` | smallint | 1/2/3; null = auto-detect |
| `element_fingerprint` | jsonb | nullable; set after first successful pick |
| `status` | enum | `active` \| `paused` \| `unreachable` |

### `snapshots`
| Column | Type | Notes |
|---|---|---|
| `content` | text | post-selector, post-exclusion text (primary path) |
| `content_hash` | text | SHA-256 hex for duplicate detection |
| `diff_html` | text | pre-rendered HTML fragment for email |
| `html_path`, `text_path`, `screenshot_path` | text | legacy file paths (dual-write, drop in Phase 9) |

### `diffs`
References two `snapshots` rows. `diff_path` is a legacy FS path (Phase 4 removes it).

### `alerts`
Links `users` → `monitors` → `diffs`. Status: `pending` → `sent` / `failed`.

---

## Worker queues

| Queue | Processor | Triggered by |
|---|---|---|
| `scrape-queue` | `scrapeWorker` in `jobs.ts` | Poller every 60 s; manual via API |
| `system-queue` | `systemWorker` | Poller registration, GC (3 AM), quota reset (1st) |
| `alert-queue` | `alertWorker` | After a diff exceeds threshold |

**Quota gate** (jobs.ts ~line 78-84): atomic `UPDATE … WHERE checks_used_this_period + 1 <= plan_limit` — if no rows updated, job is skipped with `reason: 'quota_exceeded'`.

---

## Tiered fetcher (`engine/scraper.ts`)

```
Tier 1 — plain fetch()    → fast, no JS
Tier 2 — Playwright        → SPA / JS-heavy
Tier 3 — Playwright+stealth → Cloudflare-protected
```

On first run (`fetcher_tier IS NULL`): try Tier 1. If bot-blocked → Tier 3. If JS-light
but no content → Tier 2. Result is stored in `monitors.fetcher_tier` for subsequent runs.

---

## DOM picker (`lib/dom-picker-session.ts` + `routes/dom-picker.ts`)

Pro-only. Keeps a pool of ≤5 live Playwright sessions (2-min idle TTL, LRU eviction).

**Session lifecycle:**
1. `POST /dom-picker/screenshot` → `getSessionPage(url)` → cold launch or cache hit.
   On **cold launch**: navigate → `scrollAndSettle()` (triggers lazy loading) →
   store session.
   On **cache hit**: call `scrollAndSettle()` again inside the route before screenshot.
2. `POST /dom-picker/resolve` → hit-test (x,y) → return selector + ancestors/children.
3. `POST /dom-picker/inspect-selector` → navigate by selector for Wider/Narrower UX.
4. `POST /dom-picker/close-session` → evict session immediately (called on modal close
   or Refresh button click).

**Coordinate system:** all element `box` values are absolute page coordinates captured
at `scrollTop=0`. The frontend converts display coordinates → native via
`getBoundingClientRect()` scale factors.

---

## Environment variables

All read through `src/lib/config.ts`. Required at startup:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | BullMQ backing store |
| `SESSION_SECRET` | 64+ char secret for session tokens |
| `RESEND_API_KEY` | Email alerts via Resend |
| `RESEND_FROM` | Sender address (default `hanafy@sonardiff.com`) |
| `CHROMIUM_PATH` | Optional; defaults to Playwright's bundled Chromium |
| `PROXY_URL` | Optional HTTP proxy for scraper |
| `DATA_DIR` | Legacy file storage root (default `./data`) |

---

## Auth flow

`requireAuth` middleware (`src/middlewares/requireAuth.ts`):
1. Reads `sd_session` cookie.
2. Looks up `sessions` table; checks `expires_at`.
3. Sliding renewal: if session expires in < 7 days, extend by 30 days.
4. Attaches `req.user` (User row).

All routes under `/api/*` require auth except `POST /api/auth/register` and
`POST /api/auth/login`.

---

## Rules

- Build must pass before committing: `pnpm run build`.
- Typechecks must pass: `pnpm exec tsc --noEmit`.
- Never drop DB columns without a migration and a Phase 9 sign-off.
- `getUniqueSelector` and `describe` helpers in `dom-picker.ts` are duplicated across
  three routes — fix tracked in `artifacts/task.md` Bug 7 before adding a fourth copy.
- DOM picker routes require `plan === 'pro'` — enforced by the router-level middleware
  at the top of `routes/dom-picker.ts`.
