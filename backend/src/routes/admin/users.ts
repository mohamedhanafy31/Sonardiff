import { Router, type Request, type Response } from 'express';
import { eq, ilike, or, count, sql, and, desc, asc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, monitors, alerts, sessions, snapshots, diffs } from '../../db/schema.js';
import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';

export const adminUsersRouter: import('express').Router = Router();

adminUsersRouter.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;
  const plan = req.query.plan as string | undefined;
  const search = req.query.search as string | undefined;
  const sort = (req.query.sort as string) || 'created_desc';

  const conditions = [];
  if (plan === 'free' || plan === 'pro') {
    conditions.push(eq(users.plan, plan));
  }
  if (search) {
    conditions.push(or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`)));
  }
  if (plan === 'quota') {
    conditions.push(sql`${users.checksUsedThisPeriod} >= ${users.planLimit}`);
  }

  const orderBy = sort === 'created_asc' ? asc(users.createdAt) : desc(users.createdAt);

  const [rows, totalRows] = await Promise.all([
    db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      plan: users.plan,
      planLimit: users.planLimit,
      checksUsedThisPeriod: users.checksUsedThisPeriod,
      manualChecksUsedThisPeriod: users.manualChecksUsedThisPeriod,
      periodResetAt: users.periodResetAt,
      suspended: users.suspended,
      createdAt: users.createdAt,
      monitorCount: sql<number>`(SELECT COUNT(*) FROM monitors WHERE user_id = ${users.id})`,
      activeMonitorCount: sql<number>`(SELECT COUNT(*) FROM monitors WHERE user_id = ${users.id} AND is_active = true)`,
    })
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ cnt: count() }).from(users).where(conditions.length ? and(...conditions) : undefined),
  ]);

  res.json({
    users: rows,
    total: Number(totalRows[0]?.cnt ?? 0),
    page,
    limit,
    pages: Math.ceil(Number(totalRows[0]?.cnt ?? 0) / limit),
  });
});

adminUsersRouter.get('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);

  const userRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!userRows.length) { res.status(404).json({ error: 'User not found' }); return; }
  const user = userRows[0];

  const [userMonitors, recentAlerts] = await Promise.all([
    db.select({
      id: monitors.id,
      name: monitors.name,
      url: monitors.url,
      status: monitors.status,
      fetcherTier: monitors.fetcherTier,
      lastCheckedAt: monitors.lastCheckedAt,
      isActive: monitors.isActive,
      diffCount: sql<number>`(SELECT COUNT(*) FROM diffs WHERE monitor_id = ${monitors.id})`,
    })
      .from(monitors)
      .where(eq(monitors.userId, id))
      .orderBy(desc(monitors.createdAt)),
    db.select({
      id: alerts.id,
      status: alerts.status,
      sentAt: alerts.sentAt,
      error: alerts.error,
      createdAt: alerts.createdAt,
      monitorName: monitors.name,
    })
      .from(alerts)
      .innerJoin(monitors, eq(alerts.monitorId, monitors.id))
      .where(eq(alerts.userId, id))
      .orderBy(desc(alerts.createdAt))
      .limit(20),
  ]);

  res.json({ user, monitors: userMonitors, alerts: recentAlerts });
});

adminUsersRouter.patch('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { plan, planLimit, suspended } = req.body as {
    plan?: 'free' | 'pro';
    planLimit?: number;
    suspended?: boolean;
  };

  const userRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!userRows.length) { res.status(404).json({ error: 'User not found' }); return; }
  const user = userRows[0];

  const updates: Partial<typeof users.$inferInsert> = {};
  let pausedMonitors = 0;
  let clearedSelectors = 0;

  if (typeof suspended === 'boolean') updates.suspended = suspended;

  if (plan && plan !== user.plan) {
    updates.plan = plan;

    if (plan === 'pro') {
      updates.planLimit = planLimit ?? config.plans.pro.planLimit;
    } else if (plan === 'free') {
      updates.planLimit = planLimit ?? config.plans.free.planLimit;

      // Pause monitors with sub-hourly interval (violates free plan)
      const subHourly = await db
        .select({ id: monitors.id })
        .from(monitors)
        .where(and(eq(monitors.userId, id), sql`${monitors.checkIntervalMinutes} < 1440`));

      if (subHourly.length) {
        await db
          .update(monitors)
          .set({ isActive: false, status: 'paused' })
          .where(and(eq(monitors.userId, id), sql`${monitors.checkIntervalMinutes} < 1440`));
        pausedMonitors = subHourly.length;
      }

      // Clear CSS selectors (Pro-only feature)
      const withSelectors = await db
        .select({ id: monitors.id })
        .from(monitors)
        .where(and(eq(monitors.userId, id), sql`${monitors.cssSelector} IS NOT NULL`));

      if (withSelectors.length) {
        await db
          .update(monitors)
          .set({ cssSelector: null })
          .where(and(eq(monitors.userId, id), sql`${monitors.cssSelector} IS NOT NULL`));
        clearedSelectors = withSelectors.length;
      }
    }
  } else if (planLimit !== undefined) {
    updates.planLimit = planLimit;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' }); return;
  }

  updates.updatedAt = new Date();
  const updated = await db.update(users).set(updates).where(eq(users.id, id)).returning();

  logger.info({ adminAction: true, action: 'patch_user', targetId: id, updates }, 'Admin patched user');

  res.json({ user: updated[0], pausedMonitors, clearedSelectors });
});

adminUsersRouter.post('/:id/reset-quota', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const userRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!userRows.length) { res.status(404).json({ error: 'User not found' }); return; }

  await db.update(users).set({
    checksUsedThisPeriod: 0,
    manualChecksUsedThisPeriod: 0,
    updatedAt: new Date(),
  }).where(eq(users.id, id));

  logger.info({ adminAction: true, action: 'reset_quota', targetId: id }, 'Admin reset quota');
  res.json({ ok: true });
});

adminUsersRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const userRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!userRows.length) { res.status(404).json({ error: 'User not found' }); return; }

  // Cascades handle monitors/snapshots/diffs/alerts/sessions via FK
  await db.delete(users).where(eq(users.id, id));

  logger.info({ adminAction: true, action: 'delete_user', targetId: id }, 'Admin deleted user');
  res.json({ ok: true });
});
