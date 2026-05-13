import { logger } from './lib/logger.js';
import { setupSystemJobs, scrapeWorker, systemWorker, alertWorker, discoveryWorker } from './worker/jobs.js';

logger.info('🔧 SonarDiff Worker starting...');

// Start system jobs
setupSystemJobs().catch((err) => {
  logger.error({ err }, 'Failed to setup system jobs');
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Worker received shutdown signal, closing queues...');
  await scrapeWorker.close();
  await systemWorker.close();
  await alertWorker.close();
  await discoveryWorker.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
