import 'server-only';
import { createDb, migrate, schema, seed, type DbHandle } from '@viola/db';
import { generateSeedMedia } from './seed-media';
import { providers } from './providers';

/**
 * Database singleton.
 *
 * With no DATABASE_URL we run PGlite against a directory on disk, so a dev
 * server restart keeps its data. Migrations run on first access, and an empty
 * database is seeded — meaning `pnpm dev` on a fresh clone lands you on a feed
 * with real content instead of an empty state, with no setup steps at all.
 *
 * Next recompiles modules on change, so the handle is parked on globalThis to
 * avoid opening a second PGlite instance on every hot reload.
 */

const globalForDb = globalThis as unknown as { violaDb?: Promise<DbHandle> };

async function initialise(): Promise<DbHandle> {
  const handle = await createDb({
    url: process.env.DATABASE_URL,
    dataDir: process.env.DATABASE_URL ? undefined : (process.env.VIOLA_PGLITE_DIR ?? '.viola-db'),
  });

  await migrate(handle.db);

  if (!process.env.DATABASE_URL && process.env.VIOLA_SKIP_SEED !== '1') {
    const existing = await handle.db.select().from(schema.looks).limit(1);
    if (existing.length === 0) {
      const result = await seed(handle.db);
      console.info(
        `[viola] seeded a fresh local database: ${result.looks} looks, ${result.items} items`,
      );
    }

    // Artwork and layouts for the seeded rows. Idempotent, so it also backfills
    // a database that was seeded before this step existed.
    const written = await generateSeedMedia(handle.db, providers().storage);
    if (written > 0) console.info(`[viola] generated ${written} seed images`);
  }

  return handle;
}

export function getDbHandle(): Promise<DbHandle> {
  globalForDb.violaDb ??= initialise();
  return globalForDb.violaDb;
}

export async function db() {
  return (await getDbHandle()).db;
}
