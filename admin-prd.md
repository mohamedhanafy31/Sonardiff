# SonarDiff Admin Dashboard — PRD

**Audience:** SaaS owner (internal tool, single operator)  
**Placement:** `artifacts/mvp/` — lives inside the same monorepo, shares the backend  
**Status:** Planned — not yet started

---

## 1. Problem Statement

Running SonarDiff in production means flying blind. The owner has no visibility into
what users are doing, whether the scrape worker is healthy, how much disk the snapshot
files are consuming, or which alert emails failed to deliver. All of this currently
requires direct Postgres queries and Redis CLI commands. The admin dashboard replaces
that with a purpose-built operator interface.

---

## 2. Goals

| Goal | Metric |
|---|---|
| Reduce time to diagnose a stuck queue | < 30 s from opening the dashboard |
| Identify a problematic user (quota abuse, bad URLs) | < 1 min |
| Upgrade or reset a user's plan without touching the DB | Click + confirm |
| See platform-wide health at a glance | Single overview page, no scrolling |
| Audit past admin actions | Persistent log, searchable |

---

## 3. Non-Goals

- No multi-admin role system — a single `ADMIN_PASSWORD` env var is sufficient for now
- No billing / Stripe integration — revenue cards are stubs with hardcoded zeros
- No real-time WebSocket streaming — 10-second polling is acceptable
- No mobile layout — admin uses desktop only

---

## 4. Admin Authentication

The existing `ADMIN_PASSWORD` env var in `src/lib/config.ts` is repurposed as the
sole credential. A separate admin session mechanism is needed so admin state does not
bleed into user sessions.

### Strategy

- New table: `admin_sessions` (`id TEXT PK`, `expiresAt TIMESTAMPTZ`)
- No user linkage — admin is a single operator identity
- Login: `POST /api/admin/auth/login` with `{ password }` → sets `sd_admin` cookie
- Middleware: `requireAdmin.ts` reads `sd_admin` cookie, validates against
  `admin_sessions`, attaches `req.isAdmin = true`
- All `/api/admin/*` routes are protected by `requireAdmin`
- Admin sessions expire after 8 hours (no sliding renewal)
- The frontend admin group at `app/(admin)/` has its own layout that redirects to
  `/admin/login` on a 401

### Login Page

`/admin/login` — standalone page outside the `(admin)` guard group.

Components:
- SonarDiff logo (small)
- Password input (type=password)
- "Sign in as admin" button
- Error state: "Incorrect password"
- On success → redirect to `/admin/overview`

---

## 5. Page Inventory

```
app/
└── (admin)/
    ├── layout.tsx              Admin shell: sidebar + topbar
    ├── overview/page.tsx       Platform KPIs
    ├── users/
    │   ├── page.tsx            User table
    │   └── [id]/page.tsx       User detail + actions
    ├── monitors/page.tsx       Global monitor table
    ├── queues/page.tsx         BullMQ queue health
    ├── alerts/page.tsx         Alert delivery log
    ├── storage/page.tsx        Snapshot disk usage
    └── settings/page.tsx       Feature flags + plan config overrides
```

---

## 6. Page Specifications

---

### 6.1 Overview (`/admin/overview`)

The single page an operator opens first. All data is from a single
`GET /api/admin/stats` endpoint — one round-trip.

#### KPI Cards (top row)

| Card | Value | Sub-label |
|---|---|---|
| Total Users | Count of all users | Free: N / Pro: N |
| Active Monitors | Count where `isActive = true` | Paused: N / Unreachable: N |
| Checks Today | `checksUsedThisPeriod` summed across all users for today | vs. yesterday |
| Diffs Detected | Count of diffs in last 24 h | vs. previous 24 h |
| Alerts Sent | Count of alerts with `status = 'sent'` in last 24 h | Failed: N |
| Storage Used | Sum of all snapshot file sizes on disk | Limit: configured DATA_DIR |

Trend arrows (+N% vs previous period) are shown as green or red inline text.

#### Charts (second row, 2-column grid)

**Checks Over Time (7-day bar chart)**  
X: day, Y: total checks across all users. Data from a daily aggregation query against
`snapshots.capturedAt`.

**Plan Distribution (donut chart)**  
Free vs Pro user count. Simple, static.

#### Queue Health Strip (third row)

Four compact queue status pills — one per BullMQ queue. Each pill shows:
- Queue name
- `waiting` count (yellow if > 50)
- `active` count
- `failed` count (red badge if > 0)
- Inline sparkline of job throughput over the last 10 minutes

Clicking a pill navigates to `/admin/queues` pre-filtered to that queue.

#### Recent Failed Alerts (bottom, collapsible)

Table: monitor name | user email | error message | detected at | "Retry" button.
Shows last 10 alerts with `status = 'failed'`. Retry enqueues the alert job again.

---

### 6.2 User Management (`/admin/users`)

#### User Table

Columns:
| Column | Notes |
|---|---|
| Name + Email | Linked to `/admin/users/:id` |
| Plan | Badge: "Free" (grey) / "Pro" (cyan) |
| Monitors | Active / Total (e.g. "3 / 5") |
| Checks Used | Progress bar: `checksUsedThisPeriod / planLimit` |
| Period Resets | Relative date (e.g. "in 12 days") |
| Joined | Relative date |
| Actions | "View" button |

Features:
- Search by name or email (client-side filter on loaded data, or debounced query param)
- Filter tabs: All / Free / Pro / Quota Exceeded (where `checksUsedThisPeriod >= planLimit`)
- Sort by: Joined (default desc), Monitors count, Checks used
- Pagination: 50 rows per page

#### User Detail (`/admin/users/:id`)

Two-column layout: left = user info, right = action panel.

**Left — User Info**

- Avatar placeholder (initials)
- Name, email, UUID
- Plan badge
- Created at, last active (derived from latest session or latest snapshot)
- `periodResetAt` date
- `manualChecksUsedThisPeriod` / 50

Monitor sub-table: all monitors for this user. Columns: name, URL (truncated), status
badge, fetcher tier icon (HTTP / Playwright / Stealth), last checked, diff count.
Each row links to `/admin/monitors` pre-filtered by user.

Alert history sub-table: last 20 alerts. Columns: monitor name, status badge,
sent at / error message.

**Right — Action Panel**

Actions are destructive — each shows a confirmation modal before executing.

| Action | API call | Confirm required |
|---|---|---|
| Upgrade to Pro | `PATCH /api/admin/users/:id { plan: 'pro' }` | Yes |
| Downgrade to Free | `PATCH /api/admin/users/:id { plan: 'free' }` | Yes — warn about monitor count |
| Reset Quota Now | `POST /api/admin/users/:id/reset-quota` | Yes |
| Set Custom Plan Limit | `PATCH /api/admin/users/:id { planLimit: N }` | Yes — number input |
| Suspend Account | `PATCH /api/admin/users/:id { suspended: true }` | Yes — disables all monitors |
| Delete Account | `DELETE /api/admin/users/:id` | Yes — type email to confirm |

Upgrade/downgrade automatically sets `planLimit` to the standard value for the plan
(150 for free, 36 000 for pro) unless overridden.

---

### 6.3 Global Monitor Table (`/admin/monitors`)

All monitors across all users. Useful for spotting abuse (single user with 100 monitors
proxied through different accounts) or diagnosing unreachable clusters.

#### Table

Columns:
| Column | Notes |
|---|---|
| Name | Linked to the URL in a new tab |
| URL | Truncated, full URL on hover |
| Owner | user email |
| Status | `active` / `paused` / `unreachable` — color coded |
| Fetcher Tier | Icon: Tier 1 (lightning bolt) / Tier 2 (browser) / Tier 3 (shield) |
| Interval | "60 min" / "1440 min (daily)" |
| Last Checked | Relative date |
| Diff Count | Number of diffs recorded for this monitor |
| Actions | Pause / Resume / Delete |

Filters:
- Status: All / Active / Paused / Unreachable
- Fetcher tier: Any / 1 / 2 / 3
- Plan: Any / Free / Pro
- Search by URL or name

Bulk actions (checkbox selection):
- Pause selected
- Resume selected
- Delete selected (confirm modal)

---

### 6.4 Queue Health (`/admin/queues`)

Real-time view of the four BullMQ queues. Polling at 10-second interval.

#### Queue Overview Cards (top row)

One card per queue: `scrape-queue`, `alert-queue`, `system-queue`, `discovery-queue`.

Each card shows:
- Queue name
- `waiting` / `active` / `delayed` / `completed (last 5 min)` / `failed (last 5 min)`
- Throughput: jobs/minute (rolling 60-second window)
- Paused indicator (red banner if queue is paused)
- "Pause Queue" / "Resume Queue" toggle button
- "Drain Queue" button (removes all waiting jobs — destructive, confirm required)

#### Failed Jobs Table (bottom)

Unified table of failed jobs across all queues. Columns:
| Column | Notes |
|---|---|
| Queue | Which queue the job belongs to |
| Job Name | e.g. `check-monitor`, `send-alert` |
| Job ID | Truncated |
| Attempt | Which attempt number failed |
| Error | First 120 chars of `failedReason` |
| Failed At | Relative date |
| Actions | "Retry" / "Discard" |

Retry re-queues the job with a fresh attempt. Discard removes it from the failed set.

Filters: by queue name. Sort by failed-at descending.

---

### 6.5 Alert Delivery Log (`/admin/alerts`)

All alerts across all users, in a single searchable table.

Columns:
| Column | Notes |
|---|---|
| User | email |
| Monitor | name |
| Channel | always "email" for now |
| Status | pending / sent / failed — color coded |
| Sent At | or blank if failed |
| Error | error column if status=failed |
| Diff ID | linked to `/api/admin/diffs/:id` detail (JSON modal) |
| Actions | "Retry" (failed only) |

Filters: status (All / Sent / Failed / Pending), date range picker.

**Resend Digest button (top right):** Sends a summary email to the admin's own address
showing today's alert stats. One-shot, does not modify the `alerts` table.

---

### 6.6 Storage Management (`/admin/storage`)

The `data/snapshots/` directory can grow indefinitely. This page gives visibility and
manual controls.

#### Stats Row

| Stat | Source |
|---|---|
| Total snapshot files | `fs.readdir(config.dataDir/snapshots)` |
| Total disk used | Sum of file sizes (MB) |
| Orphaned files | Files on disk with no matching DB row |
| Oldest snapshot | Min `capturedAt` in DB |
| Next GC run | From BullMQ repeatable job schedule (`0 3 * * *`) |
| Last GC run | Stored in a `system_events` table (new, see §8) |

#### Expired vs. Active breakdown

Donut: expired (past `expiresAt`) vs. active. Shows how much space would be freed by
running GC now.

#### Top Users by Storage

Table: user email | snapshot count | disk used (MB) — sorted descending.

#### Controls

- **Run GC Now** — `POST /api/admin/gc` — immediately enqueues the `gc-maintenance`
  job. Shows a toast with job ID and links to `/admin/queues` to watch progress.
- **Purge Orphaned Files** — `POST /api/admin/storage/purge-orphans` — deletes files
  in `data/snapshots/` that have no matching `snapshots` DB row. Shows a confirm modal
  with the orphan count before executing.

---

### 6.7 Settings (`/admin/settings`)

Operator-level knobs. Changes take effect immediately without server restart.
Stored in a new `admin_config` table (key-value, see §8).

#### Feature Flags

Toggle switches (true/false stored as `admin_config` rows):

| Flag key | Default | Effect |
|---|---|---|
| `dom_picker_enabled` | true | If false, Pro users get "temporarily disabled" message on DOM picker |
| `discovery_enabled` | true | If false, site discovery crawl endpoint returns 503 |
| `registration_open` | true | If false, `/api/auth/register` returns 503 with a maintenance message |
| `manual_check_enabled` | true | If false, `POST /monitors/:id/check` is blocked for all users |

#### Plan Limit Overrides

Two number inputs:
- Free plan: monthly check limit (default 150)
- Pro plan: monthly check limit (default 36 000)

Changing these updates the `config.plans` object in memory **and** stores them in
`admin_config` so they survive restarts. Does **not** retroactively change existing
users' `planLimit` — applies only to new registrations or next plan change.

Note: Per-user overrides set from the User Detail page take precedence over these
global values.

#### Maintenance Mode

Toggle that sets `registration_open = false`, `manual_check_enabled = false`, and
prepends a banner to every API 503 response body with a custom message field.
Also shows a visible banner in the user-facing dashboard (existing Next.js frontend
must read a `GET /api/admin/config/public` endpoint that exposes only the maintenance
flag and message — no auth required).

---

## 7. Backend API Specification

All routes under `/api/admin/*`, protected by `requireAdmin` middleware.

### 7.1 Auth

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/admin/auth/login` | `{ password }` | `{ token }` + sets `sd_admin` cookie |
| `POST` | `/api/admin/auth/logout` | — | clears `sd_admin` cookie |
| `GET` | `/api/admin/auth/me` | — | `{ ok: true }` or 401 |

### 7.2 Overview Stats

| Method | Path | Response |
|---|---|---|
| `GET` | `/api/admin/stats` | Platform KPIs: user counts, monitor counts, checks today, diff count, alert counts, storage bytes |

### 7.3 Users

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/admin/users` | `?page&limit&plan&search&sort` |
| `GET` | `/api/admin/users/:id` | user + monitors + recent alerts |
| `PATCH` | `/api/admin/users/:id` | `{ plan?, planLimit?, suspended? }` |
| `POST` | `/api/admin/users/:id/reset-quota` | Sets `checksUsedThisPeriod = 0` and `manualChecksUsedThisPeriod = 0` |
| `DELETE` | `/api/admin/users/:id` | Cascades: sessions, monitors, snapshots, diffs, alerts |

#### Plan upgrade side-effects (in `PATCH /api/admin/users/:id`)

When upgrading free → pro:
- Set `plan = 'pro'`
- Set `planLimit = 36000` (or custom value if provided)
- Do NOT touch existing monitors (they may have `checkIntervalMinutes = 1440` which is
  valid for pro too — the user can shorten them manually)

When downgrading pro → free:
- Set `plan = 'free'`
- Set `planLimit = 150`
- Pause all monitors where `checkIntervalMinutes < 1440` (interval now violates plan)
- Deactivate CSS selectors on all monitors (Pro-only feature)
- Response includes `{ pausedMonitors: N, clearedSelectors: N }` for the admin to
  communicate to the user

### 7.4 Monitors

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/admin/monitors` | `?status&tier&plan&search&page&limit` |
| `PATCH` | `/api/admin/monitors/:id` | `{ isActive?, status? }` |
| `DELETE` | `/api/admin/monitors/:id` | Cascades |

### 7.5 Queues

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/admin/queues` | Stats for all 4 queues (waiting/active/delayed/completed/failed counts) |
| `GET` | `/api/admin/queues/:name/failed` | Paginated failed jobs for one queue |
| `POST` | `/api/admin/queues/:name/retry/:jobId` | Retry one failed job |
| `DELETE` | `/api/admin/queues/:name/failed/:jobId` | Discard one failed job |
| `POST` | `/api/admin/queues/:name/pause` | Pause queue |
| `POST` | `/api/admin/queues/:name/resume` | Resume queue |
| `POST` | `/api/admin/queues/:name/drain` | Remove all waiting jobs |

Queue names accepted: `scrape-queue`, `alert-queue`, `system-queue`, `discovery-queue`.

### 7.6 Alerts

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/admin/alerts` | `?status&from&to&page&limit` |
| `POST` | `/api/admin/alerts/:id/retry` | Re-enqueues the send-alert job |
| `POST` | `/api/admin/alerts/digest` | Sends summary email to admin email (`ADMIN_EMAIL` env var) |

### 7.7 Storage

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/admin/storage` | Snapshot file stats + per-user breakdown |
| `POST` | `/api/admin/gc` | Enqueues `gc-maintenance` immediately |
| `POST` | `/api/admin/storage/purge-orphans` | Deletes files in `data/snapshots/` with no DB row |

### 7.8 Config

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/admin/config` | All `admin_config` rows as a flat object |
| `PATCH` | `/api/admin/config` | Partial update — `{ key: value, ... }` |
| `GET` | `/api/admin/config/public` | Only `maintenance_mode` and `maintenance_message` — **no auth** |

---

## 8. Database Changes

Two new tables. Run `db:generate` + `db:migrate` after adding them to `schema.ts`.

### `admin_sessions`

```ts
export const adminSessions = pgTable('admin_sessions', {
  id: text('id').primaryKey(),         // crypto.randomBytes(32).toString('hex')
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### `admin_config`

```ts
export const adminConfig = pgTable('admin_config', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Seed the table at migration time with default values:

```sql
INSERT INTO admin_config (key, value) VALUES
  ('dom_picker_enabled',   'true'),
  ('discovery_enabled',    'true'),
  ('registration_open',    'true'),
  ('manual_check_enabled', 'true'),
  ('maintenance_mode',     'false'),
  ('maintenance_message',  ''),
  ('free_plan_limit',      '150'),
  ('pro_plan_limit',       '36000')
ON CONFLICT DO NOTHING;
```

### `users` table additions

Two new columns to support the suspend action and per-user plan limit override:

```ts
suspended: boolean('suspended').notNull().default(false),
```

The `planLimit` column already exists and serves as the per-user override storage.
No new column needed for that.

`requireAuth` middleware must reject requests from suspended users with HTTP 403
`{ error: 'Account suspended. Contact support.' }`.

---

## 9. Frontend Implementation Details

### Admin Shell Layout (`(admin)/layout.tsx`)

Separate from the user-facing `(dashboard)/layout.tsx`. Does not share components.

**Sidebar navigation items:**

```
Overview       /admin/overview
Users          /admin/users
Monitors       /admin/monitors
Queues         /admin/queues
Alerts         /admin/alerts
Storage        /admin/storage
Settings       /admin/settings
──────────────
← User App     /dashboard     (opens in same tab)
Sign Out       POST /api/admin/auth/logout
```

**Topbar:**
- "Admin" wordmark on left (no logo — keep it clearly distinct from user app)
- Last refresh timestamp + "Refresh" button (top right)
- Red "Maintenance Mode" banner across full width when `maintenance_mode = true`

### Design System

Reuse the same Tailwind config and CSS custom properties as the user-facing dashboard.
Admin-specific distinction: topbar background is `--bg-card` (slightly lighter than
page BG) with a 1px bottom border colored `--red` at 30% opacity — a subtle signal
that this is an operator tool.

Do not use the user dashboard's sidebar component — admin nav is narrower (220 px)
and has different items.

### State Management

No Zustand in admin — each page fetches its own data with `useEffect` + `useState`.
The admin area is low-traffic and does not benefit from a shared store.
Use `useSWR` or plain `fetch` with `{ credentials: 'include' }`. No axios instance
needed — the admin API calls are simple enough.

### Polling

Queue health page polls every 10 seconds using `setInterval` inside `useEffect`.
The interval is cleared on component unmount.

Overview page has a manual "Refresh" button in the topbar — no auto-poll (data is
not time-critical enough to warrant constant background queries).

### Confirm Modals

All destructive actions (delete user, downgrade plan, drain queue, purge orphans)
use a shared `ConfirmModal` component with:
- Action description
- Optional "type to confirm" text input (for delete-account only)
- Cancel / Confirm buttons
- Loading state on the Confirm button during API call

---

## 10. New Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | Yes | Already in config — used for admin login |
| `ADMIN_EMAIL` | No | Recipient for the alert digest email. Defaults to `RESEND_FROM` if unset |

---

## 11. Security Considerations

- Admin routes must never be reachable without a valid `sd_admin` session cookie.
  The `requireAdmin` middleware validates the cookie against the `admin_sessions` table
  on every request (no caching).
- Admin sessions are 8-hour, non-renewable. The admin must re-authenticate after
  the session expires.
- The `POST /api/admin/auth/login` endpoint is rate-limited to 5 attempts per 5
  minutes per IP to prevent brute-force of `ADMIN_PASSWORD`.
- `GET /api/admin/config/public` is the only unauthenticated admin endpoint. It
  exposes only `maintenance_mode` (boolean) and `maintenance_message` (string) — no
  operational data.
- All admin action endpoints log to the Pino logger at `info` level with a structured
  `{ adminAction: true, action, targetId }` field so actions are auditable in logs.
- The frontend never sends `ADMIN_PASSWORD` after the initial login — only the
  `sd_admin` session cookie.

---

## 12. Implementation Order (Phases)

| Phase | Scope | Deliverable |
|---|---|---|
| A | DB migrations + `requireAdmin` middleware + auth routes | `POST /api/admin/auth/login`, `GET /api/admin/auth/me`, admin session table |
| B | Overview stats endpoint + login page + overview page | Working login flow + KPI cards |
| C | User management API + Users table + User detail page | Full CRUD on users, plan changes, quota reset |
| D | Queue health API + Queues page | Live queue stats, retry/discard failed jobs |
| E | Alert log API + Alerts page | Alert table, resend failed alerts |
| F | Storage API + Storage page + Manual GC | Disk stats, GC trigger, orphan purge |
| G | Config API + Settings page + feature flag enforcement | All feature flags wired into routes |
| H | Monitor oversight table | Global monitor table with filter + bulk actions |

Each phase ships backend + frontend together. Phases A–D are the critical path;
E–H add operational depth.

---

## 13. Out of Scope

- Real-time log streaming (would require WebSockets or SSE — deferred)
- Per-admin role system (single operator assumption holds for MVP)
- Stripe / billing integration (revenue cards are static stubs showing 0)
- Public status page (separate project)
- SAML / SSO for admin (overkill at this stage)
- Audit log table in DB (Pino structured logs are the audit trail for now)
