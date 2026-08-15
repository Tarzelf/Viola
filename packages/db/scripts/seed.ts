import { createDb } from '../src/client';
import { migrate } from '../src/migrate';
import { seed } from '../src/seed';

const handle = await createDb();

try {
  await migrate(handle.db);
  const result = await seed(handle.db);
  console.log(
    `seeded ${result.users} users, ${result.looks} looks, ${result.items} items, ${result.products} products`,
  );
  if (!process.env.DATABASE_URL) {
    console.log(
      'note: no DATABASE_URL set, so this ran against an ephemeral in-memory PGlite and is now gone.',
    );
  }
} finally {
  await handle.close();
}
