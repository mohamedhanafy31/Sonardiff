import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';

const logsDir = process.env.LOGS_DIR || './logs';

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev && {
    transport: {
      targets: [
        {
          target: 'pino/file',
          options: { destination: 1 }, // stdout
          level: 'debug',
        },
        {
          target: 'pino-roll',
          options: {
            file: path.join(logsDir, 'sonardiff'),
            frequency: 'daily',
            dateFormat: 'yyyy-MM-dd',
            extension: '.log',
            mkdir: true,
          },
          level: 'debug',
        },
      ],
    },
  }),
  ...(!isDev && {
    transport: {
      target: 'pino-roll',
      options: {
        file: path.join(logsDir, 'sonardiff'),
        frequency: 'daily',
        dateFormat: 'yyyy-MM-dd',
        extension: '.log',
        mkdir: true,
      },
    },
  }),
});

/**
 * Create a child logger with a correlation ID for request tracing.
 */
export function createChildLogger(correlationId: string) {
  return logger.child({ correlationId });
}
