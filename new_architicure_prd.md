
# SonarDiff: MVP → Production SaaS Upgrade Plan

## Concrete Changes to artifacts/mvp (Node + Playwright + Upgrades)

**Status:** Ready to implement

**Timeline:** 2-3 weeks

**Scope:** Keep 65% of existing code, upgrade 35%

---

## Part 1: Database Schema Additions

These are **NEW columns and tables** — existing ones are left alone.

### 1.1 Monitors Table (ADD Columns)

```sql
ALTER TABLE monitors ADD COLUMN (
  fetcher_tier SMALLINT,                 -- NULL | 1 | 2 | 3 (auto-detect on first run)
  change_threshold FLOAT DEFAULT 0.01,   -- delta > 0.01 triggers alert (1% minimum change)
  element_fingerprint JSONB,             -- Scrapling adaptive selector state (if css_selector used)
  status TEXT DEFAULT 'active'           -- active | paused | unreachable
);

CREATE INDEX idx_monitors_status ON monitors(user_id, status);
```

### 1.2 New: Quota Usage Table

```sql
CREATE TABLE quota_usage (
  user_id UUID REFERENCES users NOT NULL,
  month DATE NOT NULL,
  checks_used INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, month)
);

-- Seed current month for all users on signup
-- Monthly reset via cron job (see worker section)
```

### 1.3 Snapshots Table Rename/Modify

Current: `diffs` table stores file paths
New: rename to `snapshots`, store content directly

```sql
ALTER TABLE diffs RENAME TO snapshots;

ALTER TABLE snapshots (
  ADD COLUMN content TEXT,                  -- raw HTML/text (not file path)
  ADD COLUMN content_hash TEXT,             -- SHA-256(content) for dedup
  ADD COLUMN diff_html TEXT,                -- pre-rendered HTML diff for email
  DROP COLUMN file_path
);

CREATE INDEX idx_snapshots_hash ON snapshots(monitor_id, content_hash);
```

### 1.4 Drizzle Migration (if you use Drizzle)

```typescript
// migrations/001_add_tier_and_threshold.sql
ALTER TABLE monitors ADD COLUMN fetcher_tier SMALLINT;
ALTER TABLE monitors ADD COLUMN change_threshold FLOAT DEFAULT 0.01;
ALTER TABLE monitors ADD COLUMN element_fingerprint JSONB;
ALTER TABLE monitors ADD COLUMN status TEXT DEFAULT 'active';

ALTER TABLE diffs RENAME TO snapshots;
ALTER TABLE snapshots ADD COLUMN content TEXT;
ALTER TABLE snapshots ADD COLUMN content_hash TEXT;
ALTER TABLE snapshots ADD COLUMN diff_html TEXT;
ALTER TABLE snapshots DROP COLUMN file_path;

CREATE TABLE quota_usage (
  user_id UUID REFERENCES users NOT NULL,
  month DATE NOT NULL,
  checks_used INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
```

---

## Part 2: Backend Code Changes

### 2.1 Auth Migration: Custom → Supabase Auth

**CURRENT (delete):**

```typescript
// backend/routes/auth.ts
// Custom bcrypt + sessions logic
```

**REPLACE WITH:**

```typescript
// backend/middleware/auth.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error) return res.status(401).json({ error: 'Invalid token' });

  req.user = data.user;
  next();
};
```

**Action:** Swap `backend/routes/auth.ts` for middleware that verifies Supabase tokens.

---

### 2.2 Scraper: Add Tier 1 Detection

**FILE:** `backend/scraper.ts` (existing, modify)

**CURRENT:**

```typescript
export async function scrapeUrl(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  // ... stealth setup ...
  await page.goto(url, { waitUntil: 'networkidle2' });
  const html = await page.content();
  await browser.close();
  return html;
}
```

**UPGRADE:**

```typescript
export async function scrapeUrl(
  url: string,
  tier: number | null
): Promise<{ html: string; detectedTier: number }> {
  let html: string;
  let detectedTier = tier || 1;

  // Tier 1: Try plain HTTP first (no browser)
  if (detectedTier === 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        },
      });
      html = await res.text();
    
      // Detect if page is JS-heavy (placeholder content, no meaningful text)
      if (isJsHeavy(html)) {
        detectedTier = 2;  // Escalate to headless
      } else {
        return { html, detectedTier: 1 };  // Success, return
      }
    } catch (e) {
      detectedTier = 2;  // Network error, try headless
    }
  }

  // Tier 2: Playwright headless (no stealth, faster)
  if (detectedTier === 2) {
    try {
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });
      html = await page.content();
      await browser.close();
      return { html, detectedTier: 2 };
    } catch (e) {
      detectedTier = 3;  // JS render failed, try stealth
    }
  }

  // Tier 3: Playwright + puppeteer-extra stealth (current code)
  if (detectedTier === 3) {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await addStealth(page);
    await page.goto(url, { waitUntil: 'networkidle2' });
    html = await page.content();
    await browser.close();
    return { html, detectedTier: 3 };
  }

  throw new Error(`Failed to scrape after all tiers: ${url}`);
}

// Helper: detect JS-heavy pages
function isJsHeavy(html: string): boolean {
  // If <body> is mostly empty or contains React/Vue mount points, it's JS-heavy
  const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/is);
  if (!bodyMatch) return true;
  
  const bodyContent = bodyMatch[1];
  const textLength = bodyContent.replace(/<[^>]+>/g, '').length;
  
  return textLength < 500;  // Less than 500 chars of text = likely JS placeholder
}
```

**Changes:**

* Add `tier` parameter to existing `scrapeUrl`
* Check Tier 1 (HTTP) first
* Auto-escalate on empty content or network error
* Return `{ html, detectedTier }` so we can save the tier to DB

---

### 2.3 Diff Engine: Add Threshold + Line-Based Diffing

**FILE:** `backend/diff.ts` (existing, modify)

**CURRENT:**

```typescript
export function diffContent(baseline: string, current: string): DiffResult {
  const diff = require('diff').diffLines(baseline, current);
  return { diff, hasChanges: diff.some(d => d.added || d.removed) };
}
```

**UPGRADE:**

```typescript
import crypto from 'crypto';

interface DiffResult {
  changed: boolean;
  delta: number;                    // 0-1 ratio of changed content
  diffLines: Array<{ type: 'added' | 'removed' | 'kept'; text: string }>;
  contentHash: string;
}

export function diffContent(
  baseline: string,
  current: string,
  threshold: number = 0.01
): DiffResult {
  const baselineLines = baseline.split('\n');
  const currentLines = current.split('\n');

  const sm = new SequenceMatcher(null, baselineLines, currentLines);
  const delta = 1.0 - sm.ratio();   // 1.0 = completely different, 0.0 = identical

  const diffLines: DiffResult['diffLines'] = [];
  for (const opcode of sm.getOpcodes()) {
    const [op, i1, i2, j1, j2] = opcode;
    if (op === 'replace' || op === 'delete') {
      for (let i = i1; i < i2; i++) {
        diffLines.push({ type: 'removed', text: baselineLines[i] });
      }
    }
    if (op === 'replace' || op === 'insert') {
      for (let j = j1; j < j2; j++) {
        diffLines.push({ type: 'added', text: currentLines[j] });
      }
    }
  }

  const contentHash = crypto.createHash('sha256').update(current).digest('hex');

  return {
    changed: delta > threshold,
    delta,
    diffLines,
    contentHash,
  };
}

// Helper: Python-like SequenceMatcher
class SequenceMatcher {
  constructor(private isjunk: ((x: string) => boolean) | null, 
              private a: string[], 
              private b: string[]) {}

  ratio(): number {
    const matches = this.getMatchingBlocks()
      .reduce((sum, block) => sum + block[2], 0);
    return 2.0 * matches / (this.a.length + this.b.length);
  }

  getOpcodes(): Array<[string, number, number, number, number]> {
    // Simplified; use 'diff-match-patch' npm library for production
    const result: Array<[string, number, number, number, number]> = [];
    // ... implementation ...
    return result;
  }

  getMatchingBlocks(): Array<[number, number, number]> {
    // ... implementation ...
    return [];
  }
}
```

**Changes:**

* Accept `threshold` parameter (default 0.01 = 1% change)
* Return `{ changed, delta, diffLines, contentHash }`
* Use line-based diffing (not whole-page, which is O(n²))
* Return `contentHash` for deduplication

**Library:** Use `npm install diff-match-patch` for production-grade diffing.

---

### 2.4 Snapshots Storage: Write to DB (not FS)

**FILE:** `backend/routes/monitors.ts` → modify check endpoint

**CURRENT:**

```typescript
export async function manualCheck(req: Request, res: Response) {
  const { monitorId } = req.params;
  const monitor = await db.query('SELECT * FROM monitors WHERE id = ?', [monitorId]);

  const html = await scrapeUrl(monitor.url);
  const diff = diffContent(monitor.baseline, html);

  // Save to filesystem
  const diffFile = `./data/${monitorId}/${Date.now()}.json`;
  fs.writeFileSync(diffFile, JSON.stringify({ html, diff }, null, 2));

  res.json({ diff, file: diffFile });
}
```

**UPGRADE:**

```typescript
export async function manualCheck(req: Request, res: Response) {
  const { monitorId } = req.params;
  const userId = req.user.id;

  const monitor = await db.query(
    'SELECT * FROM monitors WHERE id = ? AND user_id = ?',
    [monitorId, userId]
  );

  // Step 1: Fetch
  const { html, detectedTier } = await scrapeUrl(monitor.url, monitor.fetcher_tier);

  // Step 2: Extract (if Phase 2: CSS selector)
  let content = html;
  if (monitor.css_selector) {
    const $ = cheerio.load(html);
    const elem = $(monitor.css_selector).html();
    if (!elem) throw new Error('CSS selector not found');
    content = elem;
  }

  // Step 3: Sanitize (if Phase 2: exclusion rules)
  if (monitor.exclusion_rules?.length) {
    for (const rule of monitor.exclusion_rules) {
      if (rule.type === 'regex') {
        content = content.replace(new RegExp(rule.pattern, 'g'), '');
      }
    }
  }

  // Step 4: Diff
  const baseline = monitor.baseline_snapshot_id 
    ? (await db.query('SELECT content FROM snapshots WHERE id = ?', [monitor.baseline_snapshot_id]))[0]?.content
    : '';
  
  const { changed, delta, diffLines, contentHash } = diffContent(
    baseline,
    content,
    monitor.change_threshold
  );

  // Check for duplicate
  const existingSnapshot = await db.query(
    'SELECT id FROM snapshots WHERE monitor_id = ? AND content_hash = ?',
    [monitorId, contentHash]
  );
  if (existingSnapshot.length > 0) {
    return res.json({ changed: false, message: 'No new changes (duplicate hash)' });
  }

  // Step 5: Persist to DB
  const diffHtml = renderDiffHtml(diffLines);
  const snapshot = await db.query(
    `INSERT INTO snapshots (monitor_id, content, content_hash, diff_html, detected_at)
     VALUES (?, ?, ?, ?, NOW())
     RETURNING id`,
    [monitorId, content, contentHash, diffHtml]
  );

  // Update monitor
  await db.query(
    'UPDATE monitors SET last_checked_at = NOW(), fetcher_tier = ? WHERE id = ?',
    [detectedTier, monitorId]
  );

  // Step 6: Alert
  if (changed) {
    await db.query(
      'INSERT INTO alerts (monitor_id, snapshot_id, status) VALUES (?, ?, ?)',
      [monitorId, snapshot[0].id, 'queued']
    );
    // BullMQ will pick it up
  }

  // Step 7: Quota
  const month = new Date().toISOString().split('-').slice(0, 2).join('-') + '-01';
  await db.query(
    `INSERT INTO quota_usage (user_id, month, checks_used) 
     VALUES (?, ?, 1)
     ON CONFLICT(user_id, month) DO UPDATE SET checks_used = checks_used + 1`,
    [userId, month]
  );

  res.json({ 
    changed, 
    delta, 
    snapshotId: snapshot[0].id,
    tier: detectedTier 
  });
}
```

**Changes:**

* Fetch returns `{ html, detectedTier }` and updates `monitors.fetcher_tier`
* Content stored directly in `snapshots.content` (not file path)
* Add content deduplication by hash
* Quota atomically incremented

---

### 2.5 Worker: Add Element Fingerprinting

**FILE:** `backend/worker.ts` (scrape queue)

**CURRENT:**

```typescript
scrapeQueue.process(async (job) => {
  const monitor = await db.query('SELECT * FROM monitors WHERE id = ?', [job.data.monitorId]);
  const html = await scrapeUrl(monitor.url);
  const diff = diffContent(monitor.baseline, html);
  if (diff.hasChanges) {
    await alertQueue.add({ monitorId: monitor.id, diff });
  }
});
```

**UPGRADE:**

```typescript
scrapeQueue.process(async (job) => {
  const { monitorId } = job.data;
  const monitor = await db.query('SELECT * FROM monitors WHERE id = ?', [monitorId]);

  try {
    // Fetch (with tier detection)
    const { html, detectedTier } = await scrapeUrl(monitor.url, monitor.fetcher_tier);

    // Extract with adaptive fingerprinting
    let content = html;
    if (monitor.css_selector) {
      const $ = cheerio.load(html);
      let elem = $(monitor.css_selector);

      // Adaptive: if selector fails, try to relocate based on stored fingerprint
      if (elem.length === 0 && monitor.element_fingerprint) {
        elem = relocateElement($, monitor.element_fingerprint);
        if (elem.length === 0) {
          throw new Error('Element not found and could not be relocated');
        }
      }

      // Store updated fingerprint for next run
      const newFingerprint = extractFingerprint(elem);
      await db.query(
        'UPDATE monitors SET element_fingerprint = ? WHERE id = ?',
        [JSON.stringify(newFingerprint), monitorId]
      );

      content = elem.html() || '';
    }

    // Sanitize
    if (monitor.exclusion_rules?.length) {
      for (const rule of monitor.exclusion_rules) {
        if (rule.type === 'regex') {
          content = content.replace(new RegExp(rule.pattern, 'g'), '');
        }
      }
    }

    // Diff
    const baseline = monitor.baseline_snapshot_id
      ? (await db.query('SELECT content FROM snapshots WHERE id = ?', [monitor.baseline_snapshot_id]))[0]?.content
      : '';

    const { changed, delta, diffLines, contentHash } = diffContent(
      baseline,
      content,
      monitor.change_threshold
    );

    // Check for duplicate
    const existing = await db.query(
      'SELECT id FROM snapshots WHERE monitor_id = ? AND content_hash = ?',
      [monitorId, contentHash]
    );

    if (existing.length > 0) {
      await db.query('UPDATE monitors SET last_checked_at = NOW() WHERE id = ?', [monitorId]);
      return { skipped: true, reason: 'duplicate' };
    }

    // Persist
    const diffHtml = renderDiffHtml(diffLines);
    const snapshot = await db.query(
      `INSERT INTO snapshots (monitor_id, content, content_hash, diff_html, detected_at)
       VALUES (?, ?, ?, ?, NOW())
       RETURNING id`,
      [monitorId, content, contentHash, diffHtml]
    );

    // Update monitor
    await db.query(
      'UPDATE monitors SET last_checked_at = NOW(), last_changed_at = NOW(), fetcher_tier = ? WHERE id = ?',
      [detectedTier, monitorId]
    );

    // Alert
    if (changed) {
      await alertQueue.add({
        monitorId,
        snapshotId: snapshot[0].id,
        userId: monitor.user_id,
      });
    }

    // Quota
    const month = new Date().toISOString().split('-').slice(0, 2).join('-') + '-01';
    await db.query(
      `INSERT INTO quota_usage (user_id, month, checks_used) VALUES (?, ?, 1)
       ON CONFLICT(user_id, month) DO UPDATE SET checks_used = checks_used + 1`,
      [monitor.user_id, month]
    );

    return { changed, delta, detectedTier };
  } catch (error) {
    // Escalate on error
    if (monitor.fetcher_tier < 3) {
      await scrapeQueue.add(
        { monitorId, tier: monitor.fetcher_tier + 1 },
        { priority: 10 }  // Escalated jobs get priority
      );
      return { escalated: true, nextTier: monitor.fetcher_tier + 1 };
    }
    throw error;
  }
});

// Helper: extract element fingerprint for adaptive selection
function extractFingerprint(elem: Cheerio): object {
  return {
    tag: elem.prop('tagName'),
    classes: elem.attr('class')?.split(' ') || [],
    id: elem.attr('id'),
    textPreview: elem.text().substring(0, 50),
    position: {
      parent: elem.parent().prop('tagName'),
      siblings: elem.siblings().length,
    },
  };
}

// Helper: relocate element based on fingerprint (simplified)
function relocateElement($: CheerioAPI, fingerprint: object): Cheerio {
  // Try by ID first
  if (fingerprint.id) {
    const byId = $(`#${fingerprint.id}`);
    if (byId.length > 0) return byId;
  }

  // Try by class
  if (fingerprint.classes?.length > 0) {
    const byClass = $(`.${fingerprint.classes.join('.')}`);
    if (byClass.length > 0) return byClass;
  }

  // Try by tag + text preview
  const matching = $(fingerprint.tag).filter((i, elem) => {
    return $(elem).text().includes(fingerprint.textPreview);
  });
  return matching.length > 0 ? matching.eq(0) : $();
}
```

**Changes:**

* Adaptive element selection with fingerprinting
* Store/restore fingerprint to `monitors.element_fingerprint`
* Auto-escalate to next tier on error
* Atomic quota increment

---

### 2.6 Alert Queue: Use Stored Diff HTML

**FILE:** `backend/alert.ts` (existing, modify)

**CURRENT:**

```typescript
export async function renderDiffEmail(diff: DiffResult) {
  // Generate HTML from diff object
}
```

**NEW:**

```typescript
export async function sendDiffAlert(job: Job) {
  const { monitorId, snapshotId, userId } = job.data;

  const snapshot = await db.query(
    'SELECT * FROM snapshots WHERE id = ?',
    [snapshotId]
  );

  const monitor = await db.query(
    'SELECT * FROM monitors WHERE id = ?',
    [monitorId]
  );

  const user = await supabase.auth.admin.getUserById(userId);

  const html = renderAlertEmail({
    url: monitor.url,
    label: monitor.label,
    detectedAt: snapshot.detected_at,
    diffHtml: snapshot.diff_html,  // Use pre-rendered diff
  });

  await resend.emails.send({
    from: 'alerts@sonardiff.com',
    to: user.email,
    subject: `[SonarDiff] Change detected — ${monitor.label}`,
    html,
  });

  await db.query(
    'UPDATE alerts SET sent_at = NOW(), status = ? WHERE id = ?',
    ['sent', snapshotId]
  );
}

function renderAlertEmail(data: any) {
  return `
    <html>
      <body>
        <h2>Change detected on ${data.label}</h2>
        <p><strong>URL:</strong> <a href="${data.url}">${data.url}</a></p>
        <p><strong>Time:</strong> ${data.detectedAt}</p>
      
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
          ${data.diffHtml}
        </div>
      
        <p><a href="https://app.sonardiff.com/monitors/${data.monitorId}/diffs">View full diff</a></p>
      </body>
    </html>
  `;
}
```

**Changes:**

* Use `snapshots.diff_html` (pre-rendered) instead of computing in alert worker
* Fix Resend `from` address to verified domain

---

## Part 3: Frontend Changes (Minimal)

### 3.1 Auth Provider Switch

**FILE:** `frontend/app/layout.tsx`

```typescript
// BEFORE
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}

// AFTER
import { createClient } from '@supabase/ssr';

export default function RootLayout({ children }) {
  const supabase = createClient();
  
  return (
    <SupabaseProvider supabase={supabase}>
      {children}
    </SupabaseProvider>
  );
}
```

**Action:** Swap NextAuth for Supabase Auth provider.

### 3.2 Monitor Form: Add Threshold Slider

**FILE:** `frontend/app/(dashboard)/monitors/new/page.tsx`

```typescript
// ADD this field to the form
<div>
  <label>Change Sensitivity</label>
  <input 
    type="range" 
    min="0.01" 
    max="0.5" 
    step="0.01"
    value={formData.changeThreshold}
    onChange={(e) => setFormData({...formData, changeThreshold: parseFloat(e.target.value)})}
  />
  <p>Alert when > {(formData.changeThreshold * 100).toFixed(1)}% changes</p>
</div>
```

### 3.3 Monitor Detail: Show Detected Tier

**FILE:** `frontend/app/(dashboard)/monitors/[id]/page.tsx`

```typescript
// ADD to monitor detail page
<div>
  <h3>Fetcher Tier</h3>
  <p>{monitor.fetcher_tier ? ['HTTP (Tier 1)', 'Headless (Tier 2)', 'Stealth (Tier 3)'][monitor.fetcher_tier - 1] : 'Auto-detecting...'}</p>
</div>
```

---

## Part 4: Deployment & Infrastructure

### 4.1 Environment Variables (add to .env)

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_ANON_KEY=xxx

# Resend
RESEND_API_KEY=xxx

# Redis (keep for BullMQ)
REDIS_URL=redis://...

# Node
NODE_ENV=production
PORT=3000
```

### 4.2 Docker (Single Container)

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build Next.js
RUN npm run build:frontend

# Expose
EXPOSE 3000

# Run both Express API and BullMQ worker in single container
CMD ["node", "backend/index.js"]
```

The `backend/index.js` starts both:

1. Express server on `:3000`
2. BullMQ workers (as separate processes in the same container)

### 4.3 Monthly Quota Reset (Cron)

```typescript
// backend/cron.ts
import cron from 'node-cron';
import { db } from './db';

// Every 1st of month at 00:00 UTC
cron.schedule('0 0 1 * *', async () => {
  console.log('Resetting monthly quotas...');
  
  // Create new row for this month for all users
  const month = new Date().toISOString().split('-').slice(0, 2).join('-') + '-01';
  const users = await db.query('SELECT DISTINCT user_id FROM monitors');
  
  for (const user of users) {
    await db.query(
      `INSERT INTO quota_usage (user_id, month, checks_used) VALUES (?, ?, 0)
       ON CONFLICT DO NOTHING`,
      [user.user_id, month]
    );
  }
});
```

---

## Part 5: Implementation Checklist

### Phase 0: Setup (Day 1)

* [ ] Migrate to Supabase Auth (users re-login with magic link)
* [ ] Create DB migration script
* [ ] Update `.env` with Supabase credentials
* [ ] Update Resend sender address (requires domain verification)

### Phase 1: Core Upgrades (Days 2-5)

* [ ] Add Tier 1 HTTP detection to `scraper.ts`
* [ ] Update `diff.ts` with threshold + difflib-style logic
* [ ] Add `threshold` and `fetcher_tier` columns
* [ ] Migrate snapshots storage: FS → DB
* [ ] Update alert worker to use `snapshots.diff_html`

### Phase 2: Adaptive Elements (Days 6-8)

* [ ] Add `element_fingerprint` column
* [ ] Implement `extractFingerprint` and `relocateElement`
* [ ] Update worker to store/restore fingerprint
* [ ] Test CSS selector adaptation on site redesign

### Phase 3: Frontend (Days 9-10)

* [ ] Swap auth provider to Supabase
* [ ] Add threshold slider to monitor form
* [ ] Show detected tier on monitor detail
* [ ] Test full auth flow (signup → create monitor → check → alert)

### Phase 4: Polish (Days 11-12)

* [ ] Setup monthly cron reset
* [ ] Add quota dashboard widget
* [ ] Fix any edge cases
* [ ] Deploy to Vercel + Railway

---

## Success Criteria

| Criterion                     | How to Verify                                                         |
| ----------------------------- | --------------------------------------------------------------------- |
| Tier 1 used for 60%+ monitors | `SELECT fetcher_tier, COUNT(*) FROM monitors GROUP BY fetcher_tier` |
| Alerts respect threshold      | Send a monitor with 0.5 threshold, trigger small change — no alert   |
| Adaptive selectors work       | Change a website's CSS, monitor still finds element                   |
| Quota accurate                | Manual check → quota_usage increments by 1                           |
| Auth works                    | Login with Supabase magic link, create monitor                        |

---

## Rollback Plan

If something breaks:

1. **Auth regression:** Keep old auth.ts as backup; redirect login to old system temporarily
2. **DB corruption:** Snapshots migration is non-destructive (old `diffs` table still exists during cutover)
3. **Worker errors:** BullMQ retry logic — jobs auto-retry 3× on failure before DLQ

---

## Notes for Implementation

1. **Run DB migration in transaction:** `BEGIN; ... COMMIT;` — if one step fails, the whole cutover rolls back.
2. **Test tier escalation:** Mock Tier 1 failures in dev, ensure Tier 2 is called.
3. **Load test:** Tier 1 HTTP should be 50× faster than Tier 2 headless; benchmark before/after.
4. **User communication:** When rolling out threshold UI, default to 0.01 (previous behavior was ~0.1); mention in changelog.
