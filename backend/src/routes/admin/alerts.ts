import { Router, type Request, type Response } from 'express';
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '../../db/index.js';
import { alerts, users, monitors } from '../../db/schema.js';
import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';

export const adminAlertsRouter: import('express').Router = Router();

const resend = new Resend(config.resendApiKey);

adminAlertsRouter.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const conditions = [];
  if (status && ['pending', 'sent', 'failed'].includes(status)) {
    conditions.push(eq(alerts.status, status as 'pending' | 'sent' | 'failed'));
  }
  if (from) conditions.push(gte(alerts.createdAt, new Date(from)));
  if (to) conditions.push(lte(alerts.createdAt, new Date(to)));

  const [rows, totalRows] = await Promise.all([
    db.select({
      id: alerts.id,
      status: alerts.status,
      channel: alerts.channel,
      sentAt: alerts.sentAt,
      error: alerts.error,
      createdAt: alerts.createdAt,
      diffId: alerts.diffId,
      userEmail: users.email,
      monitorName: monitors.name,
    })
      .from(alerts)
      .innerJoin(users, eq(alerts.userId, users.id))
      .innerJoin(monitors, eq(alerts.monitorId, monitors.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(alerts.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ cnt: count() })
      .from(alerts)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  res.json({
    alerts: rows,
    total: Number(totalRows[0]?.cnt ?? 0),
    page,
    limit,
    pages: Math.ceil(Number(totalRows[0]?.cnt ?? 0) / limit),
  });
});

adminAlertsRouter.post('/:id/retry', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const alertRow = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
  if (!alertRow.length) { res.status(404).json({ error: 'Alert not found' }); return; }

  await db.update(alerts).set({ status: 'pending', error: null }).where(eq(alerts.id, id));

  logger.info({ adminAction: true, action: 'retry_alert', targetId: id }, 'Admin retried alert');
  res.json({ ok: true });
});

adminAlertsRouter.post('/digest', async (req: Request, res: Response) => {
  const to = config.adminEmail || config.resendFrom;
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const [todayAlerts] = await Promise.all([
    db.select({ status: alerts.status, cnt: count() })
      .from(alerts)
      .where(gte(alerts.createdAt, today))
      .groupBy(alerts.status),
  ]);

  const summary = Object.fromEntries(todayAlerts.map(r => [r.status, Number(r.cnt)]));

  try {
    await resend.emails.send({
      from: config.resendFrom,
      to,
      subject: `SonarDiff Alert Digest — ${now.toDateString()}`,
      html: `
        <h2>SonarDiff Alert Digest</h2>
        <p>Date: ${now.toDateString()}</p>
        <ul>
          <li>Sent: ${summary.sent ?? 0}</li>
          <li>Failed: ${summary.failed ?? 0}</li>
          <li>Pending: ${summary.pending ?? 0}</li>
        </ul>
      `,
    });
    res.json({ ok: true, to });
  } catch (err) {
    logger.error({ err }, 'Admin digest email failed');
    res.status(500).json({ error: 'Failed to send digest email' });
  }
});
