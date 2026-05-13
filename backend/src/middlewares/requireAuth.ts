import type { Request, Response, NextFunction } from 'express';
import { validateSession } from '../lib/auth.js';
import type { User } from '../db/schema.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

/**
 * Middleware that requires a valid session token in the Authorization header.
 * Sets req.user and req.sessionId on success.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer '
  const result = await validateSession(token);

  if (!result) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.user = result.user;
  req.sessionId = result.sessionId;
  next();
}
