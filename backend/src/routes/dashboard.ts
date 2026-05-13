import { Router, type Request, type Response } from 'express';
import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { monitors, diffs, type Diff } from '../db/schema.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { logger } from '../lib/logger.js';

const router: ReturnType<typeof Router> = Router();

router.use(requireAuth);

// --- GET /api/dashboard/stats ---
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const userMonitors = await db
      .select({ id: monitors.id })
      .from(monitors)
      .where(eq(monitors.userId, user.id));

    const monitorIds = userMonitors.map(m => m.id);

    let recentDiffs: Diff[] = [];
    if (monitorIds.length > 0) {
      recentDiffs = await db
        .select()
        .from(diffs)
        .where(inArray(diffs.monitorId, monitorIds))
        .orderBy(desc(diffs.detectedAt))
        .limit(10);
    }

    res.json({
      activeMonitors: userMonitors.length,
      recentDiffs
    });
  } catch (err) {
    logger.error({ err }, 'Error fetching dashboard stats');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as dashboardRouter };
