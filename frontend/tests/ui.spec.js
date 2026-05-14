/**
 * SonarDiff Frontend UI Tests
 * Tests the redesigned dark-first dashboard pages.
 * Run: node tests/ui.spec.js
 */

// Use playwright from the backend node_modules (installed there for scraping)
const { chromium } = require('../../backend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const SS_DIR = path.join(__dirname, 'screenshots');

const MOCK_USER = {
  id: '1',
  name: 'Ahmed Hanafy',
  email: 'ahmed@sonardiff.com',
  plan: 'pro',
  checksUsedThisPeriod: 1240,
  planLimit: 10000,
  manualChecksUsedThisPeriod: 8,
  periodResetAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
};

const MOCK_MONITORS = [
  { id: '1', name: 'Competitor pricing page', url: 'https://competitor.com/pricing', isActive: true, checkIntervalMinutes: 60, lastCheckedAt: new Date(Date.now() - 25 * 60000).toISOString() },
  { id: '2', name: 'TechCrunch startup feed', url: 'https://techcrunch.com/category/startups', isActive: true, checkIntervalMinutes: 360, lastCheckedAt: new Date(Date.now() - 3 * 3600000).toISOString() },
  { id: '3', name: 'Notion careers', url: 'https://notion.so/careers', isActive: false, checkIntervalMinutes: 1440, lastCheckedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: '4', name: 'Linear changelog', url: 'https://linear.app/changelog', isActive: true, checkIntervalMinutes: 720, lastCheckedAt: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: '5', name: 'Stripe webhooks docs', url: 'https://stripe.com/docs/webhooks', isActive: true, checkIntervalMinutes: 1440, lastCheckedAt: new Date(Date.now() - 6 * 3600000).toISOString() },
];

const MOCK_DIFFS = [
  { id: 'd1', changeSummary: 'Pro plan price dropped from $49 to $39', changePercentage: '8.2', detectedAt: new Date(Date.now() - 40 * 60000).toISOString() },
  { id: 'd2', changeSummary: 'Enterprise tier added to pricing table', changePercentage: '22.1', detectedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
];

// ── Helpers ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    results.push({ ok: true, label });
    process.stdout.write(`  ✓ ${label}\n`);
  } else {
    failed++;
    results.push({ ok: false, label });
    process.stdout.write(`  ✗ ${label}\n`);
  }
}

async function screenshot(page, name) {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
  const file = path.join(SS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function setupContext(browser, authed = false) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: {
      cookies: [],
      origins: [{ origin: BASE, localStorage: [{ name: 'theme', value: 'dark' }] }],
    },
  });

  await ctx.route('**/api/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/auth/me')) {
      return authed
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: MOCK_USER }) })
        : route.fulfill({ status: 401, body: '{}' });
    }
    if (url.includes('/auth/logout')) return route.fulfill({ status: 200, body: '{}' });
    if (url.includes('/admin/config/public')) return route.fulfill({ status: 200, body: JSON.stringify({ maintenanceMode: false }) });
    if (url.includes('/monitor-groups')) return route.fulfill({ status: 200, body: JSON.stringify({ groups: [] }) });
    if (url.match(/\/monitors\/[^/]+\/diffs/)) return route.fulfill({ status: 200, body: JSON.stringify({ diffs: MOCK_DIFFS }) });
    if (url.includes('/monitors') && method === 'GET') return route.fulfill({ status: 200, body: JSON.stringify({ monitors: MOCK_MONITORS }) });
    if (url.includes('/dashboard/stats')) return route.fulfill({ status: 200, body: JSON.stringify({
      activeMonitors: 4, checksToday: 87, changesDetected: 3,
      recentDiffs: [{ id: 'd1', monitorId: '1', ...MOCK_DIFFS[0] }, { id: 'd2', monitorId: '2', ...MOCK_DIFFS[1] }],
    }) });
    return route.fulfill({ status: 200, body: '{}' });
  });

  return ctx;
}

// ── Test suites ────────────────────────────────────────────────────────────

async function testLanding(browser) {
  console.log('\n── Landing page ──────────────────────────────────────');
  const ctx = await setupContext(browser, false);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Dark mode
  const bgColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
  );
  assert(bgColor.toLowerCase() === '#07090c', `Dark mode active (--background = ${bgColor})`);

  // Nav links
  assert(await page.isVisible('text=Features'), 'Nav: Features link visible');
  assert(await page.isVisible('text=How it works'), 'Nav: How it works link visible');
  assert(await page.isVisible('text=Pricing'), 'Nav: Pricing link visible');
  assert(await page.isVisible('text=Sign in'), 'Nav: Sign in link visible');
  assert(await page.isVisible('text=Start free'), 'Nav: Start free CTA visible');

  // Hero
  assert(await page.isVisible('text=Know when a competitor changes'), 'Hero: heading visible');
  assert(await page.isVisible('text=Start free trial'), 'Hero: primary CTA visible');
  assert(await page.isVisible('text=See how it works'), 'Hero: secondary CTA visible');

  // MovingExamples frame
  assert(await page.isVisible('text=Pro plan'), 'Hero: MovingExamples diff frame visible');

  // Reveal sections (scroll to trigger or force-reveal)
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')));
  await page.waitForTimeout(500);

  assert(await page.isVisible('text=Deterministic monitoring'), 'Features section visible');
  assert(await page.isVisible('text=Headless browser rendering'), 'Feature 01 visible');
  assert(await page.isVisible('text=Visual element targeting'), 'Feature 03 visible');
  assert(await page.isVisible('text=Five steps to your first alert'), 'How it works heading visible');
  assert(await page.isVisible('text=Simple, transparent pricing'), 'Pricing section visible');
  assert(await page.isVisible('text=$29'), 'Pro plan price visible');
  assert(await page.isVisible('text=Start monitoring in under three minutes'), 'CTA section visible');

  // No ThemeToggle in landing nav (removed per design)
  const themeToggleInNav = await page.locator('nav button[title="Toggle theme"]').count();
  assert(themeToggleInNav === 0, 'No ThemeToggle in landing nav');

  await screenshot(page, '01-landing');
  await ctx.close();
}

async function testLayout(browser) {
  console.log('\n── Dashboard shell (sidebar + layout) ───────────────');
  const ctx = await setupContext(browser, true);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Ahmed Hanafy', { timeout: 8000 });

  // Dark background
  const mainBg = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor
  );
  // rgb(7, 9, 12) = #07090C
  assert(mainBg === 'rgb(7, 9, 12)', `Body background is dark (${mainBg})`);

  // Sidebar chrome background
  const sidebarBg = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    return aside ? getComputedStyle(aside).backgroundColor : 'none';
  });
  // rgb(5, 7, 10) = #05070A (sd-chrome)
  assert(sidebarBg === 'rgb(5, 7, 10)', `Sidebar is sd-chrome dark (${sidebarBg})`);

  // User info
  assert(await page.isVisible('text=Ahmed Hanafy'), 'Sidebar: user name visible');
  assert(await page.isVisible('text=Pro Plan'), 'Sidebar: plan label visible');

  // Nav items
  assert(await page.isVisible('text=Monitors'), 'Nav: Monitors link');
  assert(await page.isVisible('text=Alerts'), 'Nav: Alerts link');
  assert(await page.isVisible('text=Snapshot history'), 'Nav: Snapshot history');
  assert(await page.isVisible('text=DOM Picker'), 'Nav: DOM Picker link');
  assert(await page.isVisible('text=PRO'), 'Nav: Pro badge on DOM Picker');
  assert(await page.isVisible('text=Sign out'), 'Nav: Sign out button');

  // Active state on Monitors (current page is dashboard which maps to /monitors active)
  const activeNavBg = await page.evaluate(() => {
    const link = [...document.querySelectorAll('nav a')].find(a => a.textContent.trim().startsWith('Monitors'));
    return link ? getComputedStyle(link).backgroundColor : 'none';
  });
  assert(activeNavBg !== 'rgba(0, 0, 0, 0)', `Active nav item has filled background (${activeNavBg})`);

  // Quota section
  assert(await page.isVisible('text=QUOTA'), 'Sidebar: Quota label visible');
  assert(await page.isVisible('text=1,240'), 'Sidebar: quota used value visible');
  assert(await page.isVisible('text=10,000'), 'Sidebar: quota limit visible');
  assert(await page.isVisible('text=Resets in 12d'), 'Sidebar: reset countdown visible');
  assert(await page.isVisible('text=MANUAL CHECKS'), 'Sidebar: manual checks label');

  await screenshot(page, '02-layout-dashboard');
  await ctx.close();
}

async function testDashboard(browser) {
  console.log('\n── Dashboard overview page ───────────────────────────');
  const ctx = await setupContext(browser, true);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=active monitors', { timeout: 8000 });
  // Wait for stats API to populate the actual numbers (label renders immediately, values need the API)
  await page.waitForSelector('text=87', { timeout: 5000 }).catch(() => {});

  // Page heading
  assert(await page.isVisible('text=Overview'), 'Page heading: Overview');
  assert(await page.isVisible('text=Welcome back, Ahmed'), 'Subtitle with first name');

  // Status strip (not KPI cards)
  const statsText = await page.locator('.font-display').allTextContents();
  assert(statsText.includes('4'), `Stats: 4 active monitors (found: ${statsText})`);
  assert(await page.isVisible('text=active monitors'), 'Stats: "active monitors" label');
  assert(await page.isVisible('text=87'), 'Stats: 87 checks today');
  assert(await page.isVisible('text=checks today'), 'Stats: "checks today" label');
  assert(await page.isVisible('text=3'), 'Stats: 3 changes detected');
  assert(await page.isVisible('text=12%'), 'Stats: 12% quota used');

  // NO card-per-stat pattern (each stat should be in one container, not separate bg-bg-card divs)
  const statCardCount = await page.evaluate(() =>
    [...document.querySelectorAll('h2, h3')].filter(h => ['Active monitors','Checks today','Changes detected','Quota used'].includes(h.textContent.trim())).length
  );
  assert(statCardCount === 0, 'No KPI card headings (hero-metric pattern absent)');

  // Monitor list
  assert(await page.isVisible('text=Monitors'), 'Monitor list section visible');
  assert(await page.isVisible('text=Competitor pricing page'), 'Monitor row: Competitor pricing');
  assert(await page.isVisible('text=Linear changelog'), 'Monitor row: Linear changelog');
  assert(await page.isVisible('text=25m ago'), 'Monitor row: last-checked timestamp');
  assert(await page.isVisible('text=View all'), '"View all" link present');

  // Recent changes
  assert(await page.isVisible('text=Recent changes'), 'Recent changes section visible');
  assert(await page.isVisible('text=Change detected'), 'Recent diff row visible');
  assert(await page.isVisible('text=All alerts'), '"All alerts" link visible');

  await screenshot(page, '03-dashboard');
  await ctx.close();
}

async function testMonitors(browser) {
  console.log('\n── Monitors page ─────────────────────────────────────');
  const ctx = await setupContext(browser, true);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/monitors`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Competitor pricing page', { timeout: 8000 });

  // Header
  assert(await page.isVisible('text=Monitors'), 'Page heading: Monitors');
  assert(await page.isVisible('text=New monitor'), 'New monitor CTA button');

  // Toolbar
  assert(await page.isVisible('[placeholder="Search monitors..."]'), 'Search input present');
  assert(await page.isVisible('text=All'), 'Filter: All pill');
  assert(await page.isVisible('text=Active'), 'Filter: Active pill');
  assert(await page.isVisible('text=Paused'), 'Filter: Paused pill');

  // Column headers
  assert(await page.isVisible('text=NAME'), 'Column: NAME');
  assert(await page.isVisible('text=STATUS'), 'Column: STATUS');
  assert(await page.isVisible('text=FREQ'), 'Column: FREQ');
  assert(await page.isVisible('text=CHECKED'), 'Column: CHECKED');
  assert(await page.isVisible('text=ACTIONS'), 'Column: ACTIONS');

  // Monitor rows
  assert(await page.isVisible('text=Competitor pricing page'), 'Row: Competitor pricing');
  assert(await page.isVisible('text=https://competitor.com/pricing'), 'Row: URL visible');
  assert(await page.isVisible('text=TechCrunch startup feed'), 'Row: TechCrunch');
  assert(await page.isVisible('text=Notion careers'), 'Row: Notion careers');
  assert(await page.isVisible('text=Linear changelog'), 'Row: Linear changelog');

  // Status pills
  const activePills = await page.locator('.pill.live').count();
  assert(activePills >= 4, `Active status pills present (found ${activePills})`);
  const pausedPills = await page.locator('.pill.paused').count();
  assert(pausedPills >= 1, `Paused status pill present (found ${pausedPills})`);

  // Sweep animation class on rows
  const sweepRows = await page.locator('.sd-sweep').count();
  assert(sweepRows >= 5, `sd-sweep animation class on rows (found ${sweepRows})`);

  // Frequency labels
  assert(await page.isVisible('text=1h'), 'Frequency: 1h visible');
  assert(await page.isVisible('text=6h'), 'Frequency: 6h visible');
  assert(await page.isVisible('text=24h'), 'Frequency: 24h visible');

  // Pagination footer
  assert(await page.isVisible('text=5 monitors'), 'Footer: monitor count');

  // Search filter
  await page.fill('[placeholder="Search monitors..."]', 'Linear');
  await page.waitForTimeout(300);
  assert(await page.isVisible('text=Linear changelog'), 'Search filter: Linear result visible');
  const hiddenAfterFilter = await page.isVisible('text=Notion careers');
  assert(!hiddenAfterFilter, 'Search filter: Notion careers hidden');
  await page.fill('[placeholder="Search monitors..."]', '');

  await screenshot(page, '04-monitors');
  await ctx.close();
}

async function testAlerts(browser) {
  console.log('\n── Alerts page ───────────────────────────────────────');
  const ctx = await setupContext(browser, true);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/alerts`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Competitor pricing', { timeout: 8000 });

  // Header
  assert(await page.isVisible('text=Alerts'), 'Page heading: Alerts');
  assert(await page.isVisible('text=Changes detected across'), 'Subtitle visible');

  // Change count badge
  const badge = await page.locator('text=/\\d+ changes/').count();
  assert(badge > 0, 'Change count badge visible');

  // Alert rows with sweep
  const sweepRows = await page.locator('.sd-sweep').count();
  assert(sweepRows >= 5, `sd-sweep on alert rows (found ${sweepRows})`);

  // Severity percentage labels
  assert(await page.isVisible('text=+8.2%'), 'Alert: +8.2% change visible');
  assert(await page.isVisible('text=+22.1%'), 'Alert: +22.1% change visible');

  // Relative time
  assert(await page.isVisible('text=40m ago'), 'Alert: relative time (40m ago)');

  // Expand a row on click
  const firstRow = page.locator('button').filter({ hasText: 'Competitor pricing page' }).first();
  if (await firstRow.count() > 0) {
    await firstRow.click();
    await page.waitForTimeout(300);
    assert(await page.isVisible('text=View full diff'), 'Expand: "View full diff" link visible after click');
    assert(await page.isVisible('text=Detected'), 'Expand: "Detected" label visible');
  } else {
    // row might be a div not button — click the row itself
    await page.locator('.sd-sweep').first().click();
    await page.waitForTimeout(300);
    const expanded = await page.isVisible('text=View full diff');
    assert(expanded, 'Expand: row expands on click');
  }

  await screenshot(page, '05-alerts');
  await ctx.close();
}

async function testLandingRedirect(browser) {
  console.log('\n── Auth redirect ─────────────────────────────────────');
  const ctx = await setupContext(browser, true); // authenticated
  const page = await ctx.newPage();

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const url = page.url();
  assert(url.includes('/dashboard'), `Authenticated user redirected to dashboard (${url})`);

  await ctx.close();
}

// ── Runner ─────────────────────────────────────────────────────────────────

(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log('SonarDiff UI Test Suite');
  console.log('═'.repeat(54));

  try {
    await testLanding(browser);
    await testLayout(browser);
    await testDashboard(browser);
    await testMonitors(browser);
    await testAlerts(browser);
    await testLandingRedirect(browser);
  } catch (err) {
    console.error('\nFatal error:', err.message);
  } finally {
    await browser.close();
  }

  console.log('\n' + '═'.repeat(54));
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  if (failed > 0) {
    console.log('\nFailed:');
    results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.label}`));
    process.exit(1);
  } else {
    console.log('\nAll tests passed.');
    process.exit(0);
  }
})();
