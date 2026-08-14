import { createDb } from '../src/client.js';
import { migrate } from '../src/migrate.js';

const handle = await createDb();
const target = process.env.DATABASE_URL ? 'DATABASE_URL' : 'in-process PGlite';

try {
  const { applied, skipped } = await migrate(handle.db);
  console.log(`migrating against ${target}`);
  if (applied.length === 0) {
    console.log(`nothing to do — ${skipped.length} migration(s) already applied`);
  } else {
    for (const name of applied) console.log(`  applied ${name}`);
  }
} finally {
  await handle.close();
}
