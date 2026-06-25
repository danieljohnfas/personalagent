import 'dotenv/config';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from './client.js';

async function main() {
  console.log('Running migrations...');
  try {
    await migrate(db, { migrationsFolder: 'drizzle' });
    console.log('Migrations completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
