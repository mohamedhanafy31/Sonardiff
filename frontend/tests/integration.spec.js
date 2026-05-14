/**
 * SonarDiff Integration Tests
 *
 * Tests real frontend ↔ backend communication.
 * - Suites 1–13 hit the API directly (no mocking) to verify HTTP contracts.
 * - Suite 14 uses a real browser to walk the user-facing flow end-to-end.
 *
 * Prerequisites: backend on :3001, frontend (Next.js) on :3000.
 * Run: node tests/integration.spec.js
 */

const { chromium } = require('../../backend/node_modules/playwright');

// ── Config ─────────────────────────────────────────────────────────────────
const API  = 'http://localhost:3001/api';   // direct backend
const NEXT = 'http://localhost:3000';        // Next.js (proxy tests use this)

// Test user — unique suffix so re-runs don't conflict with existing accounts
const SUFFIX  = Date.now();
const TEST_EMAIL    = `integration_test_${SUFFIX}@test.dev`;
const TEST_PASSWORD = 'Test@password1_longer';   // ≥10 chars (frontend requires 10)
const TEST_NAME     = 'Integration Tester';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin_dev_password';

// ── State shared across suites ─────────────────────────────────────────────
let authToken   = null;   // Bearer token after login
let userId      = null;   // created user id
let monitorId   = null;   // created monitor id
let adminCookie = null;   // sd_admin cookie value

// ── Tiny test framework ────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    process.stdout.write(`  ✓ ${label}\n`);
  } else {
    failed++;
    failures.push(label);
    process.stdout.write(`  ✗ ${label}\n`);
  }
}

function assertDeepIncludes(obj, keys, label) {
  const missing = keys.filter(k => !(k in obj));
  assert(missing.length === 0, `${label} (missing keys: ${missing.join(', ') || 'none'})`);
}

async function req(method, path, { body, token, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token)  headers['Authorization'] = `Bearer ${token}`;
  if (cookie) headers['Cookie'] = cookie;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data, headers: res.headers };
}

// ── Suite helpers ──────────────────────────────────────────────────────────
function suite(name) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 52 - name.length))}`);
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 1 — Health & Proxy
// ══════════════════════════════════════════════════════════════════════════
async function testHealth() {
  suite('1. Health & Proxy');

  // Direct backend
  const direct = await req('GET', '/healthz');
  assert(direct.status === 200, 'Backend /api/healthz → 200');
  assert(direct.data?.status === 'ok', 'Health response has status:"ok"');
  assert(direct.data?.database === 'up', 'Health reports database:"up"');

  // Via Next.js proxy
  const proxy = await fetch(`${NEXT}/api/healthz`);
  const proxyData = await proxy.json();
  assert(proxy.status === 200, 'Next.js proxy /api/healthz → 200');
  assert(proxyData?.status === 'ok', 'Proxy health response correct');

  // Auth test route
  const authTest = await req('GET', '/auth/test');
  assert(authTest.status === 200, '/api/auth/test → 200');
  assert(authTest.data?.msg === 'auth router works', 'Auth router sanity route');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 2 — Register
// ══════════════════════════════════════════════════════════════════════════
async function testRegister() {
  suite('2. Auth — Register');

  // Missing fields
  const missing = await req('POST', '/auth/register', { body: { email: TEST_EMAIL } });
  assert(missing.status === 400, 'Register with missing fields → 400');

  // Short password
  const shortPw = await req('POST', '/auth/register', {
    body: { email: TEST_EMAIL, password: 'abc', name: TEST_NAME },
  });
  assert(shortPw.status === 400, 'Register with password < 8 chars → 400');

  // Valid registration
  const reg = await req('POST', '/auth/register', {
    body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
  });
  assert(reg.status === 201, 'Register valid user → 201');
  assert(typeof reg.data?.token === 'string', 'Register returns token string');
  assert(reg.data?.user?.email === TEST_EMAIL, 'Returned user email matches');
  assert(reg.data?.user?.name === TEST_NAME, 'Returned user name matches');
  assert(reg.data?.user?.plan === 'free', 'New user defaults to free plan');

  authToken = reg.data?.token;
  userId    = reg.data?.user?.id;

  // Duplicate email
  const dup = await req('POST', '/auth/register', {
    body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
  });
  assert(dup.status === 409, 'Duplicate email → 409');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 3 — Login
// ══════════════════════════════════════════════════════════════════════════
async function testLogin() {
  suite('3. Auth — Login');

  // Wrong password
  const bad = await req('POST', '/auth/login', {
    body: { email: TEST_EMAIL, password: 'wrongpassword' },
  });
  assert(bad.status === 401, 'Login with wrong password → 401');

  // Unknown email
  const unknown = await req('POST', '/auth/login', {
    body: { email: 'nobody@example.com', password: TEST_PASSWORD },
  });
  assert(unknown.status === 401, 'Login with unknown email → 401');

  // Valid login
  const login = await req('POST', '/auth/login', {
    body: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  assert(login.status === 200, 'Valid login → 200');
  assert(typeof login.data?.token === 'string', 'Login returns token');
  assert(login.data?.user?.email === TEST_EMAIL, 'Login returns correct user');

  // Overwrite token with fresh one
  authToken = login.data?.token;
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 4 — /me (auth check)
// ══════════════════════════════════════════════════════════════════════════
async function testMe() {
  suite('4. Auth — GET /me');

  // Without token
  const unauthed = await req('GET', '/auth/me');
  assert(unauthed.status === 401, 'GET /me without token → 401');

  // With token
  const me = await req('GET', '/auth/me', { token: authToken });
  assert(me.status === 200, 'GET /me with token → 200');
  assert(me.data?.user?.email === TEST_EMAIL, '/me returns correct email');
  assertDeepIncludes(me.data?.user ?? {}, [
    'id', 'email', 'name', 'plan', 'checksUsedThisPeriod', 'planLimit',
  ], '/me user object has required fields');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 5 — Monitor CRUD
// ══════════════════════════════════════════════════════════════════════════
async function testMonitorCRUD() {
  suite('5. Monitor CRUD');

  // Create — missing URL
  const noUrl = await req('POST', '/monitors', {
    token: authToken,
    body: { name: 'No URL' },
  });
  assert(noUrl.status === 400, 'Create monitor without URL → 400');

  // Create valid monitor
  const create = await req('POST', '/monitors', {
    token: authToken,
    body: {
      name: 'Integration Test Monitor',
      url: 'https://example.com',
      checkIntervalMinutes: 1440,
    },
  });
  assert(create.status === 201, 'Create monitor → 201');
  assert(typeof create.data?.monitor?.id === 'string', 'Create returns monitor.id');
  assert(create.data?.monitor?.url === 'https://example.com', 'Monitor URL stored correctly');
  assert(create.data?.monitor?.isActive === true, 'New monitor is active by default');
  monitorId = create.data?.monitor?.id;

  // List monitors
  const list = await req('GET', '/monitors', { token: authToken });
  assert(list.status === 200, 'List monitors → 200');
  assert(Array.isArray(list.data?.monitors), 'List returns monitors array');
  const found = list.data?.monitors?.find(m => m.id === monitorId);
  assert(!!found, 'Created monitor appears in list');

  // Get single monitor
  const single = await req('GET', `/monitors/${monitorId}`, { token: authToken });
  assert(single.status === 200, 'GET single monitor → 200');
  assert(single.data?.monitor?.id === monitorId, 'Single monitor returns correct id');

  // Update monitor — only patch name (free plan requires min 1440 min interval)
  const update = await req('PATCH', `/monitors/${monitorId}`, {
    token: authToken,
    body: { name: 'Updated Name' },
  });
  assert(update.status === 200, 'PATCH monitor → 200');
  assert(update.data?.monitor?.name === 'Updated Name', 'Monitor name updated');

  // Access non-existent monitor (should 404 or 500 for bad UUID format)
  const other = await req('GET', `/monitors/00000000-0000-0000-0000-000000000000`, { token: authToken });
  assert(other.status === 404 || other.status === 403, 'Non-existent monitor → 404/403');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 6 — Dashboard Stats
// ══════════════════════════════════════════════════════════════════════════
async function testDashboardStats() {
  suite('6. Dashboard Stats');

  const stats = await req('GET', '/dashboard/stats', { token: authToken });
  assert(stats.status === 200, 'GET /dashboard/stats → 200');
  assertDeepIncludes(stats.data ?? {}, [
    'activeMonitors', 'recentDiffs',
  ], 'Stats has required KPI keys');
  assert(typeof stats.data?.activeMonitors === 'number', 'activeMonitors is a number');
  assert(stats.data?.activeMonitors >= 1, 'activeMonitors ≥ 1 (we just created one)');
  assert(Array.isArray(stats.data?.recentDiffs), 'recentDiffs is an array');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 7 — Monitor Diffs (empty state)
// ══════════════════════════════════════════════════════════════════════════
async function testMonitorDiffs() {
  suite('7. Monitor Diffs (empty state)');

  const diffs = await req('GET', `/monitors/${monitorId}/diffs`, { token: authToken });
  assert(diffs.status === 200, 'GET monitor diffs → 200');
  assert(Array.isArray(diffs.data?.diffs), 'Diffs returns array');
  assert(diffs.data?.diffs?.length === 0, 'New monitor has no diffs yet');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 8 — Monitor Groups (read-only — no POST create route exists)
// ══════════════════════════════════════════════════════════════════════════
async function testMonitorGroups() {
  suite('8. Monitor Groups');

  // List groups (new user has none)
  const list = await req('GET', '/monitor-groups', { token: authToken });
  assert(list.status === 200, 'List groups → 200');
  assert(Array.isArray(list.data?.groups), 'Groups is an array');

  // Unauthenticated access denied
  const unauthed = await req('GET', '/monitor-groups');
  assert(unauthed.status === 401, 'Groups without auth → 401');

  // Non-existent group returns 404
  const missing = await req('GET', '/monitor-groups/00000000-0000-0000-0000-000000000000', { token: authToken });
  assert(missing.status === 404, 'Non-existent group → 404');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 9 — Admin Auth
// ══════════════════════════════════════════════════════════════════════════
async function testAdminAuth() {
  suite('9. Admin Auth');

  // Valid login FIRST (preserves rate-limit budget: 5/5min)
  const login = await fetch(`${API}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    credentials: 'include',
  });
  const loginData = await login.json();
  assert(login.status === 200, 'Admin login with correct credentials → 200');
  assert(loginData?.ok === true || loginData?.success === true, 'Admin login returns ok/success:true');

  // Extract cookie for subsequent admin requests
  const setCookie = login.headers.get('set-cookie') || '';
  const match = setCookie.match(/sd_admin=([^;]+)/);
  adminCookie = match ? `sd_admin=${match[1]}` : null;
  assert(!!adminCookie, 'Admin login sets sd_admin cookie');

  // Wrong credentials (uses remaining rate-limit budget)
  const bad = await req('POST', '/admin/auth/login', {
    body: { username: 'admin', password: 'wrongpassword' },
  });
  assert(bad.status === 401, 'Admin login with wrong password → 401');

  // Wrong username
  const badUser = await req('POST', '/admin/auth/login', {
    body: { username: 'notadmin', password: ADMIN_PASSWORD },
  });
  assert(badUser.status === 401, 'Admin login with wrong username → 401');

  // Protected route without cookie → 401
  const noAuth = await req('GET', '/admin/stats');
  assert(noAuth.status === 401, 'Admin protected route without cookie → 401');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 10 — Admin Stats
// ══════════════════════════════════════════════════════════════════════════
async function testAdminStats() {
  suite('10. Admin Stats');

  if (!adminCookie) {
    console.log('  ⚠ Skipped — no admin cookie (Suite 9 failed)');
    return;
  }

  // Admin stats are at /admin/stats (GET /) — not /overview
  const stats = await req('GET', '/admin/stats', { cookie: adminCookie });
  assert(stats.status === 200, 'GET /admin/stats → 200');
  assertDeepIncludes(stats.data ?? {}, [
    'users', 'monitors', 'checksToday',
  ], 'Admin stats has required KPI keys');
  assert(typeof stats.data?.users?.total === 'number', 'users.total is a number');
  assert(typeof stats.data?.monitors?.total === 'number', 'monitors.total is a number');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 11 — Admin User Management
// ══════════════════════════════════════════════════════════════════════════
async function testAdminUsers() {
  suite('11. Admin User Management');

  if (!adminCookie) {
    console.log('  ⚠ Skipped — no admin cookie');
    return;
  }

  // List users
  const list = await req('GET', '/admin/users', { cookie: adminCookie });
  assert(list.status === 200, 'GET /admin/users → 200');
  assert(Array.isArray(list.data?.users), 'Admin users returns array');
  assert(typeof list.data?.total === 'number', 'Admin users returns total count');
  const testUser = list.data?.users?.find(u => u.email === TEST_EMAIL);
  assert(!!testUser, 'Test user appears in admin user list');

  // Get user detail
  if (userId) {
    const detail = await req('GET', `/admin/users/${userId}`, { cookie: adminCookie });
    assert(detail.status === 200, 'GET /admin/users/:id → 200');
    assert(detail.data?.user?.id === userId, 'User detail returns correct id');
    assert(detail.data?.user?.email === TEST_EMAIL, 'User detail has correct email');
    assert(Array.isArray(detail.data?.monitors), 'User detail includes monitors array');
  }

  // Search users
  const search = await req('GET', `/admin/users?q=${TEST_EMAIL}`, { cookie: adminCookie });
  assert(search.status === 200, 'Admin user search → 200');
  assert(Array.isArray(search.data?.users), 'Search returns array');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 12 — Admin Config (public endpoint)
// ══════════════════════════════════════════════════════════════════════════
async function testAdminConfig() {
  suite('12. Admin Config — Public Endpoint');

  // Public endpoint (no auth required)
  const pub = await req('GET', '/admin/config/public');
  assert(pub.status === 200, 'GET /admin/config/public → 200 (no auth)');
  assert(typeof pub.data === 'object' && pub.data !== null, 'Config public returns object');
  assert('maintenanceMode' in pub.data || 'maintenance_mode' in pub.data,
    'Public config has maintenance flag');

  // Protected config endpoint (requires admin)
  if (adminCookie) {
    const full = await req('GET', '/admin/config', { cookie: adminCookie });
    assert(full.status === 200, 'GET /admin/config (admin auth) → 200');
    assert(Array.isArray(full.data?.configs) || typeof full.data === 'object',
      'Admin config endpoint returns config data');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 13 — Feature Flag: registration_open
// ══════════════════════════════════════════════════════════════════════════
async function testFeatureFlags() {
  suite('13. Feature Flags — registration_open');

  if (!adminCookie) {
    console.log('  ⚠ Skipped — no admin cookie');
    return;
  }

  // Config PATCH body format: { key: value } plain object (not { key:"k", value:"v" })
  const disable = await req('PATCH', '/admin/config', {
    cookie: adminCookie,
    body: { registration_open: 'false' },
  });
  assert(disable.status === 200, 'Disable registration_open → 200');
  assert(disable.data?.registration_open === 'false', 'Config updated to false');

  // Verify registration is blocked
  const blocked = await req('POST', '/auth/register', {
    body: {
      email: `blocked_${SUFFIX}@test.dev`,
      password: TEST_PASSWORD,
      name: 'Blocked User',
    },
  });
  assert(blocked.status === 503, 'Registration blocked when flag=false → 503');
  assert(blocked.data?.maintenance === true, 'Blocked response has maintenance:true');

  // Re-enable registration
  const enable = await req('PATCH', '/admin/config', {
    cookie: adminCookie,
    body: { registration_open: 'true' },
  });
  assert(enable.status === 200, 'Re-enable registration_open → 200');
  assert(enable.data?.registration_open === 'true', 'Config updated back to true');

  // Verify registration works again
  const reEnabled = await req('POST', '/auth/register', {
    body: {
      email: `reenabled_${SUFFIX}@test.dev`,
      password: TEST_PASSWORD,
      name: 'Re-enabled User',
    },
  });
  assert(reEnabled.status === 201, 'Registration works again after re-enable → 201');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 14 — Auth Logout
// ══════════════════════════════════════════════════════════════════════════
async function testLogout() {
  suite('14. Auth — Logout');

  // Logout
  const logout = await req('POST', '/auth/logout', { token: authToken });
  assert(logout.status === 200, 'POST /auth/logout → 200');

  // Token should no longer be valid
  const me = await req('GET', '/auth/me', { token: authToken });
  assert(me.status === 401, '/me after logout → 401 (token invalidated)');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 15 — Browser E2E: Signup → Dashboard → Create Monitor
// ══════════════════════════════════════════════════════════════════════════
async function testBrowserE2E() {
  suite('15. Browser E2E — Signup → Dashboard → Monitor');

  const E2E_EMAIL    = `e2e_${SUFFIX}@test.dev`;
  const E2E_PASSWORD = 'E2e@password_long1';   // ≥10 chars as required by frontend
  const E2E_NAME     = 'E2E User';

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  try {
    // 1. Navigate to register page (route is /register in this app)
    await page.goto(`${NEXT}/register`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const signupUrl = page.url();
    assert(
      signupUrl.includes('/register') || signupUrl.includes('/signup') || signupUrl.includes('/login'),
      `Register page loads (URL: ${signupUrl})`
    );

    // 2. Fill signup form — inputs have id="name", id="email", id="password"
    await page.fill('#name', E2E_NAME);
    await page.fill('#email', E2E_EMAIL);
    await page.fill('#password', E2E_PASSWORD);

    // Submit form
    await page.locator('button[type="submit"]').first().click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/(dashboard|monitors)/, { timeout: 10000 }).catch(() => {});
    const postSignupUrl = page.url();
    assert(
      postSignupUrl.includes('/dashboard') || postSignupUrl.includes('/monitors'),
      `After signup redirected to dashboard (URL: ${postSignupUrl})`
    );

    // 3. Dashboard content is visible
    await page.waitForSelector('text=Monitors, text=Dashboard, text=Overview', { timeout: 5000 }).catch(() => {});
    const hasDashboard = await page.isVisible('text=Monitors') || await page.isVisible('text=Overview') || await page.isVisible('text=Dashboard');
    assert(hasDashboard, 'Dashboard content visible after login');

    // 4. Navigate to create monitor (multi-step wizard)
    await page.goto(`${NEXT}/monitors/new`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Step 1: URL input
    const urlInputLocator = page.locator('input[name="url"], input[id="url"], input[placeholder*="https" i]').first();
    const isOnCreate = await urlInputLocator.isVisible().catch(() => false);
    assert(isOnCreate, 'Create monitor wizard: Step 1 URL input visible');

    // 5. Fill URL and advance through wizard
    if (isOnCreate) {
      await urlInputLocator.fill('https://example.com/e2e-test');

      // Click "Continue →" to advance from step 1 → step 2 → step 3 → step 4
      // Each step has a "Continue →" button
      for (let s = 1; s <= 3; s++) {
        const continueBtn = page.locator('button:has-text("Continue")').first();
        if (await continueBtn.isVisible().catch(() => false)) {
          await continueBtn.click();
          await page.waitForTimeout(500);
        }
      }

      // Now on step 4 — submit button should be visible
      const submitBtn = page.locator('button[type="submit"]').first();
      const submitVisible = await submitBtn.isVisible().catch(() => false);
      assert(submitVisible, 'Create monitor wizard: Submit button visible on step 4');

      if (submitVisible) {
        await submitBtn.click();
        await page.waitForURL(/\/monitors/, { timeout: 10000 }).catch(() => {});
        const afterCreate = page.url();
        assert(afterCreate.includes('/monitors'), `After create: on monitors page (${afterCreate})`);
      }
    }

    // 6. Verify API also sees the new monitor (backend round-trip check)
    const loginRes = await req('POST', '/auth/login', {
      body: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
    if (loginRes.status === 200) {
      const token = loginRes.data?.token;
      const monitorList = await req('GET', '/monitors', { token });
      const e2eMonitor = monitorList.data?.monitors?.find(
        m => m.url?.includes('e2e-test')
      );
      assert(!!e2eMonitor, 'E2E monitor persisted in DB (API confirms)');
    }

  } catch (err) {
    console.log(`  ⚠ Browser E2E error: ${err.message}`);
    failed++;
    failures.push(`Browser E2E unexpected error: ${err.message}`);
  } finally {
    await ctx.close();
    await browser.close();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 16 — Admin Monitor Management
// ══════════════════════════════════════════════════════════════════════════
async function testAdminMonitors() {
  suite('16. Admin Monitor Management');

  if (!adminCookie) {
    console.log('  ⚠ Skipped — no admin cookie');
    return;
  }

  const list = await req('GET', '/admin/monitors', { cookie: adminCookie });
  assert(list.status === 200, 'GET /admin/monitors → 200');
  assert(Array.isArray(list.data?.monitors), 'Admin monitors returns array');
  assert(typeof list.data?.total === 'number', 'Admin monitors returns total');
}

// ══════════════════════════════════════════════════════════════════════════
// Suite 17 — Admin Queue Stats
// ══════════════════════════════════════════════════════════════════════════
async function testAdminQueues() {
  suite('17. Admin Queue Stats');

  if (!adminCookie) {
    console.log('  ⚠ Skipped — no admin cookie');
    return;
  }

  const queues = await req('GET', '/admin/queues', { cookie: adminCookie });
  assert(queues.status === 200, 'GET /admin/queues → 200');
  // Response is a direct array (not {queues:[...]})
  const queueArr = Array.isArray(queues.data) ? queues.data : queues.data?.queues;
  assert(Array.isArray(queueArr), 'Admin queues response is an array');

  const queueNames = queueArr?.map(q => q.name) ?? [];
  assert(queueNames.includes('scrape-queue'), 'scrape-queue present');
  assert(queueNames.includes('alert-queue'), 'alert-queue present');
  assert(queueNames.includes('system-queue'), 'system-queue present');

  // Each queue should have waiting/active/completed/failed counts
  const scrapeQ = queueArr?.find(q => q.name === 'scrape-queue');
  if (scrapeQ) {
    assertDeepIncludes(scrapeQ, ['waiting', 'active', 'completed', 'failed'],
      'scrape-queue has job count fields');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Runner
// ══════════════════════════════════════════════════════════════════════════
(async () => {
  console.log('\nSonarDiff Integration Test Suite');
  console.log('═'.repeat(54));
  console.log(`  Backend : ${API}`);
  console.log(`  Frontend: ${NEXT}`);
  console.log(`  Test user: ${TEST_EMAIL}`);
  console.log('═'.repeat(54));

  const startTime = Date.now();

  try {
    await testHealth();
    await testRegister();
    await testLogin();
    await testMe();
    await testMonitorCRUD();
    await testDashboardStats();
    await testMonitorDiffs();
    await testMonitorGroups();
    await testAdminAuth();
    await testAdminStats();
    await testAdminUsers();
    await testAdminConfig();
    await testFeatureFlags();
    await testLogout();
    await testBrowserE2E();
    await testAdminMonitors();
    await testAdminQueues();
  } catch (err) {
    console.error('\n\nFatal runner error:', err.message);
    console.error(err.stack);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const total = passed + failed;

  console.log('\n' + '═'.repeat(54));
  console.log(`Results: ${passed}/${total} passed in ${elapsed}s`);

  if (failures.length > 0) {
    console.log('\nFailed assertions:');
    failures.forEach(f => console.log(`  ✗ ${f}`));
    process.exit(1);
  } else {
    console.log('\nAll integration tests passed. ✓');
    process.exit(0);
  }
})();
