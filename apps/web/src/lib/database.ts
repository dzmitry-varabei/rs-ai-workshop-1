import { DatabaseClient } from '@english-learning/database-client';

/**
 * Create Database Service client for the web app
 * Uses environment variables for configuration
 */
export function createDatabaseClient(): DatabaseClient {
  const baseUrl = import.meta.env.VITE_DATABASE_SERVICE_URL || 'http://localhost:3001';

  console.debug('Database Service URL:', baseUrl);

  return new DatabaseClient({
    baseUrl,
    timeout: 30000,
  });
}

