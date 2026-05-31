import { Pool } from 'pg';
import dotenv from 'dotenv';
import { runner } from 'node-pg-migrate';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://fridge_user:fridge_password@localhost:5432/fresh_fridge';

console.info(`[DB] Connecting to PostgreSQL...`);

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' && !connectionString.includes('localhost') && !connectionString.includes('db')
    ? { rejectUnauthorized: false }
    : false
});

export async function initDb() {
  console.info('[DB] Running migrations / schema setup via node-pg-migrate...');
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const migrationsDir = isProduction ? 'dist/migrations' : 'migrations';
    
    await runner({
      databaseUrl: connectionString,
      dir: migrationsDir,
      direction: 'up',
      migrationsTable: 'pgmigrations',
      verbose: true,
    });
    console.info('[DB] Schema setup completed successfully.');
  } catch (err) {
    console.error('[DB] Schema setup failed:', err);
    throw err;
  }
}
