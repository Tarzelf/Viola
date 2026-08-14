import { sql } from 'drizzle-orm';
import { createDb, type DbHandle } from '../client.js';
import { migrate, rowsOf } from '../migrate.js';

/**
 * Test harness.
 *
 * Every test gets a fresh in-memory PostgreSQL 18 with the real migrations
 * applied. No Docker, no shared state, no cleanup ordering bugs, and the schema
 * under test is byte-for-byte the schema that ships.
 */
export async function createTestDb(): Promise<DbHandle> {
  const handle = await createDb({ url: undefined });
  await migrate(handle.db);
  return handle;
}

/**
 * Truncates everything between tests when reusing one instance. Faster than
 * standing up a new PGlite per test (which costs ~1s), and `restart identity
 * cascade` leaves the schema untouched.
 */
export async function truncateAll(handle: DbHandle): Promise<void> {
  const rows = rowsOf<{ tablename: string }>(
    await handle.db.execute(
      sql.raw(`
        select tablename from pg_tables
        where schemaname = 'public' and tablename <> '_viola_migrations'
      `),
    ),
  );

  if (rows.length === 0) return;

  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await handle.db.execute(sql.raw(`truncate table ${list} restart identity cascade`));
}
