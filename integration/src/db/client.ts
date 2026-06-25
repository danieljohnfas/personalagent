import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  // We don't want to crash at import time during testing if mocked, 
  // but we should warn or throw if we actually try to use it without mocking.
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('DATABASE_URL environment variable is not set. Database connection cannot be established.');
  }
}

// In test environment, this client will be mocked.
// The `databaseUrl || ''` prevents an error during import in tests.
const sql = neon(databaseUrl || 'postgresql://mock:mock@mock/mock');
export const db = drizzle(sql, { schema });
