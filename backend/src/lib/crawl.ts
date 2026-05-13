/**
 * Site discovery crawler — three layered strategies, used in order:
 *   1. Sitemap (robots.txt → sitemap.xml → sitemap_index.xml, recursive)
 *   2. Cheerio HTML parse of the homepage (anchor extraction)
 *   3. Playwright render + anchor extraction (catches SPAs)
 *
 * Returns a normalized, deduped, capped list of same-host URLs with optional
 * titles. Each layer is only invoked if the previous returned < MIN_RESULTS.
 *
 * The caller (BullMQ worker) reports per-phase progress via job.updateProgress().
 */

import * as cheerio from 'cheerio';
import { logger } from './logger.js';
import { chromium } from 'playwright-extra';
// @ts-ignore
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from './config.js';

chromium.use(stealthPlugin());

const MAX_URLS = 200;
const MIN_RESULTS_BEFORE_FALLBACK = 3;
const SITEMAP_FETCH_TIMEOUT_MS = 8000;
const HTML_FETCH_TIMEOUT_MS = 12000;
const PLAYWRIGHT_TIMEOUT_MS = 30000;
const TITLE_FETCH_CONCURRENCY = 5;
const TITLE_FETCH_LIMIT = 30; // only enrich the first N URLs with titles
const PLAYWRIGHT_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas', '--disable-gpu', '--hide-scrollbars',
];

const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|ico|mp[34]|wav|zip|tar|gz|css|js|json|xml|woff2?|ttf|eot)(?:\?|#|$)/i;
const TRACKING_PARAMS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','mc_cid','mc_eid','ref','source'];

export type DiscoveredUrl = {
  url: string;
  path: string;
  title?: string;
  lastmod?: string;
  source: 'sitemap' | 'html' | 'playwright';
};

export type CrawlResult = {
  baseUrl: string;
  hostname: string;
  urls: DiscoveredUrl[];
  sitemapFound: boolean;
  fallbackUsed: 'none' | 'html' | 'playwright';
  totalDiscovered: number; // before cap
};

export type ProgressFn = (msg: string) => void;

/* ──────────────────── normalization & filtering ──────────────────── */

function normalizeBase(input: string): URL {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  const u = new URL(s);
  // Strip path/query/fragment → just origin for the base
  return new URL(u.origin + '/');
}

function sameHost(a: URL, b: URL): boolean {
  return a.hostname.toLowerCase() === b.hostname.toLowerCase();
}

/** Normalize a URL: drop fragment, strip tracking params, trim trailing slash from path. */
function normalizeUrl(raw: string, base: URL): URL | null {
  let u: URL;
  try { u = new URL(raw, base); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (!sameHost(u, base)) return null;
  if (SKIP_EXT.test(u.pathname)) return null;
  u.hash = '';
  for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
  // Normalize trailing slash on non-root paths
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/, '');
  }
  return u;
}

/* ──────────────────── HTTP helpers ──────────────────── */

async function fetchText(url: string, timeoutMs: number): Promise<{ status: number; body: string } | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        // Many sites 403 a bare default UA — pretend to be a normal browser.
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const body = await r.text();
    return { status: r.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* ──────────────────── sitemap layer ──────────────────── */

async function parseSitemapXml(xml: string, base: URL, depth: number, seen: Set<string>): Promise<Array<{ url: URL; lastmod?: string }>> {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out: Array<{ url: URL; lastmod?: string }> = [];

  // sitemap-index?
  const sitemaps = $('sitemap > loc').toArray().map(el => $(el).text().trim());
  if (sitemaps.length > 0 && depth < 2) {
    for (const sm of sitemaps) {
      if (seen.has(sm) || out.length >= MAX_URLS * 4) break;
      seen.add(sm);
      const child = await fetchText(sm, SITEMAP_FETCH_TIMEOUT_MS);
      if (!child || child.status !== 200) continue;
      const childUrls = await parseSitemapXml(child.body, base, depth + 1, seen);
      out.push(...childUrls);
    }
  }

  // urlset
  $('url').each((_, el) => {
    const loc = $(el).find('loc').first().text().trim();
    const lastmod = $(el).find('lastmod').first().text().trim() || undefined;
    if (!loc) return;
    const u = normalizeUrl(loc, base);
    if (u) out.push({ url: u, lastmod });
  });

  return out;
}

async function tryRobotsForSitemaps(base: URL): Promise<string[]> {
  const robotsUrl = new URL('/robots.txt', base).toString();
  const r = await fetchText(robotsUrl, SITEMAP_FETCH_TIMEOUT_MS);
  if (!r || r.status !== 200) return [];
  const out: string[] = [];
  for (const line of r.body.split(/\r?\n/)) {
    const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
    if (m) out.push(m[1].trim());
  }
  return out;
}

async function discoverViaSitemap(base: URL, progress: ProgressFn): Promise<DiscoveredUrl[]> {
  progress('Reading robots.txt for sitemap…');
  const candidates = new Set<string>();
  for (const sm of await tryRobotsForSitemaps(base)) candidates.add(sm);
  for (const path of ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml']) {
    candidates.add(new URL(path, base).toString());
  }

  const seenSitemaps = new Set<string>();
  const collected: Array<{ url: URL; lastmod?: string }> = [];

  for (const sm of candidates) {
    if (seenSitemaps.has(sm)) continue;
    seenSitemaps.add(sm);
    progress(`Fetching ${new URL(sm).pathname}…`);
    const r = await fetchText(sm, SITEMAP_FETCH_TIMEOUT_MS);
    if (!r || r.status !== 200) continue;
    if (!r.body.includes('<')) continue; // not XML
    try {
      const urls = await parseSitemapXml(r.body, base, 0, seenSitemaps);
      collected.push(...urls);
    } catch {
      /* skip malformed sitemap */
    }
  }

  // Dedupe by normalized URL string
  const seenUrls = new Set<string>();
  const out: DiscoveredUrl[] = [];
  for (const { url, lastmod } of collected) {
    const s = url.toString();
    if (seenUrls.has(s)) continue;
    seenUrls.add(s);
    out.push({ url: s, path: url.pathname || '/', lastmod, source: 'sitemap' });
  }
  return out;
}

/* ──────────────────── HTML (cheerio) layer ──────────────────── */

async function discoverViaHtml(base: URL, progress: ProgressFn): Promise<DiscoveredUrl[]> {
  progress('Fetching homepage HTML…');
  const r = await fetchText(base.toString(), HTML_FETCH_TIMEOUT_MS);
  if (!r || r.status >= 400 || !r.body) return [];
  const $ = cheerio.load(r.body);
  const seen = new Set<string>();
  const out: DiscoveredUrl[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const u = normalizeUrl(href, base);
    if (!u) return;
    const s = u.toString();
    if (seen.has(s)) return;
    seen.add(s);
    const title = ($(el).attr('title') || $(el).text() || '').trim().slice(0, 120);
    out.push({ url: s, path: u.pathname || '/', title: title || undefined, source: 'html' });
  });
  return out;
}

/* ──────────────────── Playwright fallback ──────────────────── */

async function discoverViaPlaywright(base: URL, progress: ProgressFn): Promise<DiscoveredUrl[]> {
  progress('Launching browser to render the page…');
  let browser;
  try {
    browser = await chromium.launch({
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
    await page.goto(base.toString(), { waitUntil: 'networkidle', timeout: PLAYWRIGHT_TIMEOUT_MS });
    progress('Extracting links from rendered DOM…');
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).map(a => ({
        href: (a as HTMLAnchorElement).href,
        text: (a.textContent || '').trim().slice(0, 120),
      }))
    );
    const seen = new Set<string>();
    const out: DiscoveredUrl[] = [];
    for (const { href, text } of hrefs) {
      const u = normalizeUrl(href, base);
      if (!u) continue;
      const s = u.toString();
      if (seen.has(s)) continue;
      seen.add(s);
      out.push({ url: s, path: u.pathname || '/', title: text || undefined, source: 'playwright' });
    }
    return out;
  } catch (err) {
    logger.warn({ err, base: base.toString() }, 'Playwright discovery fallback failed');
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/* ──────────────────── title enrichment ──────────────────── */

async function fetchTitle(url: string): Promise<string | undefined> {
  const r = await fetchText(url, HTML_FETCH_TIMEOUT_MS);
  if (!r || r.status >= 400) return undefined;
  const m = r.body.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!m) return undefined;
  return m[1].trim().replace(/\s+/g, ' ').slice(0, 120) || undefined;
}

async function enrichTitles(urls: DiscoveredUrl[], progress: ProgressFn): Promise<void> {
  // Only enrich URLs that don't already have a title
  const targets = urls.filter(u => !u.title).slice(0, TITLE_FETCH_LIMIT);
  if (targets.length === 0) return;
  progress(`Fetching titles for ${targets.length} pages…`);

  let cursor = 0;
  const next = (): DiscoveredUrl | null => (cursor < targets.length ? targets[cursor++] : null);
  await Promise.all(
    Array.from({ length: TITLE_FETCH_CONCURRENCY }, async () => {
      while (true) {
        const t = next();
        if (!t) return;
        const title = await fetchTitle(t.url);
        if (title) t.title = title;
      }
    })
  );
}

/* ──────────────────── public entrypoint ──────────────────── */

export async function discover(rawUrl: string, progress: ProgressFn = () => {}): Promise<CrawlResult> {
  const base = normalizeBase(rawUrl);
  progress('Starting discovery…');

  // Always include the base URL itself as a candidate
  const baseEntry: DiscoveredUrl = {
    url: base.toString(),
    path: '/',
    source: 'html',
  };

  // Layer 1: sitemap
  const sitemap = await discoverViaSitemap(base, progress);
  let urls = sitemap.slice();
  let sitemapFound = sitemap.length > 0;
  let fallbackUsed: CrawlResult['fallbackUsed'] = 'none';

  // Layer 2: HTML fallback
  if (urls.length < MIN_RESULTS_BEFORE_FALLBACK) {
    const html = await discoverViaHtml(base, progress);
    if (html.length > 0) {
      // Merge with sitemap results, deduping
      const seen = new Set(urls.map(u => u.url));
      for (const u of html) {
        if (!seen.has(u.url)) { urls.push(u); seen.add(u.url); }
      }
      fallbackUsed = 'html';
    }
  }

  // Layer 3: Playwright fallback
  if (urls.length < MIN_RESULTS_BEFORE_FALLBACK) {
    const pw = await discoverViaPlaywright(base, progress);
    if (pw.length > 0) {
      const seen = new Set(urls.map(u => u.url));
      for (const u of pw) {
        if (!seen.has(u.url)) { urls.push(u); seen.add(u.url); }
      }
      fallbackUsed = 'playwright';
    }
  }

  // Always include the base URL if not already present
  if (!urls.find(u => u.url === baseEntry.url)) urls.unshift(baseEntry);

  const totalDiscovered = urls.length;
  if (urls.length > MAX_URLS) urls = urls.slice(0, MAX_URLS);

  // Sort: shortest paths first (homepage, top-level sections), then alpha
  urls.sort((a, b) => {
    const da = (a.path.match(/\//g) || []).length;
    const db = (b.path.match(/\//g) || []).length;
    if (da !== db) return da - db;
    return a.path.localeCompare(b.path);
  });

  // Title enrichment for top results (cheap nice-to-have)
  await enrichTitles(urls, progress);

  progress(`Done — found ${urls.length} pages.`);
  return {
    baseUrl: base.toString(),
    hostname: base.hostname,
    urls,
    sitemapFound,
    fallbackUsed,
    totalDiscovered,
  };
}
