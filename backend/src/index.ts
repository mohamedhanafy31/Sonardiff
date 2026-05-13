import { app } from './app.js';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './db/index.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Run DB migrations before accepting traffic
try {
  await migrate(db, { migrationsFolder: path.join(__dirname, 'db/migrations') });
  logger.info('Database migrations applied');
} catch (err) {
  logger.error({ err }, 'Failed to run migrations');
  process.exit(1);
}

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv },
    `🚀 SonarDiff API server listening on port ${config.port}`
  );
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal, closing server...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
