import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { adminSessions } from '../../db/schema.js';
import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { requireAdmin } from '../../middlewares/requireAdmin.js';

export const adminAuthRouter: import('express').Router = Router();

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: { error: 'Too many login attempts. Try again in 5 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const ADMIN_SESSION_TTL_HOURS = 8;

adminAuthRouter.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!config.adminUsername || !config.adminPassword) {
    res.status(503).json({
      error:
        'Admin login is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in the server environment.',
    });
    return;
  }

  const userOk = typeof username === 'string' && username.trim() === config.adminUsername;
  const passOk = typeof password === 'string' && password === config.adminPassword;

  if (!userOk || !passOk) {
    res.status(401).json({ error: 'Incorrect username or password' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000);

  await db.insert(adminSessions).values({ id: token, expiresAt });

  logger.info({ adminAction: true, action: 'admin_login' }, 'Admin logged in');

  res.cookie('sd_admin', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    expires: expiresAt,
    path: '/',
  });

  res.json({ ok: true });
});

adminAuthRouter.post('/logout', async (req: Request, res: Response) => {
  const token = req.cookies?.sd_admin as string | undefined;
  if (token) {
    await db.delete(adminSessions).where(eq(adminSessions.id, token));
  }
  res.clearCookie('sd_admin', { path: '/' });
  res.json({ ok: true });
});

adminAuthRouter.get('/me', requireAdmin, (_req: Request, res: Response) => {
  res.json({ ok: true });
});
