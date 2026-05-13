import { Router, type Request, type Response } from 'express';
import { eq, sql, and, gte, lt, count } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '../../db/index.js';
import { users, monitors, diffs, alerts, snapshots } from '../../db/schema.js';
import { config } from '../../lib/config.js';

export const adminStatsRouter: import('express').Router = Router();

adminStatsRouter.get('/', async (_req: Request, res: Response) => {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterday24h = new Date(now);
  yesterday24h.setHours(now.getHours() - 48);
  const last24h = new Date(now);
  last24h.setHours(now.getHours() - 24);

  const [
    userCounts,
    monitorCounts,
    checksToday,
    checksYesterday,
    diffsLast24h,
    diffsPrev24h,
    alertsLast24h,
    alertsPrev24h,
    checksByDay,
  ] = await Promise.all([
    // User counts by plan
    db.select({ plan: users.plan, cnt: count() }).from(users).groupBy(users.plan),

    // Monitor counts by status
    db.select({ status: monitors.status, cnt: count() }).from(monitors).groupBy(monitors.status),

    // Checks today (snapshots captured today)
    db.select({ cnt: count() }).from(snapshots).where(gte(snapshots.capturedAt, today)),

    // Checks yesterday
    db.select({ cnt: count() }).from(snapshots).where(
      and(gte(snapshots.capturedAt, yesterday), lt(snapshots.capturedAt, today))
    ),

    // Diffs last 24h
    db.select({ cnt: count() }).from(diffs).where(gte(diffs.detectedAt, last24h)),

    // Diffs previous 24h
    db.select({ cnt: count() }).from(diffs).where(
      and(gte(diffs.detectedAt, yesterday24h), lt(diffs.detectedAt, last24h))
    ),

    // Alerts last 24h by status
    db.select({ status: alerts.status, cnt: count() }).from(alerts)
      .where(gte(alerts.createdAt, last24h))
      .groupBy(alerts.status),

    // Alerts previous 24h
    db.select({ status: alerts.status, cnt: count() }).from(alerts)
      .where(and(gte(alerts.createdAt, yesterday24h), lt(alerts.createdAt, last24h)))
      .groupBy(alerts.status),

    // Checks per day for last 7 days
    db.select({
      day: sql<string>`DATE(${snapshots.capturedAt})`.as('day'),
      cnt: count(),
    })
      .from(snapshots)
      .where(gte(snapshots.capturedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .groupBy(sql`DATE(${snapshots.capturedAt})`),
  ]);

  // Storage
  let storageBytes = 0;
  try {
    const snapshotsDir = path.join(config.dataDir, 'snapshots');
    const files = await fs.readdir(snapshotsDir);
    const sizes = await Promise.all(
      files.map(f => fs.stat(path.join(snapshotsDir, f)).then(s => s.size).catch(() => 0))
    );
    storageBytes = sizes.reduce((a, b) => a + b, 0);
  } catch {
    storageBytes = 0;
  }

  const planMap = Object.fromEntries(userCounts.map(r => [r.plan, Number(r.cnt)]));
  const statusMap = Object.fromEntries(monitorCounts.map(r => [r.status, Number(r.cnt)]));
  const alertMap = Object.fromEntries(alertsLast24h.map(r => [r.status, Number(r.cnt)]));
  const alertPrevMap = Object.fromEntries(alertsPrev24h.map(r => [r.status, Number(r.cnt)]));

  const checksT = Number(checksToday[0]?.cnt ?? 0);
  const checksY = Number(checksYesterday[0]?.cnt ?? 0);
  const diffsT = Number(diffsLast24h[0]?.cnt ?? 0);
  const diffsP = Number(diffsPrev24h[0]?.cnt ?? 0);

  res.json({
    users: {
      total: (planMap.free ?? 0) + (planMap.pro ?? 0),
      free: planMap.free ?? 0,
      pro: planMap.pro ?? 0,
    },
    monitors: {
      active: statusMap.active ?? 0,
      paused: statusMap.paused ?? 0,
      unreachable: statusMap.unreachable ?? 0,
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
    },
    checksToday: checksT,
    checksTodayVsYesterday: checksY > 0 ? Math.round(((checksT - checksY) / checksY) * 100) : null,
    diffsLast24h: diffsT,
    diffsVsPrev24h: diffsP > 0 ? Math.round(((diffsT - diffsP) / diffsP) * 100) : null,
    alerts: {
      sent: alertMap.sent ?? 0,
      failed: alertMap.failed ?? 0,
      pending: alertMap.pending ?? 0,
      sentPrev: alertPrevMap.sent ?? 0,
      failedPrev: alertPrevMap.failed ?? 0,
    },
    storageBytes,
    checksByDay: checksByDay.map(r => ({ day: r.day, count: Number(r.cnt) })),
  });
});

// Recent failed alerts for overview page
adminStatsRouter.get('/failed-alerts', async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: alerts.id,
      userId: alerts.userId,
      monitorId: alerts.monitorId,
      error: alerts.error,
      createdAt: alerts.createdAt,
      userEmail: users.email,
      monitorName: monitors.name,
    })
    .from(alerts)
    .innerJoin(users, eq(alerts.userId, users.id))
    .innerJoin(monitors, eq(alerts.monitorId, monitors.id))
    .where(eq(alerts.status, 'failed'))
    .orderBy(sql`${alerts.createdAt} DESC`)
    .limit(10);

  res.json(rows);
});
