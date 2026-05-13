import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { adminConfig } from '../../db/schema.js';
import { requireAdmin } from '../../middlewares/requireAdmin.js';
import { logger } from '../../lib/logger.js';

export const adminConfigRouter: import('express').Router = Router();

// Public endpoint — no auth — only exposes maintenance flag + message
adminConfigRouter.get('/public', async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(adminConfig)
    .where(eq(adminConfig.key, 'maintenance_mode'));

  const msgRows = await db
    .select()
    .from(adminConfig)
    .where(eq(adminConfig.key, 'maintenance_message'));

  res.json({
    maintenanceMode: rows[0]?.value === 'true',
    maintenanceMessage: msgRows[0]?.value ?? '',
  });
});

// All other config routes require admin
adminConfigRouter.get('/', requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select().from(adminConfig);
  const flat = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(flat);
});

adminConfigRouter.patch('/', requireAdmin, async (req: Request, res: Response) => {
  const updates = req.body as Record<string, string>;
  if (!updates || typeof updates !== 'object') {
    res.status(400).json({ error: 'Body must be a key-value object' }); return;
  }

  await Promise.all(
    Object.entries(updates).map(([key, value]) =>
      db.insert(adminConfig)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: adminConfig.key, set: { value, updatedAt: new Date() } })
    )
  );

  logger.info({ adminAction: true, action: 'update_config', keys: Object.keys(updates) }, 'Admin updated config');

  const rows = await db.select().from(adminConfig);
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

// Helper used by other routes to read a flag
export async function getConfigFlag(key: string): Promise<string | null> {
  const rows = await db.select().from(adminConfig).where(eq(adminConfig.key, key)).limit(1);
  return rows[0]?.value ?? null;
}
