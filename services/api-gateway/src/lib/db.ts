import { Pool } from 'pg';
import { logger } from './logger';

export const db = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5432/${process.env.POSTGRES_DB}`,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on('error', (err) => logger.error('Postgres pool error', { err: err.message }));

export const query = (text: string, params?: any[]) => db.query(text, params);
