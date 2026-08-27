import pg from 'pg';
import { POSTGRES_POSTGIS_SCHEMA } from './postgres.js';

const { Pool } = pg;

export interface DbConfig {
  connectionString?: string;
  isPostgres: boolean;
}

let pgPool: pg.Pool | null = null;

export function getDbConfig(): DbConfig {
  const dbUrl = process.env.DATABASE_URL || '';
  const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

  if (process.env.NODE_ENV === 'production' && !isPostgres) {
    throw new Error('CRITICAL PRODUCTION DATABASE ERROR: Production must use PostgreSQL + PostGIS (DATABASE_URL=postgresql://...). SQLite is rejected in production.');
  }

  return {
    connectionString: dbUrl,
    isPostgres
  };
}

export async function initPostgresPool(connectionString?: string): Promise<pg.Pool> {
  if (pgPool) return pgPool;

  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required to initialize PostgreSQL connection pool.');
  }

  pgPool = new Pool({
    connectionString: url,
    max: 25,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  // Run initial schema migration
  const client = await pgPool.connect();
  try {
    console.log('[PostgreSQL/PostGIS] Executing database schema migrations...');
    await client.query(POSTGRES_POSTGIS_SCHEMA);
    console.log('[PostgreSQL/PostGIS] Production schema migrations applied successfully.');
  } finally {
    client.release();
  }

  return pgPool;
}

export function getPgPool(): pg.Pool | null {
  return pgPool;
}

export async function queryPg<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (!pgPool) throw new Error('PostgreSQL pool not initialized');
  const res = await pgPool.query(sql, params);
  return res.rows as T[];
}

export async function getPg<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  const rows = await queryPg<T>(sql, params);
  return rows[0];
}

export async function runPg(sql: string, params: any[] = []): Promise<{ rowCount: number }> {
  if (!pgPool) throw new Error('PostgreSQL pool not initialized');
  const res = await pgPool.query(sql, params);
  return { rowCount: res.rowCount || 0 };
}

export async function transactionPg<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  if (!pgPool) throw new Error('PostgreSQL pool not initialized');
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
