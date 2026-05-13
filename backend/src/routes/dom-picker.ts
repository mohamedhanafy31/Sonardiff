import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { logger } from '../lib/logger.js';
import { getSessionPage, closeSession, scrollAndSettle } from '../lib/dom-picker-session.js';

// Augment the browser's Window type so TypeScript accepts the injected helpers
// inside page.evaluate() callbacks.
declare global {
  interface Window {
    __getUniqueSelector(el: Element | null): string;
    __describe(el: Element): {
      selector: string;
      tag: string;
      matchCount: number;
      box: { x: number; y: number; width: number; height: number };
    };
  }
}

const router: ReturnType<typeof Router> = Router();

router.use(requireAuth);

router.use((req: Request, res: Response, next) => {
  if (req.user?.plan !== 'pro') {
    res.status(403).json({ error: 'DOM Picker requires the Pro plan' });
    return;
  }
  next();
});

// ─── Shared DOM helpers ───────────────────────────────────────────────────────
// Injected once per session via page.addScriptTag so all evaluate() calls can
// reference getUniqueSelector() and describe() as globals — no copy-paste.
const DOM_HELPERS = `
window.__getUniqueSelector = function getUniqueSelector(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';
  if (element.id) return '#' + element.id;
  if (element.tagName === 'BODY') return 'body';
  if (element.tagName === 'HTML') return 'html';
  const parent = element.parentElement;
  if (!parent) return element.tagName.toLowerCase();
  const siblings = Array.from(parent.children).filter(c => c.tagName === element.tagName);
  const tag = element.tagName.toLowerCase();
  if (siblings.length === 1) return getUniqueSelector(parent) + ' > ' + tag;
  const index = siblings.indexOf(element) + 1;
  return getUniqueSelector(parent) + ' > ' + tag + ':nth-of-type(' + index + ')';
};
window.__describe = function describe(element) {
  const sel = window.__getUniqueSelector(element);
  const rect = element.getBoundingClientRect();
  let count = 0;
  try { count = document.querySelectorAll(sel).length; } catch { count = 0; }
  return {
    selector: sel,
    tag: element.tagName.toLowerCase(),
    matchCount: count,
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
};
`;

/** Inject DOM helpers into the page once (idempotent — skips if already present). */
async function ensureHelpers(page: import('playwright').Page): Promise<void> {
  const already = await page.evaluate(() => typeof window.__getUniqueSelector === 'function');
  if (!already) {
    await page.addScriptTag({ content: DOM_HELPERS });
  }
}

// ─── Error classifier ─────────────────────────────────────────────────────────
function classifyPlaywrightError(err: any): { status: number; error: string } {
  const msg = String(err?.message || err || '');
  if (msg.includes("Executable doesn't exist") || msg.includes('playwright install')) {
    return { status: 503, error: 'Page preview is temporarily unavailable. The browser engine is not installed on the server.' };
  }
  if (msg.includes('Timeout') || msg.includes('timeout')) {
    return { status: 504, error: 'Page took too long to load. It may be very slow or unreachable.' };
  }
  if (msg.includes('net::ERR_NAME_NOT_RESOLVED') || msg.includes('ENOTFOUND')) {
    return { status: 400, error: 'Could not resolve that URL. Check the address and try again.' };
  }
  if (msg.includes('net::ERR_CONNECTION') || msg.includes('ECONNREFUSED')) {
    return { status: 502, error: 'Could not connect to the page. The site may be down.' };
  }
  return { status: 502, error: 'Failed to load the page. It may be blocking automated browsers.' };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/dom-picker/screenshot
 * Always scrolls-and-settles before capturing so cached sessions also show
 * fully lazy-loaded content (Bug 4 fix).
 */
router.post('/screenshot', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  try {
    const page = await getSessionPage(url);

    // Re-run scroll-and-settle every time so cached sessions also capture
    // lazy-loaded content that may have appeared after the initial launch.
    await scrollAndSettle(page);
    await ensureHelpers(page);

    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 75, fullPage: true });
    // After full-page screenshot scroll back to top so getBoundingClientRect() == absolute coords
    await page.evaluate(() => window.scrollTo(0, 0));

    const meta = await page.evaluate(() => {
      const SKIP = new Set(['HTML','BODY','SCRIPT','STYLE','HEAD','META','LINK','NOSCRIPT','BR']);
      const els: Array<{ selector: string; tag: string; box: { x: number; y: number; width: number; height: number } }> = [];
      const all = document.querySelectorAll('*');
      const dw = document.documentElement.scrollWidth;
      const dh = document.documentElement.scrollHeight;
      for (const el of Array.from(all)) {
        if (SKIP.has(el.tagName)) continue;
        const rect = el.getBoundingClientRect();
        // Bug 6: filter out invisible wrappers and hairline rules
        if (rect.width < 50 || rect.height < 20) continue;
        if (rect.x + rect.width <= 0 || rect.y + rect.height <= 0) continue;
        if (rect.x >= dw || rect.y >= dh) continue;
        els.push({
          selector: window.__getUniqueSelector(el),
          tag: el.tagName.toLowerCase(),
          box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
      }
      // Bug 6: raised cap from 1200 → 2500; element JSON is tiny vs JPEG payload
      return { width: dw, height: dh, elements: els.slice(0, 2500) };
    });

    res.json({
      screenshot: `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`,
      dimensions: { width: meta.width, height: meta.height },
      elements: meta.elements,
    });
  } catch (err: any) {
    logger.error({ err, url }, 'Failed to take DOM picker screenshot');
    closeSession(url).catch(() => {});
    const { status, error } = classifyPlaywrightError(err);
    res.status(status).json({ error });
  }
});

/**
 * POST /api/dom-picker/resolve
 * (x, y) → full element info (selector, tag, box, matchCount, ancestors[], children[]).
 */
router.post('/resolve', async (req: Request, res: Response) => {
  const { url, x, y } = req.body;
  if (!url || typeof x !== 'number' || typeof y !== 'number') {
    res.status(400).json({ error: 'URL, x, and y coordinates are required' });
    return;
  }

  try {
    const page = await getSessionPage(url);
    await ensureHelpers(page);
    // Ensure scroll is at top so getBoundingClientRect() == absolute page coords
    await page.evaluate(() => window.scrollTo(0, 0));

    const result = await page.evaluate(({ absX, absY }) => {
      const SKIP = new Set(['HTML','BODY','SCRIPT','STYLE','HEAD','META','LINK','NOSCRIPT']);
      let el: Element | null = null;
      let bestArea = Infinity;
      for (const candidate of Array.from(document.querySelectorAll('*'))) {
        if (SKIP.has(candidate.tagName)) continue;
        const rect = candidate.getBoundingClientRect();
        if (absX >= rect.x && absX <= rect.x + rect.width &&
            absY >= rect.y && absY <= rect.y + rect.height) {
          const area = rect.width * rect.height;
          if (area < bestArea) { el = candidate; bestArea = area; }
        }
      }
      if (!el) return null;

      const ancestors: ReturnType<typeof window.__describe>[] = [];
      let cur: Element | null = el.parentElement;
      let depth = 0;
      while (cur && depth < 5 && cur.tagName !== 'HTML') {
        ancestors.push(window.__describe(cur));
        cur = cur.parentElement;
        depth += 1;
      }
      const children: ReturnType<typeof window.__describe>[] = [];
      if (el.firstElementChild) children.push(window.__describe(el.firstElementChild));

      const prevSibling = el.previousElementSibling ? window.__describe(el.previousElementSibling) : null;
      const nextSibling = el.nextElementSibling ? window.__describe(el.nextElementSibling) : null;

      return { ...window.__describe(el), ancestors, children, prevSibling, nextSibling };
    }, { absX: x, absY: y });

    if (!result) {
      res.status(400).json({ error: 'No element found at those coordinates' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    logger.error({ err, url, x, y }, 'Failed to resolve DOM selector');
    closeSession(url).catch(() => {});
    const { status, error } = classifyPlaywrightError(err);
    res.status(status).json({ error });
  }
});

/**
 * POST /api/dom-picker/test-selector
 */
router.post('/test-selector', async (req: Request, res: Response) => {
  const { url, selector } = req.body;
  if (!url || !selector) {
    res.status(400).json({ error: 'URL and selector are required' });
    return;
  }

  try {
    const page = await getSessionPage(url);
    const matchedContent = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return (el as HTMLElement).innerText || el.textContent;
    }, selector);

    if (matchedContent === null) {
      res.status(404).json({ error: 'No element matched that selector.' });
      return;
    }
    res.json({ content: matchedContent });
  } catch (err: any) {
    logger.error({ err, url, selector }, 'Failed to test DOM selector');
    closeSession(url).catch(() => {});
    const { status, error } = classifyPlaywrightError(err);
    res.status(status).json({ error });
  }
});

/**
 * POST /api/dom-picker/inspect-selector
 * Selector → full element info — powers Wider/Narrower navigation.
 */
router.post('/inspect-selector', async (req: Request, res: Response) => {
  const { url, selector } = req.body;
  if (!url || !selector) {
    res.status(400).json({ error: 'URL and selector are required' });
    return;
  }

  try {
    const page = await getSessionPage(url);
    await ensureHelpers(page);
    await page.evaluate(() => window.scrollTo(0, 0));

    const result = await page.evaluate((sel) => {
      let el: Element | null;
      try { el = document.querySelector(sel); } catch { return null; }
      if (!el) return null;

      const ancestors: ReturnType<typeof window.__describe>[] = [];
      let cur: Element | null = el.parentElement;
      let depth = 0;
      while (cur && depth < 5 && cur.tagName !== 'HTML') {
        ancestors.push(window.__describe(cur));
        cur = cur.parentElement;
        depth += 1;
      }
      const children: ReturnType<typeof window.__describe>[] = [];
      if (el.firstElementChild) children.push(window.__describe(el.firstElementChild));

      const prevSibling = el.previousElementSibling ? window.__describe(el.previousElementSibling) : null;
      const nextSibling = el.nextElementSibling ? window.__describe(el.nextElementSibling) : null;

      return { ...window.__describe(el), ancestors, children, prevSibling, nextSibling };
    }, selector);

    if (!result) {
      res.status(404).json({ error: 'No element matched that selector' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    logger.error({ err, url, selector }, 'Failed to inspect selector');
    closeSession(url).catch(() => {});
    const { status, error } = classifyPlaywrightError(err);
    res.status(status).json({ error });
  }
});

/**
 * POST /api/dom-picker/close-session
 * Optional — frontend calls this when the picker closes to free the cached
 * browser immediately instead of waiting for the 2-min idle TTL.
 */
router.post('/close-session', (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }
  closeSession(url).catch(() => {});
  res.json({ success: true });
});

export { router as domPickerRouter };
