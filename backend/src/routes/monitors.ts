import { Router, type Request, type Response } from 'express';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { monitors, diffs, snapshots, users, monitorGroups } from '../db/schema.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { scrapeQueue, discoveryQueue } from '../worker/jobs.js';

const router: ReturnType<typeof Router> = Router();

router.use(requireAuth);

/**
 * Calculate the estimated monthly checks for a given interval.
 */
function calculateMonthlyChecks(intervalMinutes: number): number {
  const minutesInMonth = 30 * 24 * 60; // 43,200
  return Math.floor(minutesInMonth / intervalMinutes);
}

// --- GET /api/monitors ---
router.get('/', async (req: Request, res: Response) => {
  try {
    const userMonitors = await db
      .select()
      .from(monitors)
      .where(eq(monitors.userId, req.user!.id))
      .orderBy(desc(monitors.createdAt));

    res.json({ monitors: userMonitors });
  } catch (err) {
    logger.error({ err }, 'Error fetching monitors');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- POST /api/monitors ---
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, url, checkIntervalMinutes, cssSelector, exclusionRules, threshold } = req.body;
    const user = req.user!;

    if (!name || !url || !checkIntervalMinutes) {
      res.status(400).json({ error: 'Name, URL, and interval are required' });
      return;
    }

    // Validate interval based on plan
    const planConfig = config.plans[user.plan];
    if (checkIntervalMinutes < planConfig.checkIntervalMinutes) {
      res.status(403).json({ 
        error: `Your plan requires a minimum check interval of ${planConfig.checkIntervalMinutes} minutes` 
      });
      return;
    }

    // Phase 2 check for Pro features
    if ((cssSelector || (exclusionRules && exclusionRules.length > 0)) && user.plan === 'free') {
      res.status(403).json({ error: 'Element targeting and exclusion rules require the Pro plan' });
      return;
    }

    // Quota calculator logic for active monitors
    const activeMonitors = await db
      .select({ checkIntervalMinutes: monitors.checkIntervalMinutes })
      .from(monitors)
      .where(
        and(
          eq(monitors.userId, user.id),
          eq(monitors.isActive, true)
        )
      );

    if (activeMonitors.length >= planConfig.maxMonitors) {
      res.status(403).json({ error: `You have reached the maximum of ${planConfig.maxMonitors} monitors for your plan` });
      return;
    }

    let projectedMonthlyChecks = calculateMonthlyChecks(checkIntervalMinutes);
    for (const m of activeMonitors) {
      projectedMonthlyChecks += calculateMonthlyChecks(m.checkIntervalMinutes);
    }

    if (projectedMonthlyChecks > user.planLimit) {
      res.status(403).json({ 
        error: `This configuration would exceed your monthly limit of ${user.planLimit} checks. You are projected to use ${projectedMonthlyChecks}.` 
      });
      return;
    }

    if (threshold !== undefined) {
      const t = Number(threshold);
      if (isNaN(t) || t <= 0 || t > 1) {
        res.status(400).json({ error: 'threshold must be a number between 0.01 and 1' });
        return;
      }
    }

    // Create monitor
    const [monitor] = await db
      .insert(monitors)
      .values({
        userId: user.id,
        name: name.trim(),
        url: url.trim(),
        checkIntervalMinutes,
        cssSelector: cssSelector || null,
        exclusionRules: exclusionRules || [],
        threshold: threshold !== undefined ? Number(threshold) : 0.01,
        nextCheckAt: new Date(), // Enqueue immediately
      })
      .returning();

    logger.info({ monitorId: monitor.id, userId: user.id }, 'Monitor created');
    res.status(201).json({ monitor });
  } catch (err) {
    logger.error({ err }, 'Error creating monitor');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GET /api/monitors/:id ---
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [monitor] = await db
      .select()
      .from(monitors)
      .where(
        and(
          eq(monitors.id, req.params.id as string),
          eq(monitors.userId, req.user!.id)
        )
      )
      .limit(1);

    if (!monitor) {
      res.status(404).json({ error: 'Monitor not found' });
      return;
    }

    res.json({ monitor });
  } catch (err) {
    logger.error({ err }, 'Error fetching monitor');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- PATCH /api/monitors/:id ---
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, url, checkIntervalMinutes, isActive, cssSelector, exclusionRules, threshold } = req.body;
    const user = req.user!;

    // Validate ownership
    const [existing] = await db
      .select()
      .from(monitors)
      .where(
        and(
          eq(monitors.id, req.params.id as string),
          eq(monitors.userId, user.id)
        )
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Monitor not found' });
      return;
    }

    const updates: Partial<typeof monitors.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (url !== undefined) updates.url = url.trim();
    if (isActive !== undefined) updates.isActive = isActive;
    
    if (checkIntervalMinutes !== undefined) {
      const planConfig = config.plans[user.plan];
      if (checkIntervalMinutes < planConfig.checkIntervalMinutes) {
        res.status(403).json({ 
          error: `Your plan requires a minimum check interval of ${planConfig.checkIntervalMinutes} minutes` 
        });
        return;
      }
      updates.checkIntervalMinutes = checkIntervalMinutes;
    }

    if (cssSelector !== undefined || (exclusionRules !== undefined && exclusionRules.length > 0)) {
      if (user.plan === 'free') {
        res.status(403).json({ error: 'Element targeting and exclusion rules require the Pro plan' });
        return;
      }
      if (cssSelector !== undefined) updates.cssSelector = cssSelector;
      if (exclusionRules !== undefined) updates.exclusionRules = exclusionRules;
    }

    if (threshold !== undefined) {
      const t = Number(threshold);
      if (isNaN(t) || t <= 0 || t > 1) {
        res.status(400).json({ error: 'threshold must be a number between 0.01 and 1' });
        return;
      }
      updates.threshold = t;
    }

    // Recalculate quota if interval or active status changed
    if (updates.checkIntervalMinutes !== undefined || updates.isActive !== undefined) {
      const activeMonitors = await db
        .select({ id: monitors.id, checkIntervalMinutes: monitors.checkIntervalMinutes })
        .from(monitors)
        .where(
          and(
            eq(monitors.userId, user.id),
            eq(monitors.isActive, true)
          )
        );

      let projectedMonthlyChecks = 0;
      const targetActive = updates.isActive !== undefined ? updates.isActive : existing.isActive;
      const targetInterval = updates.checkIntervalMinutes ?? existing.checkIntervalMinutes;

      if (targetActive) {
        projectedMonthlyChecks += calculateMonthlyChecks(targetInterval);
      }

      for (const m of activeMonitors) {
        if (m.id !== existing.id) {
          projectedMonthlyChecks += calculateMonthlyChecks(m.checkIntervalMinutes);
        }
      }

      if (projectedMonthlyChecks > user.planLimit) {
        res.status(403).json({ 
          error: `This change would exceed your monthly limit of ${user.planLimit} checks. You are projected to use ${projectedMonthlyChecks}.` 
        });
        return;
      }
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(monitors)
      .set(updates)
      .where(eq(monitors.id, existing.id))
      .returning();

    res.json({ monitor: updated });
  } catch (err) {
    logger.error({ err }, 'Error updating monitor');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- DELETE /api/monitors/:id ---
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db
      .delete(monitors)
      .where(
        and(
          eq(monitors.id, req.params.id as string),
          eq(monitors.userId, req.user!.id)
        )
      )
      .returning({ id: monitors.id });

    if (result.length === 0) {
      res.status(404).json({ error: 'Monitor not found' });
      return;
    }

    // Note: Deleting the monitor cascades to diffs and snapshots in the DB,
    // but a cleanup worker will be needed to delete orphaned files from disk.
    logger.info({ monitorId: req.params.id }, 'Monitor deleted');
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Error deleting monitor');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Discovery ──────────────────────────────────────────────────────────────

// --- POST /api/monitors/discover ---
// Enqueue a site-discovery crawl. Returns immediately with a jobId; client polls
// GET /discover/:jobId until status is 'done' or 'failed'.
router.post('/discover', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'URL is required' });
      return;
    }
    // Light validation — let crawl.normalizeBase do the heavy lifting
    let validated: string;
    try {
      const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
      validated = u.toString();
    } catch {
      res.status(400).json({ error: 'Invalid URL' });
      return;
    }

    const job = await discoveryQueue.add(
      'discover',
      { url: validated, userId: req.user!.id },
      {
        // Keep result reachable for ~1h so the polling client can fetch it
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 3600, count: 100 },
      }
    );
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    logger.error({ err }, 'Error enqueuing discovery');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GET /api/monitors/discover/:jobId ---
router.get('/discover/:jobId', async (req: Request, res: Response) => {
  try {
    const job = await discoveryQueue.getJob(req.params.jobId as string);
    if (!job) {
      res.status(404).json({ error: 'Discovery job not found (expired?)' });
      return;
    }
    // Ownership check — refuse to leak someone else's discovery results
    if ((job.data as any)?.userId !== req.user!.id) {
      res.status(404).json({ error: 'Discovery job not found' });
      return;
    }
    const state = await job.getState();
    const progress = job.progress as { message?: string } | null;

    if (state === 'completed') {
      res.json({ status: 'done', result: job.returnvalue, progress });
      return;
    }
    if (state === 'failed') {
      res.json({ status: 'failed', error: job.failedReason || 'Unknown error', progress });
      return;
    }
    res.json({ status: 'pending', state, progress });
  } catch (err) {
    logger.error({ err }, 'Error polling discovery job');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Bulk create ────────────────────────────────────────────────────────────

const MAX_BULK_URLS = 100;

// --- POST /api/monitors/bulk ---
// Creates many monitors in one transaction. Validates the entire batch against
// plan max-monitors and projected monthly-checks BEFORE inserting anything.
// If groupName is provided, the created monitors are linked to a new monitor_group.
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { urls, shared, groupName, baseUrl } = req.body;
    const user = req.user!;

    if (!Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({ error: 'urls must be a non-empty array' });
      return;
    }
    if (urls.length > MAX_BULK_URLS) {
      res.status(400).json({ error: `Cannot create more than ${MAX_BULK_URLS} monitors at once` });
      return;
    }
    if (!shared || typeof shared !== 'object') {
      res.status(400).json({ error: 'shared settings object is required' });
      return;
    }

    const interval = Number(shared.checkIntervalMinutes);
    if (!interval || isNaN(interval)) {
      res.status(400).json({ error: 'shared.checkIntervalMinutes is required' });
      return;
    }

    const planConfig = config.plans[user.plan];

    if (interval < planConfig.checkIntervalMinutes) {
      res.status(403).json({
        error: `Your plan requires a minimum check interval of ${planConfig.checkIntervalMinutes} minutes`,
      });
      return;
    }

    const cssSelector = shared.cssSelector || null;
    const exclusionRules = Array.isArray(shared.exclusionRules) ? shared.exclusionRules : [];
    if ((cssSelector || exclusionRules.length > 0) && user.plan === 'free') {
      res.status(403).json({ error: 'Element targeting and exclusion rules require the Pro plan' });
      return;
    }

    let threshold = 0.01;
    if (shared.threshold !== undefined) {
      const t = Number(shared.threshold);
      if (isNaN(t) || t <= 0 || t > 1) {
        res.status(400).json({ error: 'threshold must be a number between 0.01 and 1' });
        return;
      }
      threshold = t;
    }

    // Normalize + validate each URL up-front so we fail fast
    const normalized: Array<{ url: string; name: string }> = [];
    for (const item of urls) {
      const raw = typeof item === 'string' ? item : (item?.url ?? '');
      const customName = typeof item === 'string' ? null : (item?.name ?? null);
      let parsed: URL;
      try { parsed = new URL(raw); } catch {
        res.status(400).json({ error: `Invalid URL: ${raw}` });
        return;
      }
      const fallbackName = customName || `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
      normalized.push({ url: parsed.toString(), name: fallbackName.slice(0, 255) });
    }

    // Quota: max-monitors
    const activeMonitors = await db
      .select({ checkIntervalMinutes: monitors.checkIntervalMinutes })
      .from(monitors)
      .where(and(eq(monitors.userId, user.id), eq(monitors.isActive, true)));

    if (activeMonitors.length + normalized.length > planConfig.maxMonitors) {
      res.status(403).json({
        error: `This batch would push you to ${activeMonitors.length + normalized.length} active monitors, exceeding your plan limit of ${planConfig.maxMonitors}.`,
      });
      return;
    }

    // Quota: projected monthly checks
    const minutesInMonth = 30 * 24 * 60;
    let projected = activeMonitors.reduce(
      (sum, m) => sum + Math.floor(minutesInMonth / m.checkIntervalMinutes), 0
    );
    projected += Math.floor(minutesInMonth / interval) * normalized.length;
    if (projected > user.planLimit) {
      res.status(403).json({
        error: `This batch would project ${projected} checks/month, exceeding your plan limit of ${user.planLimit}.`,
      });
      return;
    }

    // All-or-nothing: create the group + all monitors in a transaction
    const result = await db.transaction(async (tx) => {
      let groupId: string | null = null;
      let groupName_: string | null = null;
      if (groupName && typeof groupName === 'string' && groupName.trim()) {
        const [g] = await tx.insert(monitorGroups).values({
          userId: user.id,
          name: groupName.trim().slice(0, 255),
          baseUrl: (baseUrl || normalized[0].url).slice(0, 2000),
        }).returning();
        groupId = g.id;
        groupName_ = g.name;
      }

      const inserted = await tx.insert(monitors).values(
        normalized.map(({ url, name }) => ({
          userId: user.id,
          groupId,
          name,
          url,
          checkIntervalMinutes: interval,
          cssSelector,
          exclusionRules,
          threshold,
          nextCheckAt: new Date(),
        }))
      ).returning();

      return { groupId, groupName: groupName_, monitors: inserted };
    });

    logger.info({ userId: user.id, count: result.monitors.length, groupId: result.groupId }, 'Bulk monitors created');
    res.status(201).json({
      created: result.monitors.length,
      groupId: result.groupId,
      groupName: result.groupName,
      monitors: result.monitors,
    });
  } catch (err) {
    logger.error({ err }, 'Error creating bulk monitors');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GET /api/monitors/snapshots ---
// Cross-monitor list of every snapshot the worker has captured for this user.
// Joins snapshots → monitors so the UI gets monitorName without N+1 calls.
router.get('/snapshots/all', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const rows = await db
      .select({
        id: snapshots.id,
        monitorId: snapshots.monitorId,
        monitorName: monitors.name,
        monitorUrl: monitors.url,
        httpStatus: snapshots.httpStatus,
        error: snapshots.error,
        contentHash: snapshots.contentHash,
        capturedAt: snapshots.capturedAt,
      })
      .from(snapshots)
      .innerJoin(monitors, eq(snapshots.monitorId, monitors.id))
      .where(eq(monitors.userId, req.user!.id))
      .orderBy(desc(snapshots.capturedAt))
      .limit(limit);
    res.json({ snapshots: rows });
  } catch (err) {
    logger.error({ err }, 'Error fetching all snapshots');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GET /api/monitors/:id/snapshots ---
router.get('/:id/snapshots', async (req: Request, res: Response) => {
  try {
    const [monitor] = await db
      .select({ id: monitors.id })
      .from(monitors)
      .where(and(eq(monitors.id, req.params.id as string), eq(monitors.userId, req.user!.id)))
      .limit(1);
    if (!monitor) {
      res.status(404).json({ error: 'Monitor not found' });
      return;
    }
    const rows = await db
      .select({
        id: snapshots.id,
        httpStatus: snapshots.httpStatus,
        error: snapshots.error,
        contentHash: snapshots.contentHash,
        capturedAt: snapshots.capturedAt,
      })
      .from(snapshots)
      .where(eq(snapshots.monitorId, monitor.id))
      .orderBy(desc(snapshots.capturedAt));
    res.json({ snapshots: rows });
  } catch (err) {
    logger.error({ err }, 'Error fetching monitor snapshots');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GET /api/monitors/:id/diffs ---
router.get('/:id/diffs', async (req: Request, res: Response) => {
  try {
    // Validate ownership
    const [monitor] = await db
      .select({ id: monitors.id })
      .from(monitors)
      .where(
        and(
          eq(monitors.id, req.params.id as string),
          eq(monitors.userId, req.user!.id)
        )
      )
      .limit(1);

    if (!monitor) {
      res.status(404).json({ error: 'Monitor not found' });
      return;
    }

    const monitorDiffs = await db
      .select()
      .from(diffs)
      .where(eq(diffs.monitorId, monitor.id))
      .orderBy(desc(diffs.detectedAt));

    res.json({ diffs: monitorDiffs });
  } catch (err) {
    logger.error({ err }, 'Error fetching diffs');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GET /api/monitors/:id/diffs/:diffId ---
import fs from 'node:fs/promises';
import path from 'node:path';

router.get('/:id/diffs/:diffId', async (req: Request, res: Response) => {
  try {
    const [result] = await db
      .select({
        diff: diffs,
        monitor: monitors,
      })
      .from(diffs)
      .innerJoin(monitors, eq(diffs.monitorId, monitors.id))
      .where(
        and(
          eq(diffs.id, req.params.diffId as string),
          eq(monitors.id, req.params.id as string),
          eq(monitors.userId, req.user!.id)
        )
      )
      .limit(1);

    if (!result) {
      res.status(404).json({ error: 'Diff not found' });
      return;
    }

    const { diff, monitor } = result;

    // Fetch snapshots
    const [snapshotOld] = await db.select().from(snapshots).where(eq(snapshots.id, diff.snapshotOldId!)).limit(1);
    const [snapshotNew] = await db.select().from(snapshots).where(eq(snapshots.id, diff.snapshotNewId!)).limit(1);

    // Read diff data from file
    let diffData = null;
    try {
      const data = await fs.readFile(diff.diffPath, 'utf-8');
      diffData = JSON.parse(data);
    } catch (e) {
      logger.error({ err: e, diffId: diff.id }, 'Failed to read diff file');
    }

    // Map file paths to API URLs for screenshots
    const mapScreenshot = (p: string | null) => {
      if (!p) return null;
      return `/api/snapshots/${path.basename(p)}`;
    };

    res.json({ 
      diff: {
        ...diff,
        diffData,
        snapshotOld: snapshotOld ? { ...snapshotOld, screenshotUrl: mapScreenshot(snapshotOld.screenshotPath) } : null,
        snapshotNew: snapshotNew ? { ...snapshotNew, screenshotUrl: mapScreenshot(snapshotNew.screenshotPath) } : null,
      },
      monitor
    });
  } catch (err) {
    logger.error({ err }, 'Error fetching diff details');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- POST /api/monitors/:id/check ---
router.post('/:id/check', async (req: Request, res: Response) => {
  try {
    // Feature flag: manual_check_enabled
    const { getConfigFlag } = await import('./admin/config.js');
    const manualEnabled = await getConfigFlag('manual_check_enabled');
    if (manualEnabled === 'false') {
      res.status(503).json({ error: 'Manual checks are temporarily disabled.', maintenance: true });
      return;
    }

    const user = req.user!;
    const [monitor] = await db
      .select()
      .from(monitors)
      .where(
        and(
          eq(monitors.id, req.params.id as string),
          eq(monitors.userId, user.id)
        )
      )
      .limit(1);

    if (!monitor) {
      res.status(404).json({ error: 'Monitor not found' });
      return;
    }

    // Pro only feature check
    if (user.plan !== 'pro') {
      res.status(403).json({ error: 'Manual checks are a Pro feature' });
      return;
    }

    // 50 per month limit check
    if (user.manualChecksUsedThisPeriod >= 50) {
      res.status(403).json({ error: 'Monthly manual check limit of 50 reached' });
      return;
    }

    // Increment manual checks count
    await db
      .update(users)
      .set({ 
        manualChecksUsedThisPeriod: user.manualChecksUsedThisPeriod + 1,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    // Add to scrape queue immediately
    await scrapeQueue.add('check-monitor', monitor, {
      jobId: `manual_scrape_${monitor.id}_${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 1000,
    });

    logger.info({ monitorId: monitor.id, userId: user.id }, 'Manual check enqueued');
    res.json({ 
      success: true, 
      message: 'Check enqueued',
      manualChecksUsedThisPeriod: user.manualChecksUsedThisPeriod + 1
    });
  } catch (err) {
    logger.error({ err }, 'Error enqueuing manual check');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as monitorsRouter };
