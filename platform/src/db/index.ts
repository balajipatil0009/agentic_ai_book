import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { __pgPool?: Pool };

function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
  } catch {
    return false;
  }
}

function createPool(): Pool {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');

  // Neon's console copies `channel_binding=require`, which node-postgres
  // doesn't implement — drop it (the server falls back to its default).
  const url = new URL(raw);
  url.searchParams.delete('channel_binding');

  const local = isLocalHost(url.toString());

  return new Pool({
    connectionString: url.toString(),
    // Managed Postgres (Neon, Supabase…) requires TLS; local doesn't speak it.
    ssl: local ? undefined : { rejectUnauthorized: false },
    // The remote pooler multiplexes connections — a small app pool is plenty
    // and avoids burning the project's connection limit.
    max: local ? 10 : 5,
    connectionTimeoutMillis: 10_000,
  });
}

export const pool = globalForDb.__pgPool ?? createPool();

if (process.env.NODE_ENV !== 'production') globalForDb.__pgPool = pool;

export const db = drizzle(pool, { schema });
