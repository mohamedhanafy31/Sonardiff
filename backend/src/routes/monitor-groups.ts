import { Router, type Request, type Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { monitors, monitorGroups } from '../db/schema.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';

const router: ReturnType<typeof Router> = Router();
router.use(requireAuth);

/**
 * GET /api/monitor-groups
 * Returns all groups for the user with member count + active count + earliest interval.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: monitorGroups.id,
        name: monitorGroups.name,
        baseUrl: monitorGroups.baseUrl,
        createdAt: monitorGroups.createdAt,
        memberCount: sql<number>`COUNT(${monitors.id})::int`,
        activeCount: sql<number>`COUNT(${monitors.id}) FILTER (WHERE ${monitors.isActive})::int`,
      })
      .from(monitorGroups)
      .leftJoin(monitors, eq(monitors.groupId, monitorGroups.id))
      .where(eq(monitorGroups.userId, req.user!.id))
      .groupBy(monitorGroups.id)
      .orderBy(desc(monitorGroups.createdAt));
    res.json({ groups: rows });
  } catch (err) {
    logger.error({ err }, 'Error fetching monitor groups');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/monitor-groups/:id
 * Returns the group plus its member monitors.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [group] = await db
      .select()
      .from(monitorGroups)
      .where(and(eq(monitorGroups.id, req.params.id as string), eq(monitorGroups.userId, req.user!.id)))
      .limit(1);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    const members = await db
      .select()
      .from(monitors)
      .where(eq(monitors.groupId, group.id))
      .orderBy(desc(monitors.createdAt));
    res.json({ group, monitors: members });
  } catch (err) {
    logger.error({ err }, 'Error fetching monitor group');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/monitor-groups/:id
 * Rename, optionally update shared settings (cadence/threshold/cssSelector/exclusionRules)
 * which apply to ALL members. Quota re-validated when interval changes.
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { name, checkIntervalMinutes, threshold, cssSelector, exclusionRules } = req.body;
    const [group] = await db
      .select()
      .from(monitorGroups)
      .where(and(eq(monitorGroups.id, req.params.id as string), eq(monitorGroups.userId, user.id)))
      .limit(1);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const groupUpdates: Partial<typeof monitorGroups.$inferInsert> = {};
    if (name !== undefined) groupUpdates.name = String(name).trim().slice(0, 255);

    const monitorUpdates: any = {};

    if (checkIntervalMinutes !== undefined) {
      const interval = Number(checkIntervalMinutes);
      const planConfig = config.plans[user.plan];
      if (interval < planConfig.checkIntervalMinutes) {
        res.status(403).json({ error: `Your plan requires a minimum check interval of ${planConfig.checkIntervalMinutes} minutes` });
        return;
      }
      // Quota re-check across all of this user's active monitors with the new interval
      const memberCount = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(monitors)
        .where(and(eq(monitors.groupId, group.id), eq(monitors.isActive, true)));
      const otherMonitors = await db
        .select({ checkIntervalMinutes: monitors.checkIntervalMinutes })
        .from(monitors)
        .where(and(eq(monitors.userId, user.id), eq(monitors.isActive, true), sql`${monitors.groupId} IS DISTINCT FROM ${group.id}`));
      const minutesInMonth = 30 * 24 * 60;
      let projected = otherMonitors.reduce((sum, m) => sum + Math.floor(minutesInMonth / m.checkIntervalMinutes), 0);
      projected += Math.floor(minutesInMonth / interval) * (memberCount[0]?.c ?? 0);
      if (projected > user.planLimit) {
        res.status(403).json({ error: `This change would project ${projected} checks/month, exceeding your plan limit of ${user.planLimit}.` });
        return;
      }
      monitorUpdates.checkIntervalMinutes = interval;
    }

    if (threshold !== undefined) {
      const t = Number(threshold);
      if (isNaN(t) || t <= 0 || t > 1) {
        res.status(400).json({ error: 'threshold must be a number between 0.01 and 1' });
        return;
      }
      monitorUpdates.threshold = t;
    }

    if (cssSelector !== undefined || (Array.isArray(exclusionRules) && exclusionRules.length > 0)) {
      if (user.plan === 'free') {
        res.status(403).json({ error: 'Element targeting and exclusion rules require the Pro plan' });
        return;
      }
      if (cssSelector !== undefined) monitorUpdates.cssSelector = cssSelector || null;
      if (exclusionRules !== undefined) monitorUpdates.exclusionRules = exclusionRules;
    }

    await db.transaction(async (tx) => {
      if (Object.keys(groupUpdates).length > 0) {
        groupUpdates.updatedAt = new Date();
        await tx.update(monitorGroups).set(groupUpdates).where(eq(monitorGroups.id, group.id));
      }
      if (Object.keys(monitorUpdates).length > 0) {
        monitorUpdates.updatedAt = new Date();
        await tx.update(monitors).set(monitorUpdates).where(eq(monitors.groupId, group.id));
      }
    });

    const [updated] = await db.select().from(monitorGroups).where(eq(monitorGroups.id, group.id)).limit(1);
    res.json({ group: updated });
  } catch (err) {
    logger.error({ err }, 'Error updating monitor group');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/monitor-groups/:id/pause
 * Toggle isActive on all members. Body: { isActive: boolean }.
 */
router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive (boolean) is required' });
      return;
    }
    const [group] = await db
      .select({ id: monitorGroups.id })
      .from(monitorGroups)
      .where(and(eq(monitorGroups.id, req.params.id as string), eq(monitorGroups.userId, req.user!.id)))
      .limit(1);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    const result = await db
      .update(monitors)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(monitors.groupId, group.id))
      .returning({ id: monitors.id });
    res.json({ updated: result.length, isActive });
  } catch (err) {
    logger.error({ err }, 'Error toggling group pause');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/monitor-groups/:id
 * Cascades to delete all member monitors (and their snapshots/diffs via existing FKs).
 * Pass ?keepMonitors=true to delete the group only and leave member monitors as ungrouped.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const keepMonitors = req.query.keepMonitors === 'true';
    const [group] = await db
      .select({ id: monitorGroups.id })
      .from(monitorGroups)
      .where(and(eq(monitorGroups.id, req.params.id as string), eq(monitorGroups.userId, req.user!.id)))
      .limit(1);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    let deletedMonitors = 0;
    await db.transaction(async (tx) => {
      if (!keepMonitors) {
        const r = await tx.delete(monitors).where(eq(monitors.groupId, group.id)).returning({ id: monitors.id });
        deletedMonitors = r.length;
      }
      // Always delete the group; if keepMonitors=true, the FK ON DELETE SET NULL detaches them
      await tx.delete(monitorGroups).where(eq(monitorGroups.id, group.id));
    });

    res.json({ success: true, deletedMonitors });
  } catch (err) {
    logger.error({ err }, 'Error deleting monitor group');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as monitorGroupsRouter };
