# SonarDiff Backend

Express 5 API server + BullMQ worker. Handles auth, monitor CRUD, scheduled scraping, diffing, and email alerts.

## Stack

- **Runtime:** Node 20, TypeScript (ESM)
- **Framework:** Express 5
- **DB:** PostgreSQL 16 via Drizzle ORM
- **Queue:** BullMQ (Redis)
- **Scraping:** Playwright + stealth plugin (Chromium)
- **HTML parsing:** Cheerio
- **Email:** Resend
- **Logging:** Pino

## Setup

```bash
pnpm install
cp .env.example .env   # fill required vars
pnpm run db:migrate
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm run dev` | API server with hot reload (`tsx watch`) |
| `pnpm run dev:worker` | Worker process with hot reload |
| `pnpm run build` | Compile TypeScript to `dist/` |
| `pnpm run start` | Run compiled API server |
| `pnpm run start:worker` | Run compiled worker |
| `pnpm run db:generate` | Generate Drizzle migration from schema changes |
| `pnpm run db:migrate` | Apply pending migrations |
| `pnpm run db:studio` | Open Drizzle Studio (DB browser) |

## Source layout

```
src/
├── index.ts          Entry point — starts Express, mounts routes
├── worker.ts         Entry point — starts BullMQ workers
├── app.ts            Express app setup, middleware, route mounting
├── db/
│   ├── schema.ts     Drizzle schema (all tables + relations)
│   ├── index.ts      DB client (postgres.js)
│   └── migrations/   Generated SQL migrations
├── engine/
│   ├── scraper.ts    Tiered HTTP/Playwright scraper + text extraction
│   ├── diff.ts       Text diff, threshold logic, HTML fragment renderer
│   ├── alert.ts      Resend email sender (change + element-missing)
│   └── fingerprint.ts CSS selector recovery via element fingerprinting
├── worker/
│   └── jobs.ts       BullMQ workers: scrape, system, alert
├── routes/
│   ├── auth.ts       Register, login, logout, /me
│   ├── monitors.ts   Monitor CRUD, manual check trigger, diff history
│   ├── dashboard.ts  Aggregated stats for the dashboard
│   └── dom-picker.ts Preview endpoint for CSS selector testing
├── middlewares/
│   └── requireAuth.ts Session cookie auth guard
└── lib/
    ├── config.ts     Typed env config + plan limits
    ├── auth.ts       bcrypt helpers, session management
    └── logger.ts     Pino logger (file + stdout)
```

## Database schema

| Table | Purpose |
|---|---|
| `users` | Account, plan, quota counters |
| `sessions` | Cookie-based auth sessions |
| `monitors` | Watched URLs with check config |
| `snapshots` | Per-check captured content + diff HTML |
| `diffs` | Change records linking two snapshots |
| `alerts` | Alert audit trail (pending / sent / failed) |

Key columns added in the MVP upgrade:
- `monitors.fetcher_tier` — remembered scrape strategy (1/2/3)
- `monitors.element_fingerprint` — JSONB fingerprint for selector recovery
- `monitors.status` — `active` / `paused` / `unreachable`
- `snapshots.content` — full extracted text stored in DB (no file read needed)
- `snapshots.diff_html` — pre-rendered diff HTML stored at snapshot time

## API routes

All routes under `/api`. Protected routes require a valid session cookie.

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login, sets session cookie |
| POST | `/api/auth/logout` | Yes | Clear session |
| GET | `/api/auth/me` | Yes | Current user info |

### Monitors
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/monitors` | Yes | List user's monitors |
| POST | `/api/monitors` | Yes | Create monitor |
| GET | `/api/monitors/:id` | Yes | Get monitor detail |
| PATCH | `/api/monitors/:id` | Yes | Update monitor |
| DELETE | `/api/monitors/:id` | Yes | Delete monitor |
| POST | `/api/monitors/:id/check` | Yes (Pro) | Trigger manual check |
| GET | `/api/monitors/:id/diffs` | Yes | List diffs for monitor |
| GET | `/api/monitors/:id/diffs/:diffId` | Yes | Get diff detail |

### Dashboard
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard` | Yes | Stats overview |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `SESSION_SECRET` | Yes | 64+ char random secret for session signing |
| `RESEND_API_KEY` | Yes | Resend API key for email alerts |
| `PORT` | No | Server port (default: `3001`) |
| `BASE_URL` | No | Public base URL (default: `http://localhost:3001`) |
| `PROXY_URL` | No | Optional HTTP proxy for scraper |
| `DATA_DIR` | No | Directory for snapshot/diff files (default: `./data`) |
| `LOGS_DIR` | No | Directory for log files (default: `./logs`) |
| `CHROMIUM_PATH` | No | Path to Chromium binary (set in Dockerfile) |

## Tiered scraper

`scrapeUrl()` auto-detects and remembers the best strategy per site:

1. **Tier 1 (HTTP):** Plain `fetch` with Chrome UA, 10s timeout. Used for static pages. No screenshot.
2. **Tier 2 (Headless):** Playwright Chromium, no stealth. Used when page has < 500 chars of body text (JS-rendered).
3. **Tier 3 (Stealth):** Playwright + `puppeteer-extra-plugin-stealth`. Used when Cloudflare or bot detection is present.

The tier is saved to `monitors.fetcher_tier` and reused on subsequent checks.

## Adaptive fingerprint

When a CSS selector no longer matches, `relocateElement()` attempts recovery in order:
1. Match by element `id`
2. Match by `tag + class names`
3. Match by stored `domPath`
4. Fuzzy match by tag + text preview (only if exactly one candidate)

If recovery fails, the monitor is marked `unreachable` and a distinct email alert is sent.
