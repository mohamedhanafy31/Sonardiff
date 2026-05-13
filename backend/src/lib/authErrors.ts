import type { Response } from 'express';
import { config } from './config.js';

/**
 * Map infra / schema errors to actionable API responses instead of a generic 500.
 */
export function sendAuthRouteError(res: Response, err: unknown, logLabel: string): void {
  const e = err as { code?: string; message?: string };
  const code = e?.code;
  const msg = typeof e?.message === 'string' ? e.message : '';

  // PostgreSQL: undefined_column (migrations not applied)
  if (code === '42703') {
    res.status(503).json({
      error:
        'Database schema is out of date. From artifacts/mvp/backend run: pnpm run db:migrate (with Postgres running).',
    });
    return;
  }

  // Node / postgres-js connection failures
  if (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Connection refused') ||
    msg.includes('connect ECONNREFUSED')
  ) {
    res.status(503).json({
      error:
        'Cannot reach the database. Start Postgres (docker compose -f artifacts/mvp/docker-compose.yml up db redis -d), then confirm DATABASE_URL in backend/.env matches the exposed port (e.g. localhost:5433 with the default override).',
    });
    return;
  }

  if (config.nodeEnv === 'development') {
    res.status(500).json({
      error: 'Internal server error',
      detail: msg || String(err),
      context: logLabel,
    });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
