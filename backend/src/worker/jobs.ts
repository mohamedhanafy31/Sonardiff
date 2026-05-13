import { Queue, Worker, QueueEvents, type Job } from 'bullmq';
import { eq, and, lte, sql } from 'drizzle-orm';
import fs from 'node:fs/promises';
import { db } from '../db/index.js';
import { monitors, snapshots, diffs, users, alerts } from '../db/schema.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { scrapeUrl } from '../engine/scraper.js';
import { compareSnapshots, generateContentHash } from '../engine/diff.js';
import { sendAlertEmail, sendElementMissingAlert } from '../engine/alert.js';
import { discover } from '../lib/crawl.js';

const connection = {
  url: config.redisUrl,
};

// --- Queues ---
export const scrapeQueue = new Queue('scrape-queue', { connection });
export const systemQueue = new Queue('system-queue', { connection });
export const alertQueue = new Queue('alert-queue', { connection });
export const discoveryQueue = new Queue('discovery-queue', { connection });

/**
 * Poller Job: Runs every 60 seconds.
 * Finds all active monitors where nextCheckAt <= NOW() and adds them to scrapeQueue.
 */
export async function pollMonitors() {
  logger.info('Polling for due monitors...');
  const now = new Date();

  try {
    const dueMonitors = await db
      .select({
        id: monitors.id,
        userId: monitors.userId,
        url: monitors.url,
        cssSelector: monitors.cssSelector,
        exclusionRules: monitors.exclusionRules,
        checkIntervalMinutes: monitors.checkIntervalMinutes,
        threshold: monitors.threshold,
        fetcherTier: monitors.fetcherTier,
        elementFingerprint: monitors.elementFingerprint,
        status: monitors.status,
      })
      .from(monitors)
      .where(
        and(
          eq(monitors.isActive, true),
          eq(monitors.status, 'active'),
          lte(monitors.nextCheckAt, now)
        )
      );

    for (const monitor of dueMonitors) {
      await scrapeQueue.add('check-monitor', monitor, {
        jobId: `scrape_${monitor.id}_${now.getTime()}`,
        removeOnComplete: 100,
        removeOnFail: 1000,
      });

      const nextCheck = new Date(now.getTime() + monitor.checkIntervalMinutes * 60000);
      await db
        .update(monitors)
        .set({ nextCheckAt: nextCheck })
        .where(eq(monitors.id, monitor.id));
    }

    logger.info({ count: dueMonitors.length }, 'Enqueued due monitors');
  } catch (err) {
    logger.error({ err }, 'Error polling monitors');
  }
}

/**
 * Worker: Processes 'check-monitor' jobs.
 */
export const scrapeWorker = new Worker('scrape-queue', async (job: Job) => {
  const { id: monitorId, userId, url, cssSelector, exclusionRules, checkIntervalMinutes, threshold, fetcherTier, elementFingerprint } = job.data;

  // 1. Atomic Quota Decrement
  const [userUpdate] = await db.execute(sql`
    UPDATE users
    SET checks_used_this_period = checks_used_this_period + 1
    WHERE id = ${userId}
      AND checks_used_this_period < plan_limit
    RETURNING id
  `);

  if (!userUpdate) {
    logger.warn({ monitorId, userId }, 'Quota exceeded, aborting check');
    return { status: 'skipped', reason: 'quota_exceeded' };
  }

  // 2. Scrape
  logger.info({ monitorId, url, fetcherTier }, 'Starting scrape');
  const scrapeResult = await scrapeUrl(monitorId, url, cssSelector, fetcherTier ?? null, elementFingerprint ?? null);

  // 3. Handle bot-blocked / escalation signal
  if (scrapeResult.error === 'bot_blocked' || (scrapeResult.error && scrapeResult.detectedTier > (fetcherTier ?? 0))) {
    const currentTier = fetcherTier ?? 1;
    if (currentTier < 3) {
      const nextTier = currentTier + 1;
      logger.info({ monitorId, currentTier, nextTier }, 'Escalating to higher tier');
      await db.update(monitors)
        .set({ fetcherTier: nextTier as any })
        .where(eq(monitors.id, monitorId));
      await scrapeQueue.add('check-monitor', { ...job.data, fetcherTier: nextTier }, {
        jobId: `scrape_${monitorId}_tier${nextTier}_${Date.now()}`,
        priority: 10,
        removeOnComplete: 100,
        removeOnFail: 1000,
      });
      return { status: 'escalated', nextTier };
    } else {
      await db.update(monitors)
        .set({ status: 'unreachable' })
        .where(eq(monitors.id, monitorId));
      return { status: 'failed', error: 'unreachable' };
    }
  }

  if (scrapeResult.error) {
    logger.error({ monitorId, error: scrapeResult.error }, 'Scrape failed');
    const snapshotExpiresAt = new Date();
    snapshotExpiresAt.setDate(snapshotExpiresAt.getDate() + 30);
    await db.insert(snapshots).values({
      monitorId,
      htmlPath: scrapeResult.htmlPath,
      textPath: scrapeResult.textPath,
      screenshotPath: scrapeResult.screenshotPath,
      httpStatus: scrapeResult.httpStatus,
      contentHash: null,
      error: scrapeResult.error,
      expiresAt: snapshotExpiresAt,
    });
    return { status: 'failed', error: scrapeResult.error };
  }

  // 4. Save detected tier if changed
  if (scrapeResult.detectedTier !== (fetcherTier ?? null)) {
    await db.update(monitors)
      .set({ fetcherTier: scrapeResult.detectedTier as any })
      .where(
        and(
          eq(monitors.id, monitorId),
          sql`(fetcher_tier IS NULL OR fetcher_tier <> ${scrapeResult.detectedTier})`
        )
      );
  }

  // 4b. Handle element-not-found (CSS selector set but yielded no text and no relocation)
  if (cssSelector && scrapeResult.extractedText === '' && !scrapeResult.selectorRelocated) {
    logger.warn({ monitorId, cssSelector }, 'CSS selector no longer matches any element');
    await db.update(monitors)
      .set({ status: 'unreachable' })
      .where(eq(monitors.id, monitorId));
    // Send one-shot alert
    const [userData] = await db.select({ email: users.email, name: monitors.name, url: monitors.url })
      .from(monitors)
      .innerJoin(users, eq(monitors.userId, users.id))
      .where(eq(monitors.id, monitorId));
    if (userData) {
      await sendElementMissingAlert(userData.email, userData.name, userData.url);
    }
    return { status: 'failed', error: 'element_not_found' };
  }

  // 4c. Persist element fingerprint if available
  if (scrapeResult.elementFingerprint) {
    await db.update(monitors)
      .set({ elementFingerprint: scrapeResult.elementFingerprint as any })
      .where(eq(monitors.id, monitorId));
  }

  if (scrapeResult.selectorRelocated) {
    logger.info({ monitorId, cssSelector }, 'Selector auto-recovered via fingerprint');
  }

  // 5. Hash Content (use in-memory text from scrape, no file read needed)
  const extractedText = scrapeResult.extractedText;
  const contentHash = generateContentHash(extractedText);

  // 6. Find previous successful snapshot
  const [previousSnapshot] = await db
    .select()
    .from(snapshots)
    .where(
      and(
        eq(snapshots.monitorId, monitorId),
        sql`content_hash IS NOT NULL`
      )
    )
    .orderBy(sql`captured_at DESC`)
    .limit(1);

  // 7. Save new snapshot with DB-stored content
  const snapshotExpiresAt = new Date();
  snapshotExpiresAt.setDate(snapshotExpiresAt.getDate() + 30);

  const [newSnapshot] = await db.insert(snapshots).values({
    monitorId,
    content: extractedText,
    htmlPath: scrapeResult.htmlPath,
    textPath: scrapeResult.textPath,
    screenshotPath: scrapeResult.screenshotPath,
    httpStatus: scrapeResult.httpStatus,
    contentHash,
    expiresAt: snapshotExpiresAt,
  }).returning();

  // Update lastCheckedAt
  await db.update(monitors)
    .set({ lastCheckedAt: new Date() })
    .where(eq(monitors.id, monitorId));

  // 8. Diff Engine
  if (previousSnapshot && previousSnapshot.contentHash !== contentHash) {
    logger.info({ monitorId }, 'Content change detected, computing diff');

    try {
      // Read previous text from DB content column (with file fallback for legacy rows)
      let prevText = previousSnapshot.content ?? null;
      if (!prevText && previousSnapshot.textPath) {
        prevText = await fs.readFile(previousSnapshot.textPath, 'utf-8').catch(() => '');
      }
      prevText = prevText ?? '';

      const effectiveThreshold = threshold ?? 0.01;
      const diffResult = await compareSnapshots(
        monitorId,
        prevText,
        extractedText,
        exclusionRules,
        effectiveThreshold
      );

      // Update snapshot with pre-rendered diff HTML
      await db.update(snapshots)
        .set({ diffHtml: diffResult.diffHtml })
        .where(eq(snapshots.id, newSnapshot.id));

      if (diffResult.changed) {
        const [savedDiff] = await db.insert(diffs).values({
          monitorId,
          snapshotOldId: previousSnapshot.id,
          snapshotNewId: newSnapshot.id,
          diffPath: diffResult.diffPath,
          changeSummary: diffResult.changeSummary,
          changePercentage: diffResult.changePercentage,
          expiresAt: snapshotExpiresAt,
        }).returning({ id: diffs.id });

        await alertQueue.add('send-alert', {
          monitorId,
          userId,
          diffId: savedDiff.id,
          snapshotNewId: newSnapshot.id,
          changePercentage: diffResult.changePercentage,
        });
      } else {
        logger.info({ monitorId, delta: diffResult.delta, threshold: effectiveThreshold }, 'Change below threshold, skipping alert');
      }

    } catch (e) {
      logger.error({ err: e, monitorId }, 'Diff computation failed');
    }
  } else {
    logger.info({ monitorId }, 'No change detected');
  }

  return { status: 'success' };
}, { connection, concurrency: 5 });


// --- Setup Repeatable Jobs ---
export async function setupSystemJobs() {
  await systemQueue.add('poll-monitors', {}, {
    repeat: { every: 60000 },
    jobId: 'poll-monitors-repeatable'
  });

  await systemQueue.add('gc-maintenance', {}, {
    repeat: { pattern: '0 3 * * *' },
    jobId: 'gc-maintenance-repeatable'
  });

  await systemQueue.add('reset-quotas', {}, {
    repeat: { pattern: '0 0 1 * *' },
    jobId: 'reset-quotas-repeatable'
  });

  logger.info('Registered repeatable jobs');
}

export const systemWorker = new Worker('system-queue', async (job: Job) => {
  if (job.name === 'poll-monitors') {
    await pollMonitors();
  } else if (job.name === 'gc-maintenance') {
    await runMaintenance();
  } else if (job.name === 'reset-quotas') {
    await resetMonthlyQuotas();
  }
}, { connection });

async function runMaintenance() {
  logger.info('Running system maintenance...');
  const now = new Date();

  const expiredSnapshots = await db
    .select({
      htmlPath: snapshots.htmlPath,
      textPath: snapshots.textPath,
      screenshotPath: snapshots.screenshotPath,
    })
    .from(snapshots)
    .where(lte(snapshots.expiresAt, now));

  const expiredDiffs = await db
    .select({ diffPath: diffs.diffPath })
    .from(diffs)
    .where(lte(diffs.expiresAt, now));

  await db.delete(snapshots).where(lte(snapshots.expiresAt, now));
  await db.delete(diffs).where(lte(diffs.expiresAt, now));

  await db.execute(sql`DELETE FROM sessions WHERE expires_at < NOW()`);

  const filesToDelete: (string | null)[] = [
    ...expiredSnapshots.flatMap(s => [s.htmlPath, s.textPath, s.screenshotPath]),
    ...expiredDiffs.map(d => d.diffPath),
  ];

  let deletedFileCount = 0;
  for (const filePath of filesToDelete) {
    if (!filePath) continue;
    try {
      await fs.unlink(filePath);
      deletedFileCount++;
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        logger.warn({ filePath, err: e }, 'Failed to delete orphaned file');
      }
    }
  }

  logger.info({
    deletedSnapshots: expiredSnapshots.length,
    deletedDiffs: expiredDiffs.length,
    deletedFiles: deletedFileCount,
  }, 'Maintenance completed');
}

async function resetMonthlyQuotas() {
  logger.info('Resetting monthly quotas for all users');
  await db.update(users).set({
    checksUsedThisPeriod: 0,
    periodResetAt: sql`NOW() + INTERVAL '30 days'`
  });
}

/**
 * Worker: Site discovery. Layered crawl (sitemap → cheerio → playwright).
 * Result is stored as job.returnvalue and read back by GET /monitors/discover/:jobId.
 */
export const discoveryWorker = new Worker('discovery-queue', async (job: Job) => {
  const { url } = job.data as { url: string };
  logger.info({ jobId: job.id, url }, 'Discovery: starting');
  const result = await discover(url, async (msg) => {
    await job.updateProgress({ message: msg }).catch(() => {});
  });
  logger.info({ jobId: job.id, count: result.urls.length, fallback: result.fallbackUsed }, 'Discovery: done');
  return result;
}, { connection, concurrency: 3 });

/**
 * Worker: Processes 'send-alert' jobs.
 * Reads pre-rendered diff_html from the snapshot row — no disk reads.
 */
export const alertWorker = new Worker('alert-queue', async (job: Job) => {
  const { monitorId, userId, diffId, snapshotNewId } = job.data;

  const [alertRecord] = await db.insert(alerts).values({
    userId,
    monitorId,
    diffId,
    channel: 'email',
    status: 'pending',
  }).returning({ id: alerts.id });

  try {
    // Load monitor, user, and pre-rendered diff HTML in one query
    const [row] = await db
      .select({
        monitorName: monitors.name,
        monitorUrl: monitors.url,
        userEmail: users.email,
        diffHtml: snapshots.diffHtml,
      })
      .from(monitors)
      .innerJoin(users, eq(monitors.userId, users.id))
      .leftJoin(snapshots, eq(snapshots.id, snapshotNewId))
      .where(eq(monitors.id, monitorId));

    if (!row) throw new Error(`Monitor ${monitorId} not found`);

    let diffHtmlFragment = row.diffHtml;

    // Fallback: regenerate from diff file if snapshot has no pre-rendered HTML
    if (!diffHtmlFragment) {
      const { renderDiffHtmlFragment } = await import('../engine/diff.js');
      const [diffData] = await db.select({ diffPath: diffs.diffPath }).from(diffs).where(eq(diffs.id, diffId));
      if (diffData?.diffPath) {
        const diffJson = JSON.parse(await fs.readFile(diffData.diffPath, 'utf-8'));
        diffHtmlFragment = renderDiffHtmlFragment(diffJson);
      }
    }

    const sent = await sendAlertEmail(
      row.userEmail,
      row.monitorName,
      row.monitorUrl,
      diffHtmlFragment ?? '<p>No diff available.</p>'
    );

    await db.update(alerts)
      .set({
        status: sent ? 'sent' : 'failed',
        sentAt: sent ? new Date() : null,
        error: sent ? null : 'sendAlertEmail returned false (check RESEND_API_KEY)',
      })
      .where(eq(alerts.id, alertRecord.id));

    logger.info({ alertId: alertRecord.id, monitorId, sent }, 'Alert processed');

  } catch (err: any) {
    logger.error({ err, monitorId, diffId }, 'Failed to process alert job');
    await db.update(alerts)
      .set({ status: 'failed', error: err.message ?? 'Unknown error' })
      .where(eq(alerts.id, alertRecord.id))
      .catch(() => {});
    throw err;
  }
}, { connection, concurrency: 2 });
