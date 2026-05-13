import type { Request, Response, NextFunction } from 'express';
import { eq, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { adminSessions } from '../db/schema.js';

declare global {
  namespace Express {
    interface Request {
      isAdmin?: boolean;
    }
  }
}

/**
 * Middleware that validates the sd_admin session cookie against admin_sessions.
 * No caching — validates on every request.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.sd_admin as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }

  const result = await db
    .select()
    .from(adminSessions)
    .where(
      eq(adminSessions.id, token)
    )
    .limit(1);

  if (result.length === 0) {
    res.clearCookie('sd_admin');
    res.status(401).json({ error: 'Invalid or expired admin session' });
    return;
  }

  const session = result[0];
  if (session.expiresAt < new Date()) {
    await db.delete(adminSessions).where(eq(adminSessions.id, token));
    res.clearCookie('sd_admin');
    res.status(401).json({ error: 'Admin session expired' });
    return;
  }

  req.isAdmin = true;
  next();
}
