import { Router, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { eq, count, sql, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { snapshots, monitors, users } from '../../db/schema.js';
import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';

export const adminStorageRouter: import('express').Router = Router();

async function getSnapshotFiles(): Promise<{ name: string; size: number }[]> {
  const dir = path.join(config.dataDir, 'snapshots');
  try {
    const files = await fs.readdir(dir);
    return await Promise.all(
      files.map(async name => {
        const size = await fs.stat(path.join(dir, name)).then(s => s.size).catch(() => 0);
        return { name, size };
      })
    );
  } catch {
    return [];
  }
}

adminStorageRouter.get('/', async (_req: Request, res: Response) => {
  const [files, snapshotRows, oldestRow, perUser] = await Promise.all([
    getSnapshotFiles(),
    db.select({ cnt: count(), expired: sql<number>`COUNT(*) FILTER (WHERE expires_at < NOW())` }).from(snapshots),
    db.select({ oldest: sql<Date>`MIN(captured_at)` }).from(snapshots),
    db.select({
      email: users.email,
      snapshotCount: count(),
    })
      .from(snapshots)
      .innerJoin(monitors, eq(snapshots.monitorId, monitors.id))
      .innerJoin(users, eq(monitors.userId, users.id))
      .groupBy(users.email, users.id)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(20),
  ]);

  const totalBytes = files.reduce((a, f) => a + f.size, 0);
  const totalFiles = files.length;
  const totalSnapshots = Number(snapshotRows[0]?.cnt ?? 0);
  const expiredSnapshots = Number(snapshotRows[0]?.expired ?? 0);

  // Orphaned: files on disk with no matching DB snapshot_path
  const dbPaths = new Set(
    (await db.select({ p: snapshots.screenshotPath }).from(snapshots)).map(r => path.basename(r.p ?? ''))
  );
  const orphanedFiles = files.filter(f => !dbPaths.has(f.name) && f.name.endsWith('.jpeg'));

  res.json({
    totalFiles,
    totalBytes,
    totalSnapshots,
    expiredSnapshots,
    activeSnapshots: totalSnapshots - expiredSnapshots,
    orphanedFileCount: orphanedFiles.length,
    orphanedBytes: orphanedFiles.reduce((a, f) => a + f.size, 0),
    oldestSnapshot: oldestRow[0]?.oldest ?? null,
    nextGcRun: '03:00 daily (cron)',
    perUser: perUser.map(r => ({ email: r.email, snapshotCount: Number(r.snapshotCount) })),
  });
});

adminStorageRouter.post('/gc', async (_req: Request, res: Response) => {
  // Import queue dynamically to avoid circular deps
  const { systemQueue } = await import('../../worker/jobs.js');
  const job = await systemQueue.add('gc-maintenance', {}, {
    removeOnComplete: 10,
    removeOnFail: 10,
  });
  logger.info({ adminAction: true, action: 'trigger_gc', jobId: job.id }, 'Admin triggered GC');
  res.json({ ok: true, jobId: job.id });
});

adminStorageRouter.post('/purge-orphans', async (req: Request, res: Response) => {
  const dir = path.join(config.dataDir, 'snapshots');
  const files = await getSnapshotFiles();

  const dbPaths = new Set(
    (await db.select({ p: snapshots.screenshotPath }).from(snapshots)).map(r => path.basename(r.p ?? ''))
  );

  const orphans = files.filter(f => !dbPaths.has(f.name) && f.name.endsWith('.jpeg'));

  let deleted = 0;
  for (const f of orphans) {
    try {
      await fs.unlink(path.join(dir, f.name));
      deleted++;
    } catch {
      // Skip files that can't be deleted
    }
  }

  logger.info({ adminAction: true, action: 'purge_orphans', deleted }, 'Admin purged orphaned files');
  res.json({ ok: true, deleted, bytesFreed: orphans.slice(0, deleted).reduce((a, f) => a + f.size, 0) });
});
