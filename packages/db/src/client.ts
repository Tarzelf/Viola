import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Schema = typeof schema;

/**
 * Two drivers, one interface.
 *
 * With no DATABASE_URL we run PGlite — real PostgreSQL 18 compiled to wasm,
 * in-process. That is what lets dev and CI work with no Docker, no Supabase
 * project and no credentials, which in turn is what makes the whole app
 * verifiable offline. With a DATABASE_URL we use postgres-js against Supabase.
 *
 * Verified during planning: PGlite has `gen_random_uuid()` built in but has NO
 * pgcrypto, so no migration may ever require that extension.
 */
export type Database =
  ReturnType<typeof drizzlePglite<Schema>> | ReturnType<typeof drizzlePostgres<Schema>>;

export interface DbHandle {
  db: Database;
  /** Present only for the embedded driver, for tests that need raw access. */
  pglite?: PGlite;
  close: () => Promise<void>;
}

let shared: DbHandle | null = null;

export interface CreateDbOptions {
  url?: string | undefined;
  /** Filesystem path for a persistent PGlite database. Omit for in-memory. */
  dataDir?: string | undefined;
  max?: number;
}

export async function createDb(options: CreateDbOptions = {}): Promise<DbHandle> {
  const url = options.url ?? process.env.DATABASE_URL;

  if (url) {
    const sql = postgres(url, { max: options.max ?? 10, prepare: false });
    const db = drizzlePostgres(sql, { schema });
    return { db, close: async () => void (await sql.end({ timeout: 5 })) };
  }

  const pglite = options.dataDir ? new PGlite(options.dataDir) : new PGlite();
  const db = drizzlePglite(pglite, { schema });
  return { db, pglite, close: async () => void (await pglite.close()) };
}

/** Process-wide handle for the app. Tests create their own isolated instances. */
export async function getDb(): Promise<DbHandle> {
  shared ??= await createDb();
  return shared;
}

export async function closeDb(): Promise<void> {
  if (shared) {
    await shared.close();
    shared = null;
  }
}

export { schema };
