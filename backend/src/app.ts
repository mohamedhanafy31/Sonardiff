import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { sql } from 'drizzle-orm';
import { logger } from './lib/logger.js';
import { authRouter } from './routes/auth.js';
import { db } from './db/index.js';

const app: Express = express();

// --- Middleware ---
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin (no origin header) and all localhost-based origins
    if (!origin || allowedOrigins.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // In dev, allow all origins; tighten in production
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp.default({ logger }));

// --- Health Check (includes DB ping so misconfigured DATABASE_URL surfaces clearly)
app.get('/api/healthz', async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, 'healthz: database check failed');
    res.status(503).json({
      status: 'degraded',
      database: 'down',
      timestamp: new Date().toISOString(),
    });
  }
});

import { monitorsRouter } from './routes/monitors.js';
import { monitorGroupsRouter } from './routes/monitor-groups.js';
import { domPickerRouter } from './routes/dom-picker.js';
import { dashboardRouter } from './routes/dashboard.js';
import { adminRouter } from './routes/admin/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './middlewares/requireAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Routes ---
app.use('/api/auth', authRouter);
app.use('/api/monitors', monitorsRouter);
app.use('/api/monitor-groups', monitorGroupsRouter);
app.use('/api/dom-picker', domPickerRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin', adminRouter);

// Serve snapshots securely (require auth)
app.use('/api/snapshots', requireAuth, express.static(path.join(__dirname, '../snapshots')));

// --- Global Error Handler ---
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

export { app };
export default app;
