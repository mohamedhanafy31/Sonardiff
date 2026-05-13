import { chromium } from 'playwright-extra';
// @ts-ignore
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext, Page } from 'playwright';
import { config } from './config.js';
import { logger } from './logger.js';

chromium.use(stealthPlugin());

// Scrollbars removed from args — keeping them in the screenshot means element
// coordinates match what a normal browser (with scrollbars) shows, preventing
// the ~15px right-edge coordinate shift that --hide-scrollbars causes.
const PLAYWRIGHT_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
];

interface Session {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  url: string;
  lastUsed: number;
  closing?: boolean;
}

const SESSION_TTL_MS = 2 * 60 * 1000; // 2 min idle
const MAX_SESSIONS = 5;

const sessions = new Map<string, Session>();
// Dedupe concurrent first-time launches for the same URL
const inflight = new Map<string, Promise<Session>>();

/**
 * Scroll through the page to trigger lazy-loaded content, then return to top.
 * Extracted so callers (both launch and /screenshot route) can call it.
 */
export async function scrollAndSettle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const step = window.innerHeight;
      // Cap at 20 000 px to avoid hanging on infinite-scroll pages
      const totalHeight = Math.min(document.documentElement.scrollHeight, 20000);
      let current = 0;
      const timer = setInterval(() => {
        window.scrollTo(0, current);
        current += step;
        if (current >= totalHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 120);
    });
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

async function launch(url: string): Promise<Session> {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: PLAYWRIGHT_ARGS,
    proxy: config.proxyUrl ? { server: config.proxyUrl } : undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  // Initial scroll at launch so the session page is fully rendered
  await scrollAndSettle(page);
  return { browser, context, page, url, lastUsed: Date.now() };
}

async function evictLRU() {
  if (sessions.size < MAX_SESSIONS) return;
  let oldest: [string, Session] | null = null;
  for (const entry of sessions.entries()) {
    if (!oldest || entry[1].lastUsed < oldest[1].lastUsed) oldest = entry;
  }
  if (oldest) {
    logger.info({ url: oldest[0] }, 'DOM picker: evicting LRU session');
    await closeSession(oldest[0]);
  }
}

/**
 * Get a Playwright page for the URL — reuses an existing session if alive,
 * otherwise launches a new one. Subsequent calls for the same URL return in
 * <50ms instead of the ~3-5s a cold launch takes.
 */
export async function getSessionPage(url: string): Promise<Page> {
  const existing = sessions.get(url);
  if (existing && !existing.closing) {
    existing.lastUsed = Date.now();
    return existing.page;
  }

  const pending = inflight.get(url);
  if (pending) {
    const s = await pending;
    s.lastUsed = Date.now();
    return s.page;
  }

  const promise = (async () => {
    await evictLRU();
    const session = await launch(url);
    sessions.set(url, session);
    return session;
  })();

  inflight.set(url, promise);
  try {
    const session = await promise;
    return session.page;
  } finally {
    inflight.delete(url);
  }
}

export async function closeSession(url: string): Promise<void> {
  const s = sessions.get(url);
  if (!s) return;
  s.closing = true;
  sessions.delete(url);
  try {
    await s.browser.close();
  } catch (err) {
    logger.warn({ err, url }, 'Failed to close DOM picker session');
  }
}

// Idle reaper — runs every 30s, closes sessions idle > TTL
setInterval(() => {
  const now = Date.now();
  for (const [url, s] of sessions.entries()) {
    if (now - s.lastUsed > SESSION_TTL_MS) {
      logger.info({ url, idleMs: now - s.lastUsed }, 'DOM picker: closing idle session');
      closeSession(url).catch(() => {});
    }
  }
}, 30_000).unref();

// Best-effort cleanup on process exit
process.once('beforeExit', () => {
  for (const url of Array.from(sessions.keys())) {
    closeSession(url).catch(() => {});
  }
});
