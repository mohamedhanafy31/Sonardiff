SonarDiff — Test-Targets Experiment Plan
End-to-end test of the SonarDiff MVP using the seven local test-target apps.

Covers: account creation (Pro), monitor setup for all apps, content mutation,

diff detection verification, and edge-case handling.

Topology
SonarDiff MVP                    Test-Targets
──────────────────────────       ─────────────────────────────────────
Frontend      :3000              app1-static       :3010
Backend API   :3001              app2-spa          :3011
PostgreSQL    :5432              app3-noise        :3012
Redis         :6379              app4-ecommerce    :3013
                                 app5-saas         :3014
                                 app6-availability :3015
                                 app7-errors       :3016


Phase 0 — Start All Services
0.1 Start test-targets
cd artifacts/mvp/test-targets
docker compose up --build -d

Verify all 7 containers are healthy:
for port in 3010 3011 3012 3013 3014 3015 3016; do
  curl -s -o /dev/null -w "port $port → %{http_code}\n" http://localhost:$port/
done

Expected: 200 for ports 3010–3015. Port 3016 has no root route — that is fine.
0.2 Start SonarDiff MVP infrastructure
docker compose -f artifacts/mvp/docker-compose.yml up db redis -d

0.3 Start backend + worker (two terminals)
# Terminal 1 — API server
cd artifacts/mvp/backend
pnpm run dev

# Terminal 2 — BullMQ worker
cd artifacts/mvp/backend
pnpm run dev:worker

0.4 Start frontend
cd artifacts/mvp/frontend
pnpm run dev

Confirm the dashboard loads at http://localhost:3000.

Phase 1 — Create a Pro Account
Registration accepts plan: "pro" directly — no payment step needed in dev.
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name":     "Test User",
    "email":    "tester@sonardiff.local",
    "password": "TestPass123!",
    "plan":     "pro"
  }' | jq .

Expected response fields:
·	user.plan = "pro"
·	user.planLimit = 36000
Save the session token from the response — it is used in all subsequent API calls:
TOKEN="<token from response>"

Verify the account in the dashboard at http://localhost:3000 by logging in with the

credentials above. The plan badge should read Pro.

Phase 2 — Register Monitors for All Test-Target Apps
Create one monitor per app. Pro limits: up to 50 monitors, minimum interval 60 min.

All monitors use checkIntervalMinutes: 60 for fast iteration during the experiment.
Helper function (bash)
create_monitor() {
  curl -s -X POST http://localhost:3001/api/monitors \
    -H "Content-Type: application/json" \
    -H "Cookie: sd_session=$TOKEN" \
    -d "$1" | jq '{id: .monitor.id, name: .monitor.name, url: .monitor.url}'
}

2.1 App 1 — Static Content
No selector needed — the whole page is stable (no noise).
create_monitor '{
  "name":                 "App1 Static",
  "url":                  "http://localhost:3010",
  "checkIntervalMinutes": 60,
  "threshold":            0.01
}'

What to watch for: Title h1 and the Quality table cell — both will change when

the mutation is triggered.
2.2 App 2 — JS-Rendered SPA
The product data is injected by a 800 ms setTimeout. Playwright (Tier 2) will be

auto-detected on first scrape because plain HTTP fetch returns only the loading

placeholder text.
create_monitor '{
  "name":                 "App2 SPA",
  "url":                  "http://localhost:3011",
  "checkIntervalMinutes": 60,
  "threshold":            0.01
}'

What to watch for: After mutation the price ($599.99 → $799.99) and stock status

(In Stock → Out of Stock) appear in the diff.
2.3 App 3 — High-Noise News Page
The page contains a live clock, the current date, and rotating ads that change every

3 seconds. Without a CSS selector, every check would produce a false positive.
Use the CSS selector #headline to target only the featured headline and ignore all

the noise. This is a Pro-only feature.
create_monitor '{
  "name":                 "App3 Noise (headline only)",
  "url":                  "http://localhost:3012",
  "checkIntervalMinutes": 60,
  "cssSelector":          "#headline",
  "threshold":            0.01
}'

What to watch for: No diff should appear between baseline and a second scrape

taken without a mutation (clock/ads change but headline stays the same). A diff

should appear only after the headline mutation is triggered.
2.4 App 4 — E-commerce Product Page
Every page load shuffles the "Recommended For You" sidebar, "Customers also viewed"

section, and appends a random System ID token in the footer. These changes would

generate constant false positives. Target only the price element.
create_monitor '{
  "name":                 "App4 Ecommerce (price only)",
  "url":                  "http://localhost:3013",
  "checkIntervalMinutes": 60,
  "cssSelector":          "#product-price",
  "threshold":            0.01
}'

What to watch for: Repeated checks with no price change → no diff. After the

price mutation → diff detected.
2.5 App 5 — SaaS Pricing Page
Three plan containers are present. Monitor only the Pro plan card to catch a price

change without triggering on unrelated layout changes.
create_monitor '{
  "name":                 "App5 SaaS Pricing (Pro plan)",
  "url":                  "http://localhost:3014",
  "checkIntervalMinutes": 60,
  "cssSelector":          "#plan-pro",
  "threshold":            0.01
}'

What to watch for: Pro price changes from $20/mo → $49/mo. Free and Enterprise

cards remain unchanged.
2.6 App 6 — Stock Availability
The entire page is a single stock badge — no noise, no selector needed.
create_monitor '{
  "name":                 "App6 Stock Availability",
  "url":                  "http://localhost:3015",
  "checkIntervalMinutes": 60,
  "threshold":            0.01
}'

What to watch for: "In Stock" text flips to "Out of Stock" — small but semantically

meaningful change. Even at a 1% threshold this should fire because the text block is

small and the diff percentage is high.
2.7 App 7 — Error Scenarios
App 7 has no stable content page; its routes test error-handling behavior. Create one

monitor for each error type. The goal is to verify SonarDiff handles HTTP errors and

timeouts gracefully without crashing the worker.
# 7a — always-404
create_monitor '{
  "name":                 "App7 404",
  "url":                  "http://localhost:3016/always-404",
  "checkIntervalMinutes": 60
}'

# 7b — always-500
create_monitor '{
  "name":                 "App7 500",
  "url":                  "http://localhost:3016/always-500",
  "checkIntervalMinutes": 60
}'

# 7c — timeout (60 s hang)
create_monitor '{
  "name":                 "App7 Timeout",
  "url":                  "http://localhost:3016/timeout",
  "checkIntervalMinutes": 60
}'

# 7d — flaky (500 for first 3 calls, then 200)
create_monitor '{
  "name":                 "App7 Flaky",
  "url":                  "http://localhost:3016/flaky",
  "checkIntervalMinutes": 60
}'

Save each monitor ID from the responses. You will need them in Phase 4.
What to watch for per route:

| Route | Expected outcome |

|---|---|

| /always-404 | Snapshot captured with httpStatus: 404, monitor status → unreachable after consecutive failures |

| /always-500 | Same as 404 — httpStatus: 500, unreachable |

| /timeout | Worker times out (Playwright default 30 s), snapshot has error set, no crash |

| /flaky | First 3 scrapes → error snapshots; 4th → success with "Recovery Successful" content |

Phase 3 — Capture Baseline Snapshots
The worker polls for due monitors every 60 seconds and immediately enqueues any monitor

whose nextCheckAt is in the past. All monitors created in Phase 2 have

nextCheckAt = NOW(), so they will be picked up on the very next poll cycle.
Option A — Wait for the automatic poll (≤ 2 minutes)
Watch the worker terminal logs. You should see lines like:
scrapeWorker | Scraping http://localhost:3010 (tier 1)
scrapeWorker | Snapshot captured — monitorId: <uuid>

Option B — Manually trigger each monitor (Pro feature, faster)
MONITOR_ID="<id>"
curl -s -X POST http://localhost:3001/api/monitors/$MONITOR_ID/check \
  -H "Cookie: sd_session=$TOKEN" | jq .

Repeat for each of the 11 monitors (Apps 1–7d).
Verify baseline snapshots exist
curl -s http://localhost:3001/api/monitors/snapshots/all \
  -H "Cookie: sd_session=$TOKEN" | jq '.snapshots | length'

Expected: ≥ 11 snapshots (one per monitor minimum). App 7 snapshots may have

httpStatus != 200 — that is correct.
Also check the dashboard at http://localhost:3000 — each monitor card should show

"Last checked" time and a green/red status badge.

Phase 4 — Trigger Content Mutations
Now mutate the content of each app. Each trigger call below changes the server-side

state and the next scrape will produce a diff.
4.1 App 1 — Static title + table value
curl -s -X POST http://localhost:3010/update | jq .

Before: title = "Baseline Static Content", Quality = "Standard"

After:  title = "Updated Static Content",  Quality = "Premium"
4.2 App 2 — SPA price + stock status
curl -s -X POST http://localhost:3011/set-data \
  -H "Content-Type: application/json" \
  -d '{"price": 799.99, "inStock": false}' | jq .

Before: $599.99 / In Stock

After:  $799.99 / Out of Stock
4.3 App 3 — News headline
curl -s -X POST http://localhost:3012/update-headline \
  -H "Content-Type: application/json" \
  -d '{"headline": "Breaking: Global Markets Disrupted By AI Surge"}' | jq .

Before: "Global Economy Shows Resilience Amidst Volatility"

After:  "Breaking: Global Markets Disrupted By AI Surge"
4.4 App 4 — Product price
curl -s "http://localhost:3013/set-price?value=199.99" | jq .

Before: $129.99

After:  $199.99
4.5 App 5 — Pro plan price
curl -s -X POST http://localhost:3014/update-pro-price \
  -H "Content-Type: application/json" \
  -d '{"value": 49}' | jq .

Before: $20/mo

After:  $49/mo
4.6 App 6 — Stock toggle
curl -s -X POST http://localhost:3015/toggle-stock \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" | jq .

Before: In Stock

After:  Out of Stock
4.7 App 7 — Reset flaky counter
To test the flaky-to-healthy transition, reset the counter so the monitor experiences

the 500→200 progression from scratch:
curl -s http://localhost:3016/reset-flaky | jq .


Phase 5 — Trigger Second Scrape and Verify Diffs
After mutations are applied, trigger a second check on all monitors that changed

(Apps 1–6 and the flaky route):
# Replace with your actual monitor IDs
for id in \
  "<app1_monitor_id>" \
  "<app2_monitor_id>" \
  "<app3_monitor_id>" \
  "<app4_monitor_id>" \
  "<app5_monitor_id>" \
  "<app6_monitor_id>" \
  "<app7d_flaky_monitor_id>"; do
  curl -s -X POST http://localhost:3001/api/monitors/$id/check \
    -H "Cookie: sd_session=$TOKEN" | jq '{id: .message}'
done

Wait ~10–30 seconds for the worker to complete the scrapes, then fetch diffs:
curl -s http://localhost:3001/api/monitors/<MONITOR_ID>/diffs \
  -H "Cookie: sd_session=$TOKEN" | jq '.diffs[] | {id, changePercentage, changeSummary, detectedAt}'


Phase 6 — Verify Diff Correctness
For each monitor, fetch the full diff detail and inspect what changed:
curl -s http://localhost:3001/api/monitors/<MONITOR_ID>/diffs/<DIFF_ID> \
  -H "Cookie: sd_session=$TOKEN" | jq '{
    changePercentage: .diff.changePercentage,
    summary:          .diff.changeSummary,
    oldContent:       .diff.snapshotOld.content,
    newContent:       .diff.snapshotNew.content
  }'

Expected results per app
App	Monitor name	Expected diff content	changePercentage
App1	App1 Static	"Updated Static Content" replaces "Baseline Static Content"; "Premium" replaces "Standard"	> 1%
App2	App2 SPA	Price 599.99 → 799.99; "Out of Stock" replaces "In Stock"	> 1%
App3	App3 Noise	Only headline text differs; no clock/ad noise in diff	> 1%
App4	App4 Ecommerce	Only $129.99 → $199.99 in diff; no recommendation sidebar in diff	> 1%
App5	App5 SaaS Pricing	"$20" → "$49" within #plan-pro	> 1%
App6	App6 Stock	"In Stock" → "Out of Stock"	> 10% (small page)
App7 404	App7 404	No diff — content is always the same error string	0%
App7 500	App7 500	No diff — content is always the same error string	0%
App7 Timeout	App7 Timeout	snapshot.error populated; no diff generated	N/A
App7 Flaky	App7 Flaky	After reset: first 3 checks fail → 4th returns "Recovery Successful" diff	> 1% on 4th check

Noise test for App 3 (explicit verification)
Run a second manual check on the App3 monitor without triggering another mutation.
curl -s -X POST http://localhost:3001/api/monitors/<app3_monitor_id>/check \
  -H "Cookie: sd_session=$TOKEN"

Wait for it to complete and then list diffs again. The diff count should NOT increase —

the clock and ad-banner are excluded from the monitored selector, so the content hash

stays the same.

Phase 7 — Alert Verification
Each diff that exceeds threshold queues an alert email via Resend. Check the alert

records:
curl -s http://localhost:3001/api/dashboard \
  -H "Cookie: sd_session=$TOKEN" | jq '.recentAlerts'

Also check the worker terminal for lines like:
alertWorker | Alert sent — monitorId: <uuid> diffId: <uuid>

If RESEND_API_KEY is a real key, verify the email was delivered to the inbox of the

registered account. If using the test key (re_...), the email will appear in Resend's

dashboard at https://resend.com/emails.

Phase 8 — Dashboard Visual Checklist
Open http://localhost:3000 and verify:
·	All 11 monitors appear in the monitors list
·	Monitors for Apps 1–6 show a "Changed" badge or non-zero diff count
·	Monitors for App 7 (404, 500, timeout) show "Unreachable" status
·	Clicking a monitor opens the detail view with a snapshot timeline
·	Clicking a diff opens the diff viewer showing highlighted added/removed lines
·	App3 and App4 detail views show the CSS selector in the monitor settings panel
·	Quota counter (checksUsedThisPeriod) has incremented by the number of checks run

Phase 9 — Pro Feature Stress Tests
9.1 Selector vs. whole-page comparison
For App4 (ecommerce), temporarily create a second monitor for the same URL without

a CSS selector and run both:
create_monitor '{
  "name":                 "App4 Ecommerce (full page)",
  "url":                  "http://localhost:3013",
  "checkIntervalMinutes": 60,
  "threshold":            0.01
}'

Take a baseline, do NOT mutate the price, then trigger a second check on both monitors.
·	Full-page monitor → should show a diff (random recommendations changed)
·	Selector monitor → should show NO diff (price unchanged)
This proves the noise-filtering value of CSS selector targeting.
9.2 Threshold tuning for App6 (availability)
App 6 is a very small page, so a stock toggle changes nearly 100% of meaningful text.

Try lowering the threshold to 0.001 and confirm the alert still fires:
curl -s -X PATCH http://localhost:3001/api/monitors/<app6_monitor_id> \
  -H "Content-Type: application/json" \
  -H "Cookie: sd_session=$TOKEN" \
  -d '{"threshold": 0.001}'

Toggle stock back to "In Stock" and trigger another check — diff should appear.
9.3 Manual check quota limit
The Pro plan allows 50 manual checks per billing period. After 50 manual triggers

(across all monitors), the API should return:
{"error": "Monthly manual check limit of 50 reached"}


Phase 10 — Teardown
# Stop test-targets
docker compose -f artifacts/mvp/test-targets/docker-compose.yml down

# Stop MVP infrastructure (keeps volumes by default)
docker compose -f artifacts/mvp/docker-compose.yml down

To reset the database for a fresh run:
docker compose -f artifacts/mvp/docker-compose.yml down -v
docker compose -f artifacts/mvp/docker-compose.yml up db redis -d
cd artifacts/mvp/backend && pnpm run db:migrate


Pass/Fail Criteria Summary
#	Criterion	Pass condition
1	Pro account creation	user.plan == "pro", planLimit == 36000
2	Monitor creation (all 11)	All return HTTP 201 with a valid UUID
3	Baseline snapshots	≥ 11 snapshots in DB within 2 min of startup
4	App1 static diff	Diff detected with title and table changes
5	App2 SPA diff	Diff detected with JS-rendered price + stock changes
6	App3 noise suppression	0 diffs between identical-headline scrapes; 1 diff after headline mutation
7	App4 selector isolation	Selector monitor: no diff on recommendation churn; diff on price change
8	App5 pricing diff	Diff contains "$49" replacing "$20" within Pro card
9	App6 availability diff	Diff detected on "In Stock" → "Out of Stock" flip
10	App7 error handling	404/500 → httpStatus set, no worker crash; timeout → error set, no crash
11	App7 flaky recovery	4th scrape captures "Recovery Successful" and produces a diff
12	Alert emails queued	alerts records present with status: "sent" (or logs confirm send)
13	Full-page vs. selector proof	Full-page monitor fires false positive; selector monitor does not
14	Quota counter accuracy	checksUsedThisPeriod matches actual check count

