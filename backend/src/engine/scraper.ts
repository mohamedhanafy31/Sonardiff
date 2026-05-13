import { chromium } from 'playwright-extra';
import type { Browser, Route } from 'playwright';
// @ts-ignore - Stealth plugin lacks perfect TS exports
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { extractFingerprint, relocateElement, type Fingerprint } from './fingerprint.js';

chromium.use(stealthPlugin());

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const BOT_SIGNALS = ['cf-mitigated', '__cf_chl_jschl_tk__', 'Just a moment...', 'Checking your browser', 'cf-ray'];

interface ScrapeResult {
  htmlPath: string | null;
  textPath: string | null;
  screenshotPath: string | null;
  extractedText: string;
  httpStatus: number | null;
  error: string | null;
  detectedTier: number;
  elementFingerprint: Fingerprint | null;
  selectorRelocated: boolean;
}

async function ensureDir(dirPath: string) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export function extractVisibleText(html: string, cssSelector: string | null): string {
  const $ = cheerio.load(html);
  const root = cssSelector ? $(cssSelector) : $('body');
  if (root.length === 0) return '';
  root.find('script, style, noscript, svg, path, iframe, object, embed, canvas').remove();
  const text = root.text();
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Extracts text from HTML with optional CSS selector + fingerprint-based recovery.
 * Returns the text, a fingerprint of the matched element, and whether relocation occurred.
 */
export function extractWithFingerprint(
  html: string,
  cssSelector: string | null,
  knownFingerprint: Fingerprint | null
): { text: string; fingerprint: Fingerprint | null; relocated: boolean } {
  const $ = cheerio.load(html);
  let relocated = false;
  let fingerprint: Fingerprint | null = null;

  if (!cssSelector) {
    const root = $('body');
    root.find('script, style, noscript, svg, path, iframe, object, embed, canvas').remove();
    const text = root.text().split('\n').map(l => l.trim()).filter(Boolean).join('\n');
    return { text, fingerprint: null, relocated: false };
  }

  let root = $(cssSelector);

  if (root.length === 0 && knownFingerprint) {
    const recovered = relocateElement($, knownFingerprint);
    if (recovered.length === 1) {
      root = recovered;
      relocated = true;
      logger.info({ cssSelector }, 'CSS selector relocated via fingerprint');
    }
  }

  if (root.length === 0) {
    return { text: '', fingerprint: null, relocated: false };
  }

  try {
    fingerprint = extractFingerprint(root);
  } catch {
    // Non-critical — fingerprint extraction failed
  }

  root.find('script, style, noscript, svg, path, iframe, object, embed, canvas').remove();
  const text = root.text().split('\n').map(l => l.trim()).filter(Boolean).join('\n');
  return { text, fingerprint, relocated };
}

function generateSnapshotPrefix(monitorId: string): string {
  const timestamp = new Date().getTime();
  const random = crypto.randomBytes(4).toString('hex');
  return `${monitorId}_${timestamp}_${random}`;
}

async function fetchTier1(url: string): Promise<{ html: string; status: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': CHROME_UA },
    });
    const html = await response.text();
    return { html, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

function isJsHeavy(html: string): boolean {
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();
  const text = $('body').text().trim();
  return text.length < 500;
}

function isBotBlocked(html: string, status: number | null): boolean {
  if (status === 403 || status === 503) return true;
  return BOT_SIGNALS.some(signal => html.includes(signal));
}

async function scrapeWithBrowser(
  monitorId: string,
  url: string,
  cssSelector: string | null,
  stealth: boolean,
  snapshotsDir: string,
  prefix: string,
  knownFingerprint: Fingerprint | null = null
): Promise<{ html: string; extractedText: string; httpStatus: number | null; screenshotPath: string | null; htmlPath: string; textPath: string; elementFingerprint: Fingerprint | null; selectorRelocated: boolean }> {
  const htmlPath = path.join(snapshotsDir, `${prefix}.html`);
  const textPath = path.join(snapshotsDir, `${prefix}.txt`);
  const screenshotFilePath = path.join(snapshotsDir, `${prefix}.jpeg`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--hide-scrollbars',
    ],
    proxy: config.proxyUrl ? { server: config.proxyUrl } : undefined,
  });

  let screenshotPath: string | null = null;
  let httpStatus: number | null = null;
  let html = '';

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: CHROME_UA,
    });
    const page = await context.newPage();

    await page.route('**/*.{png,jpg,jpeg,gif,svg,mp4,webm,avif,woff,woff2}', (route: Route) => route.abort());

    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for SPA rendering
    httpStatus = response?.status() ?? null;
    html = await page.content();

    await fs.writeFile(htmlPath, html, 'utf-8');
    const extracted = extractWithFingerprint(html, cssSelector, knownFingerprint);
    await fs.writeFile(textPath, extracted.text, 'utf-8');

    try {
      await page.screenshot({ path: screenshotFilePath, type: 'jpeg', quality: 50, fullPage: true });
      screenshotPath = screenshotFilePath;
    } catch (err) {
      logger.warn({ err, monitorId, url }, 'Failed to capture screenshot');
    }

    return {
      html,
      extractedText: extracted.text,
      elementFingerprint: extracted.fingerprint,
      selectorRelocated: extracted.relocated,
      httpStatus,
      screenshotPath,
      htmlPath,
      textPath,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function scrapeUrl(
  monitorId: string,
  url: string,
  cssSelector: string | null,
  knownTier: number | null = null,
  knownFingerprint: Fingerprint | null = null
): Promise<ScrapeResult> {
  const snapshotsDir = path.join(config.dataDir, 'snapshots');
  await ensureDir(snapshotsDir);
  const prefix = generateSnapshotPrefix(monitorId);

  const result: ScrapeResult = {
    htmlPath: null,
    textPath: null,
    screenshotPath: null,
    extractedText: '',
    httpStatus: null,
    error: null,
    detectedTier: knownTier ?? 1,
    elementFingerprint: null,
    selectorRelocated: false,
  };

  try {
    // Tier 1: plain HTTP
    if (knownTier === null || knownTier === 1) {
      let html: string;
      let status: number | null;

      try {
        ({ html, status } = await fetchTier1(url));
      } catch (err: any) {
        // Tier 1 network failure → escalate
        if (knownTier === 1) {
          result.error = err.message || 'Tier 1 fetch failed';
          result.detectedTier = 3; // signal re-queue at higher tier
          return result;
        }
        throw err;
      }

      if (isBotBlocked(html, status)) {
        if (knownTier === 1) {
          result.detectedTier = 3;
          result.error = 'bot_blocked';
          return result;
        }
        // auto-detect: skip to Tier 3
        logger.info({ monitorId, url }, 'Bot block detected, escalating to Tier 3');
        const browserResult = await scrapeWithBrowser(monitorId, url, cssSelector, true, snapshotsDir, prefix, knownFingerprint);
        result.htmlPath = browserResult.htmlPath;
        result.textPath = browserResult.textPath;
        result.screenshotPath = browserResult.screenshotPath;
        result.extractedText = browserResult.extractedText;
        result.elementFingerprint = browserResult.elementFingerprint;
        result.selectorRelocated = browserResult.selectorRelocated;
        result.httpStatus = browserResult.httpStatus;
        result.detectedTier = 3;
        return result;
      }

      if (knownTier === null && isJsHeavy(html)) {
        // auto-detect: escalate to Tier 2
        logger.info({ monitorId, url }, 'JS-heavy page detected, escalating to Tier 2');
        const browserResult = await scrapeWithBrowser(monitorId, url, cssSelector, false, snapshotsDir, prefix, knownFingerprint);
        result.htmlPath = browserResult.htmlPath;
        result.textPath = browserResult.textPath;
        result.screenshotPath = browserResult.screenshotPath;
        result.extractedText = browserResult.extractedText;
        result.elementFingerprint = browserResult.elementFingerprint;
        result.selectorRelocated = browserResult.selectorRelocated;
        result.httpStatus = browserResult.httpStatus;
        result.detectedTier = 2;
        return result;
      }

      // Tier 1 success — no browser, no screenshot
      const extracted = extractWithFingerprint(html, cssSelector, knownFingerprint);
      result.extractedText = extracted.text;
      result.elementFingerprint = extracted.fingerprint;
      result.selectorRelocated = extracted.relocated;
      result.httpStatus = status;
      result.detectedTier = 1;

      const htmlPath = path.join(snapshotsDir, `${prefix}.html`);
      const textPath = path.join(snapshotsDir, `${prefix}.txt`);
      await fs.writeFile(htmlPath, html, 'utf-8');
      await fs.writeFile(textPath, result.extractedText, 'utf-8');
      result.htmlPath = htmlPath;
      result.textPath = textPath;
      return result;
    }

    // Tier 2: headless without stealth
    if (knownTier === 2) {
      const browserResult = await scrapeWithBrowser(monitorId, url, cssSelector, false, snapshotsDir, prefix, knownFingerprint);
      result.htmlPath = browserResult.htmlPath;
      result.textPath = browserResult.textPath;
      result.screenshotPath = browserResult.screenshotPath;
      result.extractedText = browserResult.extractedText;
      result.elementFingerprint = browserResult.elementFingerprint;
      result.selectorRelocated = browserResult.selectorRelocated;
      result.httpStatus = browserResult.httpStatus;
      result.detectedTier = 2;
      return result;
    }

    // Tier 3: headless + stealth (current original behavior)
    const browserResult = await scrapeWithBrowser(monitorId, url, cssSelector, true, snapshotsDir, prefix, knownFingerprint);
    result.htmlPath = browserResult.htmlPath;
    result.textPath = browserResult.textPath;
    result.screenshotPath = browserResult.screenshotPath;
    result.extractedText = browserResult.extractedText;
    result.elementFingerprint = browserResult.elementFingerprint;
    result.selectorRelocated = browserResult.selectorRelocated;
    result.httpStatus = browserResult.httpStatus;
    result.detectedTier = 3;
    return result;

  } catch (err: any) {
    logger.error({ err, monitorId, url }, 'Scrape error');
    result.error = err.message || 'Unknown scrape error';
    return result;
  }
}
