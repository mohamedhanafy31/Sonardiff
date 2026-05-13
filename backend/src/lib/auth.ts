import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq, and, gt, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, sessions, type User } from '../db/schema.js';
import { config } from './config.js';
import { logger } from './logger.js';

const SALT_ROUNDS = 12;
const TOKEN_BYTES = 32;

/**
 * Hash a password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Create a new session for a user. Returns the session token.
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.sessionTtlDays);

  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt,
  });

  logger.debug({ userId }, 'Session created');
  return token;
}

/**
 * Validate a session token and return the associated user.
 * Implements sliding expiry: extends session if < 7 days remaining.
 */
export async function validateSession(
  token: string
): Promise<{ user: User; sessionId: string } | null> {
  const result = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, token),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const { sessions: session, users: user } = result[0];

  // Sliding expiry: extend if < 7 days remaining
  const now = new Date();
  const daysUntilExpiry =
    (session.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry < config.sessionSlidingThresholdDays) {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + config.sessionTtlDays);

    await db
      .update(sessions)
      .set({ expiresAt: newExpiry })
      .where(eq(sessions.id, token));

    logger.debug({ userId: user.id }, 'Session sliding-extended');
  }

  return { user, sessionId: session.id };
}

/**
 * Delete a session (logout).
 */
export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token));
}

/**
 * Delete all expired sessions (cleanup job).
 */
export async function deleteExpiredSessions(): Promise<number> {
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning();
  return result.length;
}
