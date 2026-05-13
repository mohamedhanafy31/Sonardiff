# SonarDiff MVP

Website change monitoring platform. Tracks any URL on a schedule, diffs the visible text content, and emails you when something changes — with noise controls you can tune.

## What's in here

```
mvp/
├── backend/        Express API + BullMQ worker + Drizzle ORM
├── frontend/       Next.js dashboard (App Router)
├── docker-compose.yml          Full stack (Postgres + Redis + backend + frontend)
└── docker-compose.override.yml Dev overrides (bind mounts, port exposure)
```

## Quick start (Docker)

```bash
# Copy and fill env
cp backend/.env.example backend/.env

# Start everything
docker compose up --build

# API:      http://localhost:3001
# Dashboard: http://localhost:3000
```

## Quick start (local dev)

Prerequisites: Node 20+, pnpm, Postgres 16, Redis 7.

```bash
# 1. Start infra (Postgres on 5433, Redis on 6379)
docker compose up db redis -d

# 2. Backend
cd backend
cp .env.example .env   # fill DATABASE_URL, REDIS_URL, SESSION_SECRET, RESEND_API_KEY
pnpm install
pnpm run db:migrate
pnpm run dev           # API server on :3001

# 3. Worker (separate terminal)
cd backend
pnpm run dev:worker

# 4. Frontend (separate terminal)
cd frontend
pnpm install
pnpm run dev           # Dashboard on :3000
```

## Architecture overview

```
Browser → Next.js (frontend) → Express API (backend) → Postgres (Drizzle)
                                         ↕
                               BullMQ (Redis queues)
                                         ↕
                               Worker: scrape → diff → alert
```

The worker runs in a separate process (`src/worker.ts`) and processes three queues:

| Queue | Purpose |
|---|---|
| `scrape-queue` | Per-monitor check jobs |
| `system-queue` | Poller (60s), GC (3 AM daily), quota reset (1st of month) |
| `alert-queue` | Email dispatch via Resend |

## Plans

| Plan | Monitors | Min interval | Monthly checks |
|---|---|---|---|
| Free | 5 | 24h | 150 |
| Pro | 50 | 1h | 36,000 |

## Tiered fetcher

Scraper auto-detects the right strategy per site and remembers it:

| Tier | Strategy | When used |
|---|---|---|
| 1 | Plain HTTP (`fetch`) | Static pages |
| 2 | Headless Chromium (Playwright) | JS-rendered SPAs |
| 3 | Headless + stealth plugin | Cloudflare / bot-protected sites |

## Environment variables

See `backend/.env.example` for the full list. Required at runtime:

- `DATABASE_URL` — Postgres connection string
- `SESSION_SECRET` — 64+ char random string
- `RESEND_API_KEY` — for email alerts
