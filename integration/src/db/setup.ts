import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function setup() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
  console.log('vector extension created');
}
setup().catch(console.error);
