import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../lib/config.js';
import * as schema from './schema.js';

// Connection pool for queries
const queryClient = postgres(config.databaseUrl, {
  max: 10,           // max pool size
  idle_timeout: 20,  // close idle connections after 20s
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

// Export for migrations and raw queries
export { queryClient };
