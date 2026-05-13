import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
} from '../lib/auth.js';
import { config } from '../lib/config.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { logger } from '../lib/logger.js';
import { sendAuthRouteError } from '../lib/authErrors.js';

const router: ReturnType<typeof Router> = Router();

// --- GET /api/auth/test ---
router.get('/test', (req, res) => { res.json({ msg: 'auth router works' }) });

// --- POST /api/auth/register ---
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Feature flag: registration_open
    const { getConfigFlag } = await import('./admin/config.js');
    const registrationOpen = await getConfigFlag('registration_open');
    if (registrationOpen === 'false') {
      res.status(503).json({ error: 'Registration is temporarily disabled.', maintenance: true });
      return;
    }

    const { email, password, name, plan } = req.body;

    // Validate input
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Validate plan
    const selectedPlan = plan === 'pro' ? 'pro' : 'free';
    const planConfig = config.plans[selectedPlan];

    // Check if email already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const periodResetAt = new Date();
    periodResetAt.setDate(periodResetAt.getDate() + 30);

    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name.trim(),
        plan: selectedPlan,
        planLimit: planConfig.planLimit,
        checksUsedThisPeriod: 0,
        periodResetAt,
      })
      .returning();

    // Create session
    const token = await createSession(user.id);

    logger.info({ userId: user.id, plan: selectedPlan }, 'User registered');

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        planLimit: user.planLimit,
        checksUsedThisPeriod: user.checksUsedThisPeriod,
        manualChecksUsedThisPeriod: user.manualChecksUsedThisPeriod,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Registration error');
    sendAuthRouteError(res, err, 'register');
  }
});

// --- POST /api/auth/login ---
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Verify password (guard corrupt rows)
    if (!user.passwordHash || typeof user.passwordHash !== 'string') {
      logger.error({ userId: user.id }, 'Login failed: missing password hash');
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    let valid = false;
    try {
      valid = await verifyPassword(password, user.passwordHash);
    } catch (verifyErr) {
      logger.error({ err: verifyErr, userId: user.id }, 'Password verify threw');
      sendAuthRouteError(res, verifyErr, 'login-verify');
      return;
    }
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Create session
    const token = await createSession(user.id);

    logger.info({ userId: user.id }, 'User logged in');

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        planLimit: user.planLimit,
        checksUsedThisPeriod: user.checksUsedThisPeriod,
        manualChecksUsedThisPeriod: user.manualChecksUsedThisPeriod,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Login error');
    sendAuthRouteError(res, err, 'login');
  }
});

// --- POST /api/auth/logout ---
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    await deleteSession(req.sessionId!);
    logger.info({ userId: req.user!.id }, 'User logged out');
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Logout error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GET /api/auth/me ---
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      planLimit: user.planLimit,
      checksUsedThisPeriod: user.checksUsedThisPeriod,
      manualChecksUsedThisPeriod: user.manualChecksUsedThisPeriod,
      periodResetAt: user.periodResetAt,
      preferences: user.preferences,
      apiToken: user.apiToken,
      createdAt: user.createdAt,
    },
  });
});

// --- PATCH /api/auth/me ---
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, email, password, preferences } = req.body;
    const user = req.user!;
    const updates: any = {};

    if (name) updates.name = name.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (preferences) updates.preferences = preferences;
    if (password) {
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }
      updates.passwordHash = await hashPassword(password);
    }

    updates.updatedAt = new Date();

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning();

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        plan: updatedUser.plan,
        planLimit: updatedUser.planLimit,
        checksUsedThisPeriod: updatedUser.checksUsedThisPeriod,
        manualChecksUsedThisPeriod: updatedUser.manualChecksUsedThisPeriod,
        periodResetAt: updatedUser.periodResetAt,
        preferences: updatedUser.preferences,
        apiToken: updatedUser.apiToken,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Update profile error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- DELETE /api/auth/me ---
router.delete('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    
    // Deleting user will cascade to sessions, monitors, diffs, and snapshots in DB
    await db.delete(users).where(eq(users.id, user.id));

    logger.info({ userId: user.id }, 'Account deleted');
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete account error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- POST /api/auth/api-token ---
router.post('/api-token', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const newToken = crypto.randomUUID();

    const [updatedUser] = await db
      .update(users)
      .set({ apiToken: newToken, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();

    res.json({ apiToken: updatedUser.apiToken });
  } catch (err) {
    logger.error({ err }, 'Generate API token error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as authRouter };
