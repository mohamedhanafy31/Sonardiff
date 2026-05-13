import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3001',

  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  sessionSecret: process.env.SESSION_SECRET!,

  resendApiKey: process.env.RESEND_API_KEY!,
  resendFrom: process.env.RESEND_FROM || 'hanafy@sonardiff.com',

  proxyUrl: process.env.PROXY_URL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',

  // Plan limits
  plans: {
    free: {
      maxMonitors: 5,
      checkIntervalMinutes: 1440, // daily (24h)
      planLimit: 150,             // 5 monitors × 1 check/day × 30 days
      snapshotTtlDays: 7,
      maxSnapshotsPerMonitor: 10,
    },
    pro: {
      maxMonitors: 50,
      checkIntervalMinutes: 60,   // hourly
      planLimit: 36000,           // 50 monitors × 24 checks/day × 30 days
      snapshotTtlDays: 30,
      maxSnapshotsPerMonitor: 100,
    },
  },

  // Session
  sessionTtlDays: 30,
  sessionSlidingThresholdDays: 7,

  // Data directories
  dataDir: process.env.DATA_DIR || './data',
  logsDir: process.env.LOGS_DIR || './logs',
} as const;

// Validate required env vars at startup
const required = ['DATABASE_URL', 'SESSION_SECRET', 'RESEND_API_KEY'] as const;
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
