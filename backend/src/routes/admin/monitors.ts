import { Router, type Request, type Response } from 'express';
import { eq, ilike, or, count, sql, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { monitors, users } from '../../db/schema.js';
import { logger } from '../../lib/logger.js';

export const adminMonitorsRouter: import('express').Router = Router();

adminMonitorsRouter.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const tier = req.query.tier as string | undefined;
  const plan = req.query.plan as string | undefined;
  const search = req.query.search as string | undefined;

  const conditions = [];
  if (status && ['active', 'paused', 'unreachable'].includes(status)) {
    conditions.push(eq(monitors.status, status as 'active' | 'paused' | 'unreachable'));
  }
  if (tier) {
    conditions.push(eq(monitors.fetcherTier, parseInt(tier)));
  }
  if (plan && ['free', 'pro'].includes(plan)) {
    conditions.push(eq(users.plan, plan as 'free' | 'pro'));
  }
  if (search) {
    conditions.push(or(ilike(monitors.url, `%${search}%`), ilike(monitors.name, `%${search}%`)));
  }

  const [rows, totalRows] = await Promise.all([
    db.select({
      id: monitors.id,
      name: monitors.name,
      url: monitors.url,
      status: monitors.status,
      isActive: monitors.isActive,
      fetcherTier: monitors.fetcherTier,
      checkIntervalMinutes: monitors.checkIntervalMinutes,
      lastCheckedAt: monitors.lastCheckedAt,
      userId: monitors.userId,
      userEmail: users.email,
      userPlan: users.plan,
      diffCount: sql<number>`(SELECT COUNT(*) FROM diffs WHERE monitor_id = ${monitors.id})`,
    })
      .from(monitors)
      .innerJoin(users, eq(monitors.userId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(monitors.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ cnt: count() })
      .from(monitors)
      .innerJoin(users, eq(monitors.userId, users.id))
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  res.json({
    monitors: rows,
    total: Number(totalRows[0]?.cnt ?? 0),
    page,
    limit,
    pages: Math.ceil(Number(totalRows[0]?.cnt ?? 0) / limit),
  });
});

adminMonitorsRouter.patch('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { isActive, status } = req.body as { isActive?: boolean; status?: string };

  const updates: Partial<typeof monitors.$inferInsert> = { updatedAt: new Date() };
  if (typeof isActive === 'boolean') updates.isActive = isActive;
  if (status && ['active', 'paused', 'unreachable'].includes(status)) {
    updates.status = status as 'active' | 'paused' | 'unreachable';
  }

  const updated = await db.update(monitors).set(updates).where(eq(monitors.id, id)).returning();
  if (!updated.length) { res.status(404).json({ error: 'Monitor not found' }); return; }

  logger.info({ adminAction: true, action: 'patch_monitor', targetId: id }, 'Admin patched monitor');
  res.json(updated[0]);
});

adminMonitorsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const deleted = await db.delete(monitors).where(eq(monitors.id, id)).returning();
  if (!deleted.length) { res.status(404).json({ error: 'Monitor not found' }); return; }

  logger.info({ adminAction: true, action: 'delete_monitor', targetId: id }, 'Admin deleted monitor');
  res.json({ ok: true });
});

// Bulk actions
adminMonitorsRouter.post('/bulk', async (req: Request, res: Response) => {
  const { ids, action } = req.body as { ids?: string[]; action?: string };
  if (!ids?.length || !action) { res.status(400).json({ error: 'ids and action required' }); return; }

  if (!['pause', 'resume', 'delete'].includes(action)) {
    res.status(400).json({ error: 'action must be pause, resume, or delete' }); return;
  }

  if (action === 'delete') {
    await Promise.all(ids.map(id => db.delete(monitors).where(eq(monitors.id, id))));
  } else {
    const updates = action === 'pause'
      ? { isActive: false, status: 'paused' as const, updatedAt: new Date() }
      : { isActive: true, status: 'active' as const, updatedAt: new Date() };
    await Promise.all(ids.map(id => db.update(monitors).set(updates).where(eq(monitors.id, id))));
  }

  logger.info({ adminAction: true, action: `bulk_${action}`, ids }, `Admin bulk ${action} monitors`);
  res.json({ ok: true, affected: ids.length });
});
